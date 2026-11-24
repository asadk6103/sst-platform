import { Router, type Request } from 'express';
import { z, type AnyZodObject } from 'zod';
import { ICON_NAMES, SETTINGS_GROUPS, SETTINGS_MAP, settingsSchema } from '@sst/shared';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, notFound, parse } from '../../lib/http';
import { paged, parseList, slugify, slugSchema } from '../../lib/query';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { invalidatePublic } from '../../lib/cache';
import { requirePermission } from '../../middleware/auth';

/**
 * Non-workflow website modules: documents, galleries, statistics, navigation and settings.
 * These publish via an explicit "published/visible" flag and are fully audited.
 */
export const siteRouter = Router();
const optText = (max = 300) => z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v));

/** Modules with only view/edit permissions (create & delete use "edit"). */
const EDIT_ONLY = ['statistics', 'navigation', 'faqs', 'categories'];

/** Generic CRUD for simple tables. */
function crud(opts: {
  path: string;
  tag: string;
  module: string;
  entity: string;
  delegate: () => any;
  schema: AnyZodObject;
  search: string[];
  sortable: string[];
  defaultSort: string;
  softDelete?: boolean;
  include?: object;
  filter?: (q: any) => object;
  prepare?: (data: any, id?: string) => Promise<any> | any;
  label: (row: any) => string;
}) {
  const base = `/api/admin/${opts.path}`;
  const P = (a: string) => `${opts.module}.${a}`;
  const r = Router();
  const alive = opts.softDelete ? { deletedAt: null } : {};

  doc({ method: 'get', path: base, tag: opts.tag, summary: `List ${opts.tag}`, auth: true, permission: P('view') });
  r.get(
    '/',
    requirePermission(P('view')),
    ah(async (req, res) => {
      const q = parseList(req.query, opts.sortable, opts.defaultSort);
      const where: any = { ...alive, ...(opts.filter?.(req.query) ?? {}) };
      if (q.search) where.OR = opts.search.map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
      const [items, total] = await Promise.all([
        opts.delegate().findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take, include: opts.include }),
        opts.delegate().count({ where }),
      ]);
      res.json(paged(items, total, q));
    }),
  );
  doc({ method: 'get', path: `${base}/:id`, tag: opts.tag, summary: `Get one`, auth: true, permission: P('view') });
  r.get(
    '/:id',
    requirePermission(P('view')),
    ah(async (req, res) => {
      const row = await opts.delegate().findFirst({ where: { id: req.params.id, ...alive }, include: opts.include });
      if (!row) throw notFound(opts.tag);
      res.json(row);
    }),
  );
  doc({ method: 'post', path: base, tag: opts.tag, summary: `Create`, auth: true, permission: P(EDIT_ONLY.includes(opts.module) ? 'edit' : 'create'), body: opts.schema });
  r.post(
    '/',
    requirePermission(P(EDIT_ONLY.includes(opts.module) ? 'edit' : 'create')),
    ah(async (req, res) => {
      let data = parse(opts.schema, req.body);
      if (opts.prepare) data = await opts.prepare(data);
      const extra = opts.softDelete ? { createdById: req.user!.id, updatedById: req.user!.id } : { updatedById: req.user!.id };
      const row = await opts.delegate().create({ data: { ...data, ...extra } });
      await audit(req, `${opts.entity}.create`, opts.entity, row.id, `Created ${opts.tag}: ${opts.label(row)}`);
      invalidatePublic();
      res.status(201).json(row);
    }),
  );
  doc({ method: 'put', path: `${base}/:id`, tag: opts.tag, summary: `Update`, auth: true, permission: P('edit'), body: opts.schema });
  r.put(
    '/:id',
    requirePermission(P('edit')),
    ah(async (req, res) => {
      let data = parse(opts.schema, req.body);
      if (opts.prepare) data = await opts.prepare(data, req.params.id);
      const row = await opts.delegate().update({ where: { id: req.params.id, ...alive }, data: { ...data, updatedById: req.user!.id } });
      await audit(req, `${opts.entity}.update`, opts.entity, row.id, `Updated ${opts.tag}: ${opts.label(row)}`);
      invalidatePublic();
      res.json(row);
    }),
  );
  doc({ method: 'delete', path: `${base}/:id`, tag: opts.tag, summary: `Delete`, auth: true, permission: P(EDIT_ONLY.includes(opts.module) ? 'edit' : 'delete') });
  r.delete(
    '/:id',
    requirePermission(P(EDIT_ONLY.includes(opts.module) ? 'edit' : 'delete')),
    ah(async (req, res) => {
      const row = opts.softDelete
        ? await opts.delegate().update({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date(), isPublished: false } })
        : await opts.delegate().delete({ where: { id: req.params.id } });
      await audit(req, `${opts.entity}.delete`, opts.entity, row.id, `Deleted ${opts.tag}: ${opts.label(row)}`);
      invalidatePublic();
      res.json({ ok: true });
    }),
  );
  return r;
}

async function uniqueSlug(model: 'document' | 'gallery', base: string, exceptId?: string) {
  let slug = slugify(base) || 'item';
  for (let i = 2; ; i++) {
    const found = await (prisma[model] as any).findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
    if (!found) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

// ── Documents & downloads ──
siteRouter.use(
  '/documents',
  crud({
    path: 'documents',
    tag: 'Documents',
    module: 'documents',
    entity: 'document',
    delegate: () => prisma.document,
    schema: z.object({
      title: z.string().trim().min(1).max(200),
      slug: slugSchema.optional(),
      description: optText(1000),
      category: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Choose a category'),
      fileId: z.string().uuid(),
      publishedDate: z.coerce.date().nullable().optional(),
      sortOrder: z.coerce.number().int().default(0),
      isPublished: z.boolean().default(false),
    }),
    search: ['title', 'description'],
    sortable: ['title', 'sortOrder', 'publishedDate', 'updatedAt', 'category'],
    defaultSort: 'sortOrder',
    softDelete: true,
    filter: (q) => (q.category ? { category: q.category } : {}),
    prepare: async (d, id) => {
      const file = await prisma.media.findFirst({ where: { id: d.fileId, deletedAt: null } });
      if (!file) throw badRequest('Selected file does not exist');
      return { ...d, slug: await uniqueSlug('document', d.slug || d.title, id) };
    },
    label: (r) => r.title,
  }),
);

// ── Galleries ──
const galleryRouter = crud({
  path: 'galleries',
  tag: 'Galleries',
  module: 'galleries',
  entity: 'gallery',
  delegate: () => prisma.gallery,
  schema: z.object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema.optional(),
    description: optText(1000),
    category: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Choose a category'),
    coverImageId: z.string().uuid().nullable().optional(),
    eventDate: z.coerce.date().nullable().optional(),
    isFeatured: z.boolean().default(false),
    videos: z
      .array(z.object({ title: z.string().trim().min(1).max(200), url: z.string().url().max(500).or(z.literal('')).default(''), thumbnailId: z.string().uuid().nullable().optional(), duration: optText(20) }))
      .max(50)
      .default([]),
    sortOrder: z.coerce.number().int().default(0),
    isPublished: z.boolean().default(false),
  }),
  search: ['title', 'description'],
  sortable: ['title', 'sortOrder', 'updatedAt', 'category'],
  defaultSort: 'sortOrder',
  softDelete: true,
  include: { images: { orderBy: { sortOrder: 'asc' } }, _count: { select: { images: true } } },
  filter: (q) => (q.category ? { category: q.category } : {}),
  prepare: async (d, id) => ({ ...d, slug: await uniqueSlug('gallery', d.slug || d.title, id) }),
  label: (r) => r.title,
});
const imagesSchema = z.object({
  images: z.array(z.object({ mediaId: z.string().uuid(), caption: optText(300) })).max(500),
});
doc({ method: 'put', path: '/api/admin/galleries/:id/images', tag: 'Galleries', summary: 'Replace the ordered list of gallery images', auth: true, permission: 'galleries.edit', body: imagesSchema });
galleryRouter.put(
  '/:id/images',
  requirePermission('galleries.edit'),
  ah(async (req, res) => {
    const { images } = parse(imagesSchema, req.body);
    const g = await prisma.gallery.findFirst({ where: { id: req.params.id!, deletedAt: null } });
    if (!g) throw notFound('Gallery');
    await prisma.$transaction([
      prisma.galleryImage.deleteMany({ where: { galleryId: g.id } }),
      prisma.galleryImage.createMany({ data: images.map((im, i) => ({ galleryId: g.id, mediaId: im.mediaId, caption: im.caption ?? null, sortOrder: i })) }),
    ]);
    await audit(req, 'gallery.images', 'gallery', g.id, `Updated images of gallery ${g.title}`, { count: images.length });
    invalidatePublic();
    res.json({ ok: true });
  }),
);
siteRouter.use('/galleries', galleryRouter);

// ── Statistics ──
siteRouter.use(
  '/statistics',
  crud({
    path: 'statistics',
    tag: 'Statistics',
    module: 'statistics',
    entity: 'statistic',
    delegate: () => prisma.statistic,
    schema: z.object({
      key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/),
      group: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
      label: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(60),
      description: optText(300),
      icon: z.enum(ICON_NAMES).nullable().optional(),
      sortOrder: z.coerce.number().int().default(0),
      isPublished: z.boolean().default(true),
    }),
    search: ['label', 'key', 'value'],
    sortable: ['group', 'sortOrder', 'label', 'updatedAt'],
    defaultSort: 'sortOrder',
    filter: (q) => (q.group ? { group: q.group } : {}),
    label: (r) => `${r.label} (${r.value})`,
  }),
);

// ── Navigation ──
const NAV_MENUS = ['MAIN', 'UTILITY', 'ABOUT_SIDEBAR', 'FOOTER_QUICK', 'FOOTER_USEFUL', 'FOOTER_LEGAL'] as const;
const navRouter = crud({
  path: 'navigation',
  tag: 'Navigation',
  module: 'navigation',
  entity: 'navigation',
  delegate: () => prisma.navigationItem,
  schema: z.object({
    menu: z.enum(NAV_MENUS),
    label: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(400).refine((v) => /^(\/|#|https?:\/\/|mailto:|tel:)/.test(v), 'Must be a path starting with / or a full URL'),
    icon: z.enum(ICON_NAMES).nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    sortOrder: z.coerce.number().int().default(0),
    isVisible: z.boolean().default(true),
    isComingSoon: z.boolean().default(false),
    openInNewTab: z.boolean().default(false),
  }),
  search: ['label', 'href'],
  sortable: ['menu', 'sortOrder', 'label'],
  defaultSort: 'sortOrder',
  filter: (q) => (q.menu ? { menu: q.menu } : {}),
  prepare: async (d, id) => {
    if (d.parentId) {
      if (d.parentId === id) throw badRequest('An item cannot be its own parent');
      const parent = await prisma.navigationItem.findUnique({ where: { id: d.parentId } });
      if (!parent || parent.menu !== d.menu) throw badRequest('Parent must belong to the same menu');
      if (parent.parentId) {
        const grand = await prisma.navigationItem.findUnique({ where: { id: parent.parentId } });
        if (grand?.parentId) throw badRequest('Navigation supports up to three levels');
      }
    }
    return d;
  },
  label: (r) => `${r.menu} › ${r.label}`,
});
doc({ method: 'post', path: '/api/admin/navigation/reorder', tag: 'Navigation', summary: 'Set display order', auth: true, permission: 'navigation.edit', body: z.object({ ids: z.array(z.string().uuid()) }) });
navRouter.post(
  '/reorder',
  requirePermission('navigation.edit'),
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(300) }), req.body);
    await prisma.$transaction(ids.map((id, i) => prisma.navigationItem.update({ where: { id }, data: { sortOrder: i + 1 } })));
    await audit(req, 'navigation.reorder', 'navigation');
    invalidatePublic();
    res.json({ ok: true });
  }),
);
siteRouter.use('/navigation', navRouter);

// ── Categories (per-section managed lists) ──
export const CATEGORY_SCOPES = ['news', 'events', 'announcements', 'achievements', 'gallery', 'documents', 'faq', 'departments', 'job-types'] as const;
siteRouter.use(
  '/categories',
  crud({
    path: 'categories',
    tag: 'Categories',
    module: 'categories',
    entity: 'category',
    delegate: () => prisma.category,
    schema: z.object({
      scope: z.enum(CATEGORY_SCOPES),
      name: z.string().trim().min(1).max(80),
      slug: slugSchema.optional(),
      icon: z.enum(ICON_NAMES).nullable().optional(),
      sortOrder: z.coerce.number().int().default(0),
    }),
    search: ['name', 'slug'],
    sortable: ['scope', 'sortOrder', 'name'],
    defaultSort: 'sortOrder',
    filter: (q) => (q.scope ? { scope: q.scope } : {}),
    prepare: (d) => ({ ...d, slug: d.slug || slugify(d.name) }),
    label: (r) => `${r.scope} › ${r.name}`,
  }),
);

// ── FAQs ──
siteRouter.use(
  '/faqs',
  crud({
    path: 'faqs',
    tag: 'FAQs',
    module: 'faqs',
    entity: 'faq',
    delegate: () => prisma.faq,
    schema: z.object({
      category: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Choose a category'),
      question: z.string().trim().min(1).max(300),
      answer: z.string().trim().min(1).max(5000),
      sortOrder: z.coerce.number().int().default(0),
      isPublished: z.boolean().default(true),
    }),
    search: ['question', 'answer'],
    sortable: ['category', 'sortOrder', 'question', 'updatedAt'],
    defaultSort: 'sortOrder',
    filter: (q) => (q.category ? { category: q.category } : {}),
    label: (r) => r.question,
  }),
);

// ── Settings (identity, theme, contact, social, SEO, website) ──
doc({ method: 'get', path: '/api/admin/settings', tag: 'Settings', summary: 'All settings groups with their definitions', auth: true, permission: 'settings.view' });
siteRouter.get(
  '/settings',
  requirePermission('settings.view'),
  ah(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(SETTINGS_GROUPS.map((g) => ({ ...g, value: values[g.key] ?? {} })));
  }),
);

doc({ method: 'put', path: '/api/admin/settings/:key', tag: 'Settings', summary: 'Update one settings group', auth: true, permission: 'settings.edit' });
siteRouter.put(
  '/settings/:key',
  requirePermission('settings.edit'),
  ah(async (req: Request, res) => {
    const key = req.params.key!;
    if (!SETTINGS_MAP[key]) throw notFound('Settings group');
    const value = parse(settingsSchema(key), req.body);
    if (key === 'theme' && value.preset === 'custom' && !value.primary) throw badRequest('Choose a custom primary colour');
    const before = await prisma.setting.findUnique({ where: { key } });
    const row = await prisma.setting.upsert({ where: { key }, update: { value, updatedById: req.user!.id }, create: { key, value, updatedById: req.user!.id } });
    await prisma.revision.create({
      data: {
        entityType: 'setting',
        entityId: key,
        version: (await prisma.revision.count({ where: { entityType: 'setting', entityId: key } })) + 1,
        action: 'SAVE',
        data: value,
        createdById: req.user!.id,
      },
    });
    await audit(req, 'settings.update', 'setting', key, `Updated ${SETTINGS_MAP[key]!.name}`, { before: before?.value, after: value });
    invalidatePublic();
    res.json(row);
  }),
);
