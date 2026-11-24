import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { secret } from '../lib/secrets';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/http';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: { key: string; name: string }[];
  permissions: Set<string>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(userId: string) {
  return jwt.sign({ type: 'access' }, secret('jwtAccess'), {
    subject: userId,
    expiresIn: config.accessTokenTtlSec,
    algorithm: 'HS256',
  });
}

// Permissions are cached briefly so role changes apply within seconds without a DB hit per request.
const userCache = new Map<string, { at: number; user: AuthUser }>();
export const clearUserCache = (userId?: string) => (userId ? userCache.delete(userId) : userCache.clear());

export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < 30_000) return hit.user;
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!u) return null;
  const user: AuthUser = {
    id: u.id,
    email: u.email,
    name: u.name,
    roles: u.roles.map((r) => ({ key: r.role.key, name: r.role.name })),
    permissions: new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
  };
  userCache.set(userId, { at: Date.now(), user });
  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw unauthorized();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret('jwtAccess'), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    } catch {
      throw unauthorized('Session expired, please sign in again');
    }
    if (payload.type !== 'access' || !payload.sub) throw unauthorized();
    const user = await loadAuthUser(payload.sub);
    if (!user) throw unauthorized('Account is not active');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export const can = (req: Request, perm: string) => !!req.user?.permissions.has(perm);

/** Requires ALL listed permissions. */
export const requirePermission =
  (...perms: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!perms.every((p) => req.user!.permissions.has(p))) return next(forbidden());
    next();
  };

/** Requires ANY of the listed permissions. */
export const requireAnyPermission =
  (...perms: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!perms.some((p) => req.user!.permissions.has(p))) return next(forbidden());
    next();
  };

export const serializeAuthUser = (u: AuthUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  roles: u.roles,
  permissions: [...u.permissions].sort(),
});
