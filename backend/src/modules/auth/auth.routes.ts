import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../../config';
import { cookieSecure, system } from '../../lib/system';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, HttpError, parse, unauthorized } from '../../lib/http';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { clearUserCache, loadAuthUser, requireAuth, serializeAuthUser, signAccessToken } from '../../middleware/auth';

export const authRouter = Router();

const REFRESH_COOKIE = 'sst_refresh';
const COOKIE_PATH = '/api/admin/auth';
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 12);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Password must include upper and lower case letters and a number');

export const hashPassword = (p: string) => bcrypt.hash(p, 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
});

export async function issueSession(req: Request, res: Response, userId: string) {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 86400_000);
  await prisma.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 300) },
  });
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(await system(), req.secure),
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: expiresAt,
  });
  const user = await loadAuthUser(userId);
  return { accessToken: signAccessToken(userId), expiresIn: config.accessTokenTtlSec, user: user && serializeAuthUser(user) };
}

// ── Login ──
const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
  totp: z.string().regex(/^\d{6}$/).optional(),
});
doc({ method: 'post', path: '/api/admin/auth/login', tag: 'Auth', summary: 'Sign in (sets refresh cookie, returns access token)', body: loginSchema });
authRouter.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { email, password, totp } = parse(loginSchema, req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
    const invalid = new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // timing equalisation
      throw invalid;
    }
    if (!user.isActive) throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new HttpError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in a few minutes.');

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const failed = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      req.user = undefined;
      await audit(req, 'auth.login_failed', 'user', user.id, `Failed sign-in for ${user.email}`);
      throw invalid;
    }
    if (user.twoFactorEnabled) {
      if (!totp) throw new HttpError(401, 'TWO_FACTOR_REQUIRED', 'Enter the 6-digit code from your authenticator app');
      if (!user.twoFactorSecret || !authenticator.verify({ token: totp, secret: user.twoFactorSecret }))
        throw new HttpError(401, 'INVALID_TWO_FACTOR', 'Invalid authentication code');
    }
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const result = await issueSession(req, res, user.id);
    req.user = (await loadAuthUser(user.id)) ?? undefined;
    await audit(req, 'auth.login', 'user', user.id, `${user.email} signed in`);
    res.json(result);
  }),
);

// ── Refresh (rotates the refresh token) ──
doc({ method: 'post', path: '/api/admin/auth/refresh', tag: 'Auth', summary: 'Exchange refresh cookie for a new access token' });
authRouter.post(
  '/refresh',
  ah(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw unauthorized('No session');
    const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      throw unauthorized('Session expired');
    }
    const user = await loadAuthUser(session.userId);
    if (!user) throw unauthorized('Account is not active');
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    res.json(await issueSession(req, res, session.userId));
  }),
);

doc({ method: 'post', path: '/api/admin/auth/logout', tag: 'Auth', summary: 'Sign out (revokes the refresh session)' });
authRouter.post(
  '/logout',
  ah(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await prisma.session.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    res.json({ ok: true });
  }),
);

doc({ method: 'get', path: '/api/admin/auth/me', tag: 'Auth', summary: 'Current user, roles and permissions', auth: true });
authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { twoFactorEnabled: true, lastLoginAt: true } });
    res.json({ ...serializeAuthUser(req.user!), ...u });
  }),
);

// ── Password reset ──
const forgotSchema = z.object({ email: z.string().email() });
doc({ method: 'post', path: '/api/admin/auth/forgot-password', tag: 'Auth', summary: 'Request a password reset link', body: forgotSchema });
authRouter.post(
  '/forgot-password',
  loginLimiter,
  ah(async (req, res) => {
    const { email } = parse(forgotSchema, req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), isActive: true, deletedAt: null } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetHash: sha256(token), passwordResetExpires: new Date(Date.now() + 60 * 60_000) },
      });
      const link = `${(await system()).publicUrl}/admin/reset-password?token=${token}`;
      // No mail server is configured yet: the link is written to the server log.
      // Replace with an email provider (SMTP / transactional API) in production.
      console.info(`[password-reset] ${user.email}: ${link}`);
      await audit(req, 'auth.password_reset_requested', 'user', user.id);
    }
    // Always the same response to avoid account enumeration.
    res.json({ ok: true, message: 'If the account exists, a reset link has been sent.' });
  }),
);

const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
doc({ method: 'post', path: '/api/admin/auth/reset-password', tag: 'Auth', summary: 'Set a new password using a reset token', body: resetSchema });
authRouter.post(
  '/reset-password',
  loginLimiter,
  ah(async (req, res) => {
    const { token, password } = parse(resetSchema, req.body);
    const user = await prisma.user.findFirst({ where: { passwordResetHash: sha256(token), passwordResetExpires: { gt: new Date() } } });
    if (!user) throw badRequest('This reset link is invalid or has expired');
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password), passwordResetHash: null, passwordResetExpires: null, failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(req, 'auth.password_reset', 'user', user.id);
    res.json({ ok: true });
  }),
);

const changeSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
doc({ method: 'post', path: '/api/admin/auth/change-password', tag: 'Auth', summary: 'Change own password', auth: true, body: changeSchema });
authRouter.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const { currentPassword, newPassword } = parse(changeSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await audit(req, 'auth.password_changed', 'user', user.id);
    res.json({ ok: true });
  }),
);

// ── Optional two-factor authentication (TOTP) ──
doc({ method: 'post', path: '/api/admin/auth/2fa/setup', tag: 'Auth', summary: 'Start 2FA setup (returns QR code)', auth: true });
authRouter.post(
  '/2fa/setup',
  requireAuth,
  ah(async (req, res) => {
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: req.user!.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
    const uri = authenticator.keyuri(req.user!.email, 'SST Admin', secret);
    res.json({ secret, qrCode: await QRCode.toDataURL(uri) });
  }),
);

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
doc({ method: 'post', path: '/api/admin/auth/2fa/enable', tag: 'Auth', summary: 'Confirm and enable 2FA', auth: true, body: codeSchema });
authRouter.post(
  '/2fa/enable',
  requireAuth,
  ah(async (req, res) => {
    const { code } = parse(codeSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.twoFactorSecret || !authenticator.verify({ token: code, secret: user.twoFactorSecret })) throw badRequest('Invalid code');
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    clearUserCache(user.id);
    await audit(req, 'auth.2fa_enabled', 'user', user.id);
    res.json({ ok: true });
  }),
);

doc({ method: 'post', path: '/api/admin/auth/2fa/disable', tag: 'Auth', summary: 'Disable 2FA', auth: true, body: codeSchema });
authRouter.post(
  '/2fa/disable',
  requireAuth,
  ah(async (req, res) => {
    const { code } = parse(codeSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.twoFactorSecret || !authenticator.verify({ token: code, secret: user.twoFactorSecret })) throw badRequest('Invalid code');
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    await audit(req, 'auth.2fa_disabled', 'user', user.id);
    res.json({ ok: true });
  }),
);
