import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@sst/shared';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, conflict, forbidden, notFound, parse } from '../../lib/http';
import { paged, parseList } from '../../lib/query';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { clearUserCache, requireAnyPermission, requirePermission } from '../../middleware/auth';
import { hashPassword, passwordSchema } from '../auth/auth.routes';
import { registry } from '../content/content-factory';

export const adminRouter = Router();

// ─────────────── Users ───────────────
const userSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
};
const shapeUser = (u: any) => ({ ...u, roles: u.roles.map((r: any) => r.role) });

doc({ method: 'get', path: '/api/admin/users', tag: 'Users', summary: 'List users', auth: true, permission: 'users.view' });
adminRouter.get(
  '/users',
  requirePermission('users.view'),
  ah(async (req, res) => {
    const q = parseList(req.query, ['name', 'email', 'createdAt', 'lastLoginAt'], 'name');
    const where: any = { deletedAt: null };
    if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }];
    if (req.query.roleId) where.roles = { some: { roleId: String(req.query.roleId) } };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take, select: userSelect }),
      prisma.user.count({ where }),
    ]);
    res.json(paged(items.map(shapeUser), total, q));
  }),
);

const userCreate = z.object({
  email: z.string().email().max(200).transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, 'Assign at least one role'),
  isActive: z.boolean().default(true),
});
doc({ method: 'post', path: '/api/admin/users', tag: 'Users', summary: 'Create user', auth: true, permission: 'users.manage', body: userCreate });
adminRouter.post(
  '/users',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const d = parse(userCreate, req.body);
    if (await prisma.user.findFirst({ where: { email: d.email } })) throw conflict('A user with this email already exists');
    const u = await prisma.user.create({
      data: { email: d.email, name: d.name, isActive: d.isActive, passwordHash: await hashPassword(d.password), roles: { create: d.roleIds.map((roleId) => ({ roleId })) } },
      select: userSelect,
    });
    await audit(req, 'user.create', 'user', u.id, `Created user ${u.email}`);
    res.status(201).json(shapeUser(u));
  }),
);

const userUpdate = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(200).transform((e) => e.toLowerCase()),
  roleIds: z.array(z.string().uuid()).min(1, 'Assign at least one role'),
  isActive: z.boolean(),
  password: passwordSchema.optional().or(z.literal('').transform(() => undefined)),
});
doc({ method: 'put', path: '/api/admin/users/:id', tag: 'Users', summary: 'Update user (roles, status, optional new password)', auth: true, permission: 'users.manage', body: userUpdate });
adminRouter.put(
  '/users/:id',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const d = parse(userUpdate, req.body);
    const id = req.params.id!;
    if (id === req.user!.id && !d.isActive) throw badRequest('You cannot deactivate your own account');
    const target = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw notFound('User');
    await ensureSuperAdminRemains(id, d.roleIds, d.isActive);
    const u = await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (!d.isActive) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.user.update({
        where: { id },
        data: {
          name: d.name,
          email: d.email,
          isActive: d.isActive,
          ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
          roles: { create: d.roleIds.map((roleId) => ({ roleId })) },
        },
        select: userSelect,
      });
    });
    clearUserCache(id);
    await audit(req, 'user.update', 'user', id, `Updated user ${u.email}`, { roles: u.roles.map((r: any) => r.role.key), isActive: u.isActive, passwordChanged: !!d.password });
    res.json(shapeUser(u));
  }),
);

doc({ method: 'delete', path: '/api/admin/users/:id', tag: 'Users', summary: 'Delete (deactivate and hide) a user', auth: true, permission: 'users.manage' });
adminRouter.delete(
  '/users/:id',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const id = req.params.id!;
    if (id === req.user!.id) throw badRequest('You cannot delete your own account');
    await ensureSuperAdminRemains(id, [], false);
    const u = await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, email: `deleted+${Date.now()}+${id}@invalid` } });
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    clearUserCache(id);
    await audit(req, 'user.delete', 'user', id, `Deleted user ${u.name}`);
    res.json({ ok: true });
  }),
);

/** Prevents locking everyone out: at least one active super administrator must remain. */
async function ensureSuperAdminRemains(userId: string, newRoleIds: string[], active: boolean) {
  const superRole = await prisma.role.findUnique({ where: { key: 'super_admin' } });
  if (!superRole) return;
  const keepsSuper = active && newRoleIds.includes(superRole.id);
  if (keepsSuper) return;
  const others = await prisma.user.count({ where: { id: { not: userId }, isActive: true, deletedAt: null, roles: { some: { roleId: superRole.id } } } });
  if (others === 0) throw badRequest('At least one active Super Administrator is required');
}

// ─────────────── Roles & permissions ───────────────
doc({ method: 'get', path: '/api/admin/roles', tag: 'Roles & Permissions', summary: 'Roles with permissions, plus the permission catalogue', auth: true });
adminRouter.get(
  '/roles',
  requireAnyPermission('roles.manage', 'users.view', 'users.manage'),
  ah(async (_req, res) => {
    const roles = await prisma.role.findMany({ orderBy: { createdAt: 'asc' }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
    res.json({
      roles: roles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.isSystem, userCount: r._count.users, permissions: r.permissions.map((p) => p.permission.key) })),
      permissions: PERMISSIONS,
    });
  }),
);

const roleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  permissions: z.array(z.string()).max(200),
});
async function setRolePermissions(roleId: string, keys: string[]) {
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });
  if (perms.length !== new Set(keys).size) throw badRequest('Unknown permission in list');
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) }),
  ]);
  clearUserCache();
}

doc({ method: 'post', path: '/api/admin/roles', tag: 'Roles & Permissions', summary: 'Create a custom role', auth: true, permission: 'roles.manage', body: roleSchema });
adminRouter.post(
  '/roles',
  requirePermission('roles.manage'),
  ah(async (req, res) => {
    const d = parse(roleSchema, req.body);
    const key = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36);
    const role = await prisma.role.create({ data: { key, name: d.name, description: d.description } });
    await setRolePermissions(role.id, d.permissions);
    await audit(req, 'role.create', 'role', role.id, `Created role ${role.name}`, { permissions: d.permissions });
    res.status(201).json(role);
  }),
);

doc({ method: 'put', path: '/api/admin/roles/:id', tag: 'Roles & Permissions', summary: 'Update role name & permissions', auth: true, permission: 'roles.manage', body: roleSchema });
adminRouter.put(
  '/roles/:id',
  requirePermission('roles.manage'),
  ah(async (req, res) => {
    const d = parse(roleSchema, req.body);
    const role = await prisma.role.findUnique({ where: { id: req.params.id! } });
    if (!role) throw notFound('Role');
    if (role.key === 'super_admin') throw forbidden('The Super Administrator role always has full access and cannot be changed');
    await prisma.role.update({ where: { id: role.id }, data: { name: d.name, description: d.description } });
    await setRolePermissions(role.id, d.permissions);
    await audit(req, 'role.update', 'role', role.id, `Updated role ${d.name}`, { permissions: d.permissions });
    res.json({ ok: true });
  }),
);

doc({ method: 'delete', path: '/api/admin/roles/:id', tag: 'Roles & Permissions', summary: 'Delete a custom role (not assigned to anyone)', auth: true, permission: 'roles.manage' });
adminRouter.delete(
  '/roles/:id',
  requirePermission('roles.manage'),
  ah(async (req, res) => {
    const role = await prisma.role.findUnique({ where: { id: req.params.id! }, include: { _count: { select: { users: true } } } });
    if (!role) throw notFound('Role');
    if (role.isSystem) throw forbidden('Built-in roles cannot be deleted');
    if (role._count.users) throw conflict('Remove this role from all users first');
    await prisma.role.delete({ where: { id: role.id } });
    await audit(req, 'role.delete', 'role', role.id, `Deleted role ${role.name}`);
    res.json({ ok: true });
  }),
);

// ─────────────── Audit log ───────────────
doc({ method: 'get', path: '/api/admin/audit-logs', tag: 'Audit', summary: 'Search audit logs', auth: true, permission: 'audit.view' });
adminRouter.get(
  '/audit-logs',
  requirePermission('audit.view'),
  ah(async (req, res) => {
    const q = parseList(req.query, ['createdAt', 'action'], 'createdAt');
    const where: any = {};
    if (q.search) where.OR = [{ summary: { contains: q.search, mode: 'insensitive' } }, { action: { contains: q.search, mode: 'insensitive' } }];
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.from) where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(String(req.query.from)) };
    if (req.query.to) where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(String(req.query.to)) };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take, include: { user: { select: { name: true, email: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paged(items, total, q));
  }),
);

// ─────────────── Revision history (all content) ───────────────
doc({ method: 'get', path: '/api/admin/revisions', tag: 'Revisions', summary: 'Recent revisions across all content', auth: true, permission: 'revisions.view' });
adminRouter.get(
  '/revisions',
  requirePermission('revisions.view'),
  ah(async (req, res) => {
    const q = parseList(req.query, ['createdAt'], 'createdAt');
    const where: any = req.query.entityType ? { entityType: String(req.query.entityType) } : {};
    const [items, total] = await Promise.all([
      prisma.revision.findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take, select: { id: true, entityType: true, entityId: true, version: true, action: true, comment: true, createdById: true, createdAt: true } }),
      prisma.revision.count({ where }),
    ]);
    // Resolve item titles and user names for display.
    const titles = new Map<string, string>();
    for (const cfg of registry) {
      const ids = [...new Set(items.filter((i) => i.entityType === cfg.type).map((i) => i.entityId))];
      if (!ids.length) continue;
      const rows = await cfg.delegate().findMany({ where: { id: { in: ids } }, select: { id: true, ...cfg.listSelect } });
      rows.forEach((r: any) => titles.set(`${cfg.type}:${r.id}`, cfg.titleOf(r)));
    }
    const userIds = [...new Set(items.map((i) => i.createdById).filter(Boolean))] as string[];
    const users = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    res.json(
      paged(
        items.map((i) => ({ ...i, title: titles.get(`${i.entityType}:${i.entityId}`) ?? (i.entityType === 'setting' ? `Settings: ${i.entityId}` : null), createdByName: i.createdById ? users.get(i.createdById) ?? null : null })),
        total,
        q,
      ),
    );
  }),
);

// ─────────────── Approval queue & dashboard ───────────────
async function workflowItems(status: string[], take = 50) {
  const out: any[] = [];
  for (const cfg of registry) {
    const rows = await cfg.delegate().findMany({ where: { deletedAt: null, status: { in: status } }, orderBy: { updatedAt: 'desc' }, take, select: { id: true, ...cfg.listSelect, status: true, updatedAt: true, submittedAt: true, scheduledPublishAt: true, reviewComment: true } });
    out.push(...rows.map((r: any) => ({ id: r.id, entityType: cfg.type, module: cfg.path, title: cfg.titleOf(r), status: r.status, updatedAt: r.updatedAt, submittedAt: r.submittedAt, scheduledPublishAt: r.scheduledPublishAt, reviewComment: r.reviewComment })));
  }
  return out.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, take);
}

doc({ method: 'get', path: '/api/admin/workflow/queue', tag: 'Approval Workflow', summary: 'Items awaiting review, approved/scheduled and rejected', auth: true, permission: 'dashboard.view' });
adminRouter.get(
  '/workflow/queue',
  requirePermission('dashboard.view'),
  ah(async (_req, res) => {
    const [inReview, approved, rejected] = await Promise.all([workflowItems(['IN_REVIEW']), workflowItems(['APPROVED']), workflowItems(['REJECTED'])]);
    res.json({ inReview, approved, rejected });
  }),
);

doc({ method: 'get', path: '/api/admin/dashboard', tag: 'Dashboard', summary: 'Dashboard overview', auth: true, permission: 'dashboard.view' });
adminRouter.get(
  '/dashboard',
  requirePermission('dashboard.view'),
  ah(async (_req, res) => {
    const count = (d: any, where: any = { deletedAt: null }) => d.count({ where });
    const [pages, people, posts, events, stories, media, documents, galleries, users, drafts, recent, recentRevisions] = await Promise.all([
      count(prisma.page),
      count(prisma.person),
      count(prisma.post),
      count(prisma.event),
      count(prisma.story),
      count(prisma.media),
      count(prisma.document),
      count(prisma.gallery),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      workflowItems(['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'], 200),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { user: { select: { name: true } } } }),
      prisma.revision.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    ]);
    const byStatus = (s: string) => drafts.filter((d) => d.status === s).length;
    res.json({
      counts: { pages, people, posts, events, stories, media, documents, galleries, users },
      workflow: { draft: byStatus('DRAFT'), inReview: byStatus('IN_REVIEW'), approved: byStatus('APPROVED'), rejected: byStatus('REJECTED') },
      editsLast7Days: recentRevisions,
      pending: drafts.filter((d) => d.status === 'IN_REVIEW').slice(0, 8),
      recentActivity: recent,
    });
  }),
);
