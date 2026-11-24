import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { THEME_PRESETS } from '@sst/shared';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, conflict, HttpError, parse } from '../../lib/http';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { invalidatePublic } from '../../lib/cache';
import { checkSetupCode, clearSetupCode, ensureSetupCode, isOverridden, rotate, type SecretName } from '../../lib/secrets';
import { clearSystemCache, envOverrides, storedSystem, system, systemSchema } from '../../lib/system';
import { clearUserCache, loadAuthUser, requireAuth, requirePermission } from '../../middleware/auth';
import { hashPassword, issueSession, passwordSchema } from '../auth/auth.routes';

/**
 * First-run setup (no .env needed): while no administrator exists, the admin portal shows a
 * setup wizard. Completing it requires the one-time setup code printed in the API log, so a
 * freshly started server cannot be claimed by someone else.
 */
export const setupRouter = Router();
export const systemRouter = Router();

const needsSetup = async () => (await prisma.user.count({ where: { deletedAt: null } })) === 0;

/** Called at server start: prints the setup code while the install is unclaimed. */
export async function announceSetup() {
  if (!(await needsSetup())) return clearSetupCode();
  const code = ensureSetupCode();
  const line = '═'.repeat(64);
  console.info(`\n${line}\n  SST first-run setup\n  Open the administration portal (/admin/) and enter this setup code:\n\n      ${code}\n\n  The code is shown until the first administrator is created.\n${line}\n`);
}

const setupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.NODE_ENV === 'test' ? 1000 : 20, standardHeaders: 'draft-7', legacyHeaders: false });

doc({ method: 'get', path: '/api/admin/setup/status', tag: 'Setup', summary: 'Whether first-run setup is required' });
setupRouter.get(
  '/status',
  ah(async (_req, res) => {
    const required = await needsSetup();
    res.json({ required, suggestedPublicUrl: required ? (await storedSystem()).publicUrl : undefined });
  }),
);

const setupSchema = z.object({
  code: z.string().trim().min(6).max(20),
  admin: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200).transform((e) => e.toLowerCase()),
    password: passwordSchema,
  }),
  site: z.object({
    nameLine1: z.string().trim().min(1).max(120),
    nameLine2: z.string().trim().max(120).optional().default(''),
    nameLine3: z.string().trim().max(120).optional().default(''),
    publicUrl: systemSchema.shape.publicUrl,
    theme: z.enum(['navy', 'purple']).default('navy'),
  }),
});

doc({ method: 'post', path: '/api/admin/setup', tag: 'Setup', summary: 'Complete first-run setup (creates the first Super Administrator)', body: setupSchema });
setupRouter.post(
  '/',
  setupLimiter,
  ah(async (req, res) => {
    if (!(await needsSetup())) throw conflict('Setup has already been completed');
    const d = parse(setupSchema, req.body);
    if (!checkSetupCode(d.code)) throw new HttpError(403, 'INVALID_SETUP_CODE', 'The setup code is not correct. It is printed in the API log (docker compose logs api) and stored in setup-code.txt in the configuration folder.');
    const superRole = await prisma.role.findUnique({ where: { key: 'super_admin' } });
    if (!superRole) throw badRequest('Roles are not initialised yet — wait for the API to finish starting and try again');

    const user = await prisma.user.create({
      data: { email: d.admin.email, name: d.admin.name, passwordHash: await hashPassword(d.admin.password), roles: { create: [{ roleId: superRole.id }] } },
    });
    // Site identity, theme and system settings
    const identity = ((await prisma.setting.findUnique({ where: { key: 'identity' } }))?.value ?? {}) as Record<string, unknown>;
    const theme = ((await prisma.setting.findUnique({ where: { key: 'theme' } }))?.value ?? {}) as Record<string, unknown>;
    const sys = { ...(await storedSystem()), publicUrl: d.site.publicUrl };
    const upsert = (key: string, value: object) => prisma.setting.upsert({ where: { key }, update: { value, updatedById: user.id }, create: { key, value, updatedById: user.id } });
    await prisma.$transaction([
      upsert('identity', { ...identity, nameLine1: d.site.nameLine1, nameLine2: d.site.nameLine2, nameLine3: d.site.nameLine3 }),
      upsert('theme', { ...theme, preset: d.site.theme, primary: THEME_PRESETS[d.site.theme].primary }),
      upsert('system', sys),
    ]);
    clearSetupCode();
    clearSystemCache();
    invalidatePublic();
    req.user = (await loadAuthUser(user.id)) ?? undefined;
    await audit(req, 'setup.completed', 'user', user.id, `First-run setup completed by ${user.email}`);
    res.status(201).json(await issueSession(req, res, user.id));
  }),
);

// ─────────────── System settings (after setup) ───────────────
systemRouter.use(requireAuth);

doc({ method: 'get', path: '/api/admin/system', tag: 'System', summary: 'System settings and security key status', auth: true, permission: 'system.manage' });
systemRouter.get(
  '/',
  requirePermission('system.manage'),
  ah(async (_req, res) => {
    res.json({
      settings: await storedSystem(),
      effective: await system(),
      overriddenByEnvironment: envOverrides(),
      uploadCeilingMb: config.uploadCeilingMb,
      keys: (['jwtAccess', 'preview', 'revalidate'] as SecretName[]).map((k) => ({ key: k, managedByEnvironment: isOverridden(k) })),
    });
  }),
);

doc({ method: 'put', path: '/api/admin/system', tag: 'System', summary: 'Update system settings', auth: true, permission: 'system.manage', body: systemSchema });
systemRouter.put(
  '/',
  requirePermission('system.manage'),
  ah(async (req, res) => {
    const value = parse(systemSchema, req.body);
    const before = await storedSystem();
    await prisma.setting.upsert({ where: { key: 'system' }, update: { value, updatedById: req.user!.id }, create: { key: 'system', value, updatedById: req.user!.id } });
    clearSystemCache();
    invalidatePublic();
    await audit(req, 'system.update', 'setting', 'system', 'Updated system settings', { before, after: value });
    res.json({ settings: value, effective: await system() });
  }),
);

const rotateSchema = z.object({ key: z.enum(['jwtAccess', 'preview', 'revalidate']) });
doc({ method: 'post', path: '/api/admin/system/rotate-key', tag: 'System', summary: 'Rotate a security key (jwtAccess signs everyone out)', auth: true, permission: 'system.manage', body: rotateSchema });
systemRouter.post(
  '/rotate-key',
  requirePermission('system.manage'),
  ah(async (req, res) => {
    const { key } = parse(rotateSchema, req.body);
    if (isOverridden(key)) throw badRequest('This key is set by an environment variable on the server and cannot be rotated here');
    rotate(key);
    if (key === 'jwtAccess') {
      // New signing key + revoke refresh sessions = everyone signs in again.
      await prisma.session.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
      clearUserCache();
    }
    await audit(req, 'system.rotate_key', 'secret', key, `Rotated security key: ${key}`);
    res.json({ ok: true, signedOut: key === 'jwtAccess' });
  }),
);
