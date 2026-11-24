import type { Request } from 'express';
import { prisma } from './prisma';

export async function audit(
  req: Request,
  action: string,
  entityType?: string,
  entityId?: string,
  summary?: string,
  details?: unknown,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id ?? null,
        action,
        entityType,
        entityId,
        summary,
        details: details === undefined ? undefined : (JSON.parse(JSON.stringify(details)) as object),
        ip: req.ip,
        userAgent: req.get('user-agent')?.slice(0, 300),
      },
    });
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
}
