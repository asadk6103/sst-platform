import { Router, type Request } from 'express';
import { Prisma, type ContentStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z, type AnyZodObject, type ZodTypeAny } from 'zod';
import { secret } from '../../lib/secrets';
import { system } from '../../lib/system';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, conflict, forbidden, HttpError, notFound, parse } from '../../lib/http';
import { paged, parseList } from '../../lib/query';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { invalidatePublic } from '../../lib/cache';
import { syncMediaUsage } from '../../lib/media-refs';
import { can, requirePermission } from '../../middleware/auth';

/**
 * Configuration of one workflow-managed content type. The factory below builds the complete
 * admin REST surface (CRUD + workflow + revisions + preview) from it.
 */
export interface ContentConfig {
  type: string; // entity type name used in revisions/audit ("page", "person" ...)
  module: string; // permission module ("pages", "people" ...)
  label: string;
  path: string; // mounted under /api/admin/<path>
  delegate: () => any; // Prisma model delegate
  createSchema?: AnyZodObject; // omit to disallow creation (e.g. predefined pages)
  updateSchema: (row: any) => ZodTypeAny;
  /** Normalise / sanitise input before saving. */
  prepare?: (data: any, row?: any) => any | Promise<any>;
  /** Fields copied into revisions (and restored from them). */
  editableFields: string[];
  /** Builds the public snapshot stored in `published_data`. */
  serialize: (row: any) => Promise<Record<string, unknown>> | Record<string, unknown>;
  titleOf: (row: any) => string;
  /** Path on the public website for previews, if the content has its own page. */
  publicPath?: (row: any) => string | null;
  searchFields: string[];
  sortable: string[];
  defaultSort?: string;
  listFilter?: (query: Record<string, any>) => Record<string, unknown>;
  listSelect?: Record<string, unknown>;
  include?: Record<string, unknown>;
  canDelete?: boolean;
  /** Extra filter params documented for the list endpoint. */
  listQueryDoc?: AnyZodObject;
}

export const registry: ContentConfig[] = [];

const WORKFLOW_SELECT = {
  status: true,
  publishedAt: true,
  scheduledPublishAt: true,
  submittedAt: true,
  reviewedAt: true,
  reviewComment: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
};

async function nextVersion(entityType: string, entityId: string) {
  const last = await prisma.revision.findFirst({ where: { entityType, entityId }, orderBy: { version: 'desc' }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

export async function writeRevision(cfg: ContentConfig, row: any, action: string, userId?: string, comment?: string) {
  const data = Object.fromEntries(cfg.editableFields.map((f) => [f, row[f] ?? null]));
  await prisma.revision.create({
    data: { entityType: cfg.type, entityId: row.id, version: await nextVersion(cfg.type, row.id), action, data, comment, createdById: userId },
  });
}

async function logTransition(cfg: ContentConfig, id: string, action: string, from: string | null, to: string, userId?: string, comment?: string) {
  await prisma.publicationLog.create({ data: { entityType: cfg.type, entityId: id, action, fromStatus: from, toStatus: to, comment, userId } });
}

/** Publishes the current working copy. Used by the publish endpoint and the scheduler. */
export async function publishEntity(cfg: ContentConfig, id: string, userId?: string, comment?: string) {
  const row = await cfg.delegate().findFirst({ where: { id, deletedAt: null }, include: cfg.include });
  if (!row) throw notFound(cfg.label);
  const snapshot = await cfg.serialize(row);
  const updated = await cfg.delegate().update({
    where: { id },
    data: { status: 'PUBLISHED', publishedData: snapshot as Prisma.InputJsonValue, publishedAt: new Date(), scheduledPublishAt: null, updatedById: userId ?? row.updatedById },
  });
  await writeRevision(cfg, updated, 'PUBLISH', userId, comment);
  await logTransition(cfg, id, 'PUBLISH', row.status, 'PUBLISHED', userId, comment);
  await syncMediaUsage(cfg.type, id, { work: row, live: snapshot }, cfg.titleOf(row));
  invalidatePublic();
  return updated;
}

/** Scheduled publishing: publishes APPROVED items whose publication time has arrived. */
export async function runScheduledPublishing() {
  for (const cfg of registry) {
    const due = await cfg.delegate().findMany({
      where: { status: 'APPROVED', deletedAt: null, scheduledPublishAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const { id } of due) {
      try {
        await publishEntity(cfg, id, undefined, 'Scheduled publication');
        console.info(`[scheduler] published ${cfg.type} ${id}`);
      } catch (e) {
        console.error(`[scheduler] failed to publish ${cfg.type} ${id}`, e);
      }
    }
  }
}

export function signPreviewToken(userId: string) {
  return jwt.sign({ type: 'preview' }, secret('preview'), { subject: userId, expiresIn: '30m' });
}
export function verifyPreviewToken(token?: string | null): boolean {
  if (!token) return false;
  try {
    return (jwt.verify(token, secret('preview')) as jwt.JwtPayload).type === 'preview';
  } catch {
    return false;
  }
}

const commentSchema = z.object({ comment: z.string().trim().max(2000).optional() });
const rejectSchema = z.object({ comment: z.string().trim().min(1, 'Please explain why the content was rejected').max(2000) });
const publishSchema = z.object({ comment: z.string().trim().max(2000).optional(), scheduledPublishAt: z.coerce.date().optional() });

export function workflowInfo(row: any) {
  return {
    status: row.status as ContentStatus,
    isLive: row.publishedData != null,
    hasPendingChanges: row.publishedData != null && row.status !== 'PUBLISHED',
    publishedAt: row.publishedAt,
    scheduledPublishAt: row.scheduledPublishAt,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewComment: row.reviewComment,
  };
}

export function createContentRouter(cfg: ContentConfig) {
  registry.push(cfg);
  const r = Router();
  const base = `/api/admin/${cfg.path}`;
  const tag = cfg.label;
  const P = (action: string) => `${cfg.module}.${action}`;

  const load = async (id: string) => {
    const row = await cfg.delegate().findFirst({ where: { id, deletedAt: null }, include: cfg.include });
    if (!row) throw notFound(cfg.label);
    return row;
  };

  const assertCanEdit = (req: Request, row: any) => {
    if (!can(req, P('edit'))) throw forbidden();
    if (row.createdById && row.createdById !== req.user!.id && !can(req, 'content.edit_others'))
      throw forbidden('You can only edit content you created');
  };

  const userNames = async (rows: any[]) => {
    const ids = [...new Set(rows.flatMap((r) => [r.createdById, r.updatedById, r.userId]).filter(Boolean))] as string[];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return Object.fromEntries(users.map((u) => [u.id, u.name]));
  };

  // ── List ──
  doc({ method: 'get', path: base, tag, summary: `List ${cfg.label}`, auth: true, permission: P('view'), query: cfg.listQueryDoc });
  r.get(
    '/',
    requirePermission(P('view')),
    ah(async (req, res) => {
      const q = parseList(req.query, cfg.sortable, cfg.defaultSort ?? 'updatedAt');
      const where: any = { deletedAt: null, ...(cfg.listFilter?.(req.query as any) ?? {}) };
      if (q.search) where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
      if (q.status === 'LIVE') where.NOT = { publishedData: { equals: Prisma.DbNull } };
      else if (q.status) where.status = q.status;
      const [rows, total] = await Promise.all([
        cfg.delegate().findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take, select: { id: true, ...cfg.listSelect, ...WORKFLOW_SELECT, publishedData: true } }),
        cfg.delegate().count({ where }),
      ]);
      const names = await userNames(rows);
      res.json(
        paged(
          rows.map(({ publishedData, ...row }: any) => ({
            ...row,
            title: cfg.titleOf(row),
            isLive: publishedData != null,
            hasPendingChanges: publishedData != null && row.status !== 'PUBLISHED',
            updatedByName: names[row.updatedById] ?? null,
          })),
          total,
          q,
        ),
      );
    }),
  );

  // ── Read ──
  doc({ method: 'get', path: `${base}/:id`, tag, summary: `Get one ${cfg.label} item (working copy)`, auth: true, permission: P('view') });
  r.get(
    '/:id',
    requirePermission(P('view')),
    ah(async (req, res) => {
      const row = await load(req.params.id!);
      const { publishedData, ...rest } = row;
      const names = await userNames([row]);
      res.json({
        ...rest,
        workflow: workflowInfo(row),
        createdByName: names[row.createdById] ?? null,
        updatedByName: names[row.updatedById] ?? null,
        publicPath: cfg.publicPath?.(row) ?? null,
        canEdit: can(req, P('edit')) && (!row.createdById || row.createdById === req.user!.id || can(req, 'content.edit_others')),
      });
    }),
  );

  // ── Create ──
  if (cfg.createSchema) {
    const createSchema = cfg.createSchema;
    doc({ method: 'post', path: base, tag, summary: `Create ${cfg.label} item (as draft)`, auth: true, permission: P('create'), body: createSchema });
    r.post(
      '/',
      requirePermission(P('create')),
      ah(async (req, res) => {
        let data = parse(createSchema, req.body);
        if (cfg.prepare) data = await cfg.prepare(data);
        const row = await cfg.delegate().create({ data: { ...data, status: 'DRAFT', createdById: req.user!.id, updatedById: req.user!.id } });
        await writeRevision(cfg, row, 'CREATE', req.user!.id);
        await syncMediaUsage(cfg.type, row.id, row, cfg.titleOf(row));
        await audit(req, `${cfg.type}.create`, cfg.type, row.id, `Created ${cfg.label}: ${cfg.titleOf(row)}`);
        res.status(201).json(row);
      }),
    );
  }

  // ── Update (working copy only — live content is untouched until published) ──
  doc({ method: 'put', path: `${base}/:id`, tag, summary: `Update ${cfg.label} working copy`, auth: true, permission: P('edit') });
  r.put(
    '/:id',
    ah(async (req, res) => {
      const row = await load(req.params.id!);
      assertCanEdit(req, row);
      if (req.body?.expectedUpdatedAt && new Date(req.body.expectedUpdatedAt).getTime() !== new Date(row.updatedAt).getTime())
        throw conflict('This item was changed by someone else since you opened it. Reload to see the latest version.');
      let data = parse(cfg.updateSchema(row), req.body);
      if (cfg.prepare) data = await cfg.prepare(data, row);
      const status = row.status === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT';
      const updated = await cfg.delegate().update({ where: { id: row.id }, data: { ...data, status, updatedById: req.user!.id } });
      await writeRevision(cfg, updated, 'SAVE', req.user!.id);
      await syncMediaUsage(cfg.type, row.id, { work: updated, live: row.publishedData }, cfg.titleOf(updated));
      await audit(req, `${cfg.type}.update`, cfg.type, row.id, `Updated ${cfg.label}: ${cfg.titleOf(updated)}`);
      const { publishedData, ...rest } = updated;
      res.json({ ...rest, workflow: workflowInfo(updated) });
    }),
  );

  // ── Archive (soft delete) ──
  if (cfg.canDelete !== false) {
    doc({ method: 'delete', path: `${base}/:id`, tag, summary: `Archive ${cfg.label} item (removes it from the website)`, auth: true, permission: P('delete') });
    r.delete(
      '/:id',
      requirePermission(P('delete')),
      ah(async (req, res) => {
        const row = await load(req.params.id!);
        await cfg.delegate().update({ where: { id: row.id }, data: { deletedAt: new Date(), publishedData: Prisma.DbNull, updatedById: req.user!.id } });
        await prisma.mediaUsage.deleteMany({ where: { entityType: cfg.type, entityId: row.id } });
        await audit(req, `${cfg.type}.archive`, cfg.type, row.id, `Archived ${cfg.label}: ${cfg.titleOf(row)}`);
        invalidatePublic();
        res.json({ ok: true });
      }),
    );
  }

  // ── Workflow transitions ──
  const transition = (
    action: string,
    perm: string,
    allowedFrom: ContentStatus[],
    to: ContentStatus,
    schema: AnyZodObject,
    extra: (body: any, req: Request) => Record<string, unknown>,
  ) => {
    doc({ method: 'post', path: `${base}/:id/${action.toLowerCase()}`, tag, summary: `Workflow: ${action.toLowerCase()}`, auth: true, permission: perm, body: schema });
    r.post(
      `/:id/${action.toLowerCase()}`,
      requirePermission(perm),
      ah(async (req, res) => {
        const body = parse(schema, req.body ?? {});
        const row = await load(req.params.id!);
        if (!allowedFrom.includes(row.status)) throw new HttpError(409, 'INVALID_TRANSITION', `Cannot ${action.toLowerCase()} an item that is ${row.status.replace('_', ' ').toLowerCase()}`);
        const updated = await cfg.delegate().update({ where: { id: row.id }, data: { status: to, ...extra(body, req) } });
        await logTransition(cfg, row.id, action, row.status, to, req.user!.id, body.comment);
        await audit(req, `${cfg.type}.${action.toLowerCase()}`, cfg.type, row.id, `${action} ${cfg.label}: ${cfg.titleOf(row)}`, body.comment ? { comment: body.comment } : undefined);
        res.json({ id: row.id, workflow: workflowInfo(updated) });
      }),
    );
  };

  transition('SUBMIT', 'workflow.submit', ['DRAFT', 'REJECTED'], 'IN_REVIEW', commentSchema, (_b, req) => ({ submittedAt: new Date(), submittedById: req.user!.id, reviewComment: null }));
  transition('APPROVE', 'workflow.review', ['IN_REVIEW'], 'APPROVED', commentSchema, (b, req) => ({ reviewedAt: new Date(), reviewedById: req.user!.id, reviewComment: b.comment ?? null }));
  transition('REJECT', 'workflow.review', ['IN_REVIEW', 'APPROVED'], 'REJECTED', rejectSchema, (b, req) => ({ reviewedAt: new Date(), reviewedById: req.user!.id, reviewComment: b.comment, scheduledPublishAt: null }));

  doc({ method: 'post', path: `${base}/:id/publish`, tag, summary: 'Workflow: publish now, or schedule when `scheduledPublishAt` is in the future', auth: true, permission: 'workflow.publish', body: publishSchema });
  r.post(
    '/:id/publish',
    requirePermission('workflow.publish'),
    ah(async (req, res) => {
      const body = parse(publishSchema, req.body ?? {});
      const row = await load(req.params.id!);
      // Publishers who can also review may approve-and-publish an item that is in review.
      const allowed = row.status === 'APPROVED' || (row.status === 'IN_REVIEW' && can(req, 'workflow.review'));
      if (!allowed) throw new HttpError(409, 'INVALID_TRANSITION', 'Only approved content can be published');
      if (body.scheduledPublishAt && body.scheduledPublishAt.getTime() > Date.now() + 30_000) {
        const updated = await cfg.delegate().update({
          where: { id: row.id },
          data: { status: 'APPROVED', scheduledPublishAt: body.scheduledPublishAt, reviewedAt: row.reviewedAt ?? new Date(), reviewedById: row.reviewedById ?? req.user!.id },
        });
        await logTransition(cfg, row.id, 'SCHEDULE', row.status, 'APPROVED', req.user!.id, `Scheduled for ${body.scheduledPublishAt.toISOString()}`);
        await audit(req, `${cfg.type}.schedule`, cfg.type, row.id, `Scheduled ${cfg.label}: ${cfg.titleOf(row)}`);
        return res.json({ id: row.id, workflow: workflowInfo(updated) });
      }
      const updated = await publishEntity(cfg, row.id, req.user!.id, body.comment);
      await audit(req, `${cfg.type}.publish`, cfg.type, row.id, `Published ${cfg.label}: ${cfg.titleOf(row)}`);
      res.json({ id: row.id, workflow: workflowInfo(updated) });
    }),
  );

  doc({ method: 'post', path: `${base}/:id/unpublish`, tag, summary: 'Workflow: remove from the public website', auth: true, permission: 'workflow.publish' });
  r.post(
    '/:id/unpublish',
    requirePermission('workflow.publish'),
    ah(async (req, res) => {
      const row = await load(req.params.id!);
      if (row.publishedData == null) throw badRequest('This item is not published');
      const updated = await cfg.delegate().update({ where: { id: row.id }, data: { publishedData: Prisma.DbNull, status: 'DRAFT', scheduledPublishAt: null } });
      await logTransition(cfg, row.id, 'UNPUBLISH', row.status, 'DRAFT', req.user!.id);
      await audit(req, `${cfg.type}.unpublish`, cfg.type, row.id, `Unpublished ${cfg.label}: ${cfg.titleOf(row)}`);
      invalidatePublic();
      res.json({ id: row.id, workflow: workflowInfo(updated) });
    }),
  );

  // ── History ──
  doc({ method: 'get', path: `${base}/:id/revisions`, tag, summary: 'Revision history', auth: true, permission: 'revisions.view' });
  r.get(
    '/:id/revisions',
    requirePermission('revisions.view'),
    ah(async (req, res) => {
      const [revisions, log] = await Promise.all([
        prisma.revision.findMany({ where: { entityType: cfg.type, entityId: req.params.id! }, orderBy: { version: 'desc' }, take: 100 }),
        prisma.publicationLog.findMany({ where: { entityType: cfg.type, entityId: req.params.id! }, orderBy: { createdAt: 'desc' }, take: 100 }),
      ]);
      const names = await userNames([...revisions.map((r) => ({ createdById: r.createdById })), ...log]);
      res.json({
        revisions: revisions.map((r) => ({ ...r, createdByName: names[r.createdById ?? ''] ?? (r.createdById ? null : 'System') })),
        publicationLog: log.map((l) => ({ ...l, userName: names[l.userId ?? ''] ?? (l.userId ? null : 'System') })),
      });
    }),
  );

  doc({ method: 'post', path: `${base}/:id/revisions/:revisionId/restore`, tag, summary: 'Restore a previous version into the working copy (as a draft)', auth: true, permission: 'revisions.restore' });
  r.post(
    '/:id/revisions/:revisionId/restore',
    requirePermission('revisions.restore'),
    ah(async (req, res) => {
      const row = await load(req.params.id!);
      assertCanEdit(req, row);
      const rev = await prisma.revision.findFirst({ where: { id: req.params.revisionId!, entityType: cfg.type, entityId: row.id } });
      if (!rev) throw notFound('Revision');
      const data = Object.fromEntries(cfg.editableFields.map((f) => [f, (rev.data as any)[f] ?? null]));
      const updated = await cfg.delegate().update({ where: { id: row.id }, data: { ...data, status: 'DRAFT', updatedById: req.user!.id } });
      await writeRevision(cfg, updated, 'RESTORE', req.user!.id, `Restored version ${rev.version}`);
      await audit(req, `${cfg.type}.restore`, cfg.type, row.id, `Restored version ${rev.version} of ${cfg.titleOf(row)}`);
      res.json({ ok: true, workflow: workflowInfo(updated) });
    }),
  );

  // ── Preview ──
  doc({ method: 'post', path: `${base}/:id/preview`, tag, summary: 'Get a short-lived preview link for the working copy', auth: true, permission: P('view') });
  r.post(
    '/:id/preview',
    requirePermission(P('view')),
    ah(async (req, res) => {
      const row = await load(req.params.id!);
      const path = cfg.publicPath?.(row);
      if (!path) throw badRequest('This content does not have its own page to preview');
      const token = signPreviewToken(req.user!.id);
      res.json({ url: `${(await system()).publicUrl}/cms-hooks/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}` });
    }),
  );

  return r;
}
