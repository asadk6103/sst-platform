import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, conflict, notFound, parse } from '../../lib/http';
import { paged, parseList } from '../../lib/query';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { invalidatePublic } from '../../lib/cache';
import { toPublicMedia } from '../../lib/media-refs';
import { stripTags } from '../../lib/sanitize';
import { system } from '../../lib/system';
import { requirePermission } from '../../middleware/auth';
import { archiveOriginal, removeVariants, storeFile } from './storage';

export const mediaRouter = Router();
const base = '/api/admin/media';
const tag = 'Media Library';

const upload = multer({
  storage: multer.memoryStorage(),
  // Hard ceiling here; the configured limit (Administration → System) is checked per file below.
  limits: { fileSize: config.uploadCeilingMb * 1024 * 1024, files: 20 },
});

const withUrls = (m: any) => ({ ...m, ...toPublicMedia(m) });

doc({
  method: 'get',
  path: base,
  tag,
  summary: 'List / search media',
  auth: true,
  permission: 'media.view',
  query: z.object({ search: z.string().optional(), category: z.string().optional(), type: z.enum(['image', 'document']).optional(), page: z.number().optional() }),
});
mediaRouter.get(
  '/',
  requirePermission('media.view'),
  ah(async (req, res) => {
    const q = parseList(req.query, ['createdAt', 'originalName', 'size'], 'createdAt');
    const where: any = { deletedAt: null };
    if (q.search) where.OR = ['originalName', 'title', 'alt', 'caption'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.type === 'image') where.mimeType = { startsWith: 'image/' };
    if (req.query.type === 'document') where.NOT = { mimeType: { startsWith: 'image/' } };
    const [rows, total] = await Promise.all([
      prisma.media.findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take, include: { _count: { select: { usages: true } } } }),
      prisma.media.count({ where }),
    ]);
    res.json(paged(rows.map(withUrls), total, q));
  }),
);

doc({ method: 'get', path: `${base}/categories`, tag, summary: 'Media categories in use', auth: true, permission: 'media.view' });
mediaRouter.get(
  '/categories',
  requirePermission('media.view'),
  ah(async (_req, res) => {
    const rows = await prisma.media.groupBy({ by: ['category'], where: { deletedAt: null }, _count: true, orderBy: { category: 'asc' } });
    res.json(rows.map((r) => ({ category: r.category, count: r._count })));
  }),
);

doc({ method: 'post', path: '/api/admin/media/lookup', tag, summary: 'Resolve several media ids (for previews)', auth: true, permission: 'media.view', body: z.object({ ids: z.array(z.string().uuid()) }) });
mediaRouter.post(
  '/lookup',
  requirePermission('media.view'),
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(200) }), req.body);
    const rows = await prisma.media.findMany({ where: { id: { in: ids } } });
    res.json(Object.fromEntries(rows.map((m) => [m.id, withUrls(m)])));
  }),
);

doc({ method: 'get', path: `${base}/:id`, tag, summary: 'Media details including where it is used', auth: true, permission: 'media.view' });
mediaRouter.get(
  '/:id',
  requirePermission('media.view'),
  ah(async (req, res) => {
    const m = await prisma.media.findFirst({ where: { id: req.params.id!, deletedAt: null }, include: { usages: true } });
    if (!m) throw notFound('Media');
    res.json(withUrls(m));
  }),
);

const metaSchema = z.object({
  alt: z.string().trim().max(300).nullable().optional(),
  caption: z.string().trim().max(500).nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens').optional(),
});

doc({ method: 'post', path: base, tag, summary: 'Upload one or more files (field name "files"; optional category, alt)', auth: true, permission: 'media.create', multipart: true });
mediaRouter.post(
  '/',
  requirePermission('media.create'),
  upload.array('files', 20),
  ah(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw badRequest('No files received');
    const meta = parse(metaSchema, { category: req.body.category || undefined, alt: req.body.alt || undefined });
    const created = [];
    const errors: { file: string; message: string }[] = [];
    const { maxUploadMb } = await system();
    for (const f of files) {
      const id = crypto.randomUUID();
      try {
        if (f.size > maxUploadMb * 1024 * 1024) throw new Error(`File is larger than the ${maxUploadMb} MB limit`);
        const stored = await storeFile(id, f.buffer);
        const m = await prisma.media.create({
          data: {
            id,
            originalName: stripTags(f.originalname).slice(0, 250),
            ...stored,
            alt: meta.alt ?? null,
            category: meta.category ?? (stored.mimeType.startsWith('image/') ? 'general' : 'documents'),
            uploadedById: req.user!.id,
          },
        });
        created.push(withUrls(m));
      } catch (e: any) {
        errors.push({ file: f.originalname, message: e.message });
      }
    }
    if (created.length) await audit(req, 'media.upload', 'media', undefined, `Uploaded ${created.length} file(s)`, { ids: created.map((c) => c.id) });
    if (!created.length) throw badRequest(errors[0]?.message ?? 'Upload failed', errors);
    res.status(201).json({ items: created, errors });
  }),
);

doc({ method: 'put', path: `${base}/:id`, tag, summary: 'Edit alt text, caption, title, category', auth: true, permission: 'media.edit', body: metaSchema });
mediaRouter.put(
  '/:id',
  requirePermission('media.edit'),
  ah(async (req, res) => {
    const data = parse(metaSchema, req.body);
    const m = await prisma.media.update({ where: { id: req.params.id!, deletedAt: null }, data });
    await audit(req, 'media.update', 'media', m.id, `Updated media ${m.originalName}`);
    invalidatePublic();
    res.json(withUrls(m));
  }),
);

doc({ method: 'post', path: `${base}/:id/replace`, tag, summary: 'Replace the file, keeping the same id (all usages update)', auth: true, permission: 'media.edit', multipart: true });
mediaRouter.post(
  '/:id/replace',
  requirePermission('media.edit'),
  upload.single('file'),
  ah(async (req, res) => {
    const old = await prisma.media.findFirst({ where: { id: req.params.id!, deletedAt: null } });
    if (!old) throw notFound('Media');
    if (!req.file) throw badRequest('No file received');
    const { maxUploadMb } = await system();
    if (req.file.size > maxUploadMb * 1024 * 1024) throw badRequest(`File is larger than the ${maxUploadMb} MB limit`);
    const stored = await storeFile(old.id, req.file.buffer, old.revision + 1);
    if (old.mimeType.startsWith('image/') !== stored.mimeType.startsWith('image/')) throw badRequest('Replace an image with an image and a document with a document');
    await archiveOriginal(old.storageKey);
    await removeVariants(old.variants as any[]);
    const m = await prisma.media.update({
      where: { id: old.id },
      data: { ...stored, originalName: stripTags(req.file.originalname).slice(0, 250), revision: old.revision + 1 },
    });
    await audit(req, 'media.replace', 'media', m.id, `Replaced file ${old.originalName} → ${m.originalName}`);
    invalidatePublic();
    res.json(withUrls(m));
  }),
);

doc({ method: 'delete', path: `${base}/:id`, tag, summary: 'Delete media (refused while the item is in use)', auth: true, permission: 'media.delete' });
mediaRouter.delete(
  '/:id',
  requirePermission('media.delete'),
  ah(async (req, res) => {
    const m = await prisma.media.findFirst({ where: { id: req.params.id!, deletedAt: null }, include: { usages: true } });
    if (!m) throw notFound('Media');
    const docs = await prisma.document.count({ where: { fileId: m.id, deletedAt: null } });
    const galleries = await prisma.galleryImage.count({ where: { mediaId: m.id } });
    const settings = (await prisma.setting.findMany()).some((s) => JSON.stringify(s.value).includes(m.id));
    if (m.usages.length || docs || galleries || settings)
      throw conflict(`This file is in use (${[...m.usages.map((u) => u.label ?? u.entityType), docs ? 'documents' : '', galleries ? 'galleries' : '', settings ? 'website settings' : ''].filter(Boolean).join(', ')}). Remove it from that content first.`);
    await prisma.media.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    await audit(req, 'media.delete', 'media', m.id, `Deleted media ${m.originalName}`);
    res.json({ ok: true });
  }),
);
