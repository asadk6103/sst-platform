import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, notFound, parse } from '../../lib/http';
import { cached } from '../../lib/cache';
import { doc } from '../../lib/openapi';
import { postsConfig, eventsConfig, facultyConfig, resultsConfig, vacanciesConfig } from '../content/entities';
import { data, documentDictionary, hydrate, isPreview, LIVE, respond, visible, facultyFilters } from './public.routes';

/** Data-driven listings for the public website (published content only). */
export const listsRouter = Router();
const tag = 'Public lists';
const pageQ = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(60).default(9) };
const pagination = (q: { page: number; pageSize: number }, total: number) => ({ page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) });
const strip = ({ body, ...rest }: any) => rest;
const yearRange = (year?: number, field = 'publicationDate') => (year ? { [field]: { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${year + 1}-01-01T00:00:00Z`) } } : {});
const ci = (v: string) => ({ equals: v, mode: 'insensitive' as const });

async function categoryCounts(scope: string, rows: { category: string | null }[]) {
  const cats = await prisma.category.findMany({ where: { scope }, orderBy: { sortOrder: 'asc' } });
  return cats.map((c) => ({ name: c.name, slug: c.slug, icon: c.icon, count: rows.filter((r) => r.category && (r.category.toLowerCase() === c.name.toLowerCase() || r.category === c.slug)).length }));
}
async function categoryName(scope: string, slug?: string) {
  if (!slug) return undefined;
  return (await prisma.category.findFirst({ where: { scope, slug } }))?.name ?? slug;
}

// ─────────────── News / announcements / achievements ───────────────
const KIND: Record<string, 'NEWS' | 'ANNOUNCEMENT' | 'ACHIEVEMENT'> = { news: 'NEWS', announcements: 'ANNOUNCEMENT', achievements: 'ACHIEVEMENT' };
const postsQuery = z.object({ ...pageQ, kind: z.enum(['news', 'announcements', 'achievements']).default('news'), category: z.string().max(80).optional(), search: z.string().trim().max(100).optional(), year: z.coerce.number().int().optional() });

doc({ method: 'get', path: '/api/public/posts', tag, summary: 'News, announcements or achievements with category counts, featured item and popular list', query: postsQuery });
listsRouter.get(
  '/posts',
  ah(async (req, res) => {
    const q = parse(postsQuery, req.query);
    const preview = isPreview(req);
    res.json(
      await respond(req, `posts:${JSON.stringify(q)}`, async () => {
        const kind = KIND[q.kind]!;
        const scope = q.kind;
        const base = { ...visible(preview), kind };
        const catName = await categoryName(scope, q.category);
        const where: any = { ...base, ...(catName ? { category: ci(catName) } : {}), ...yearRange(q.year) };
        if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { excerpt: { contains: q.search, mode: 'insensitive' } }];
        const filtered = !!(q.search || q.category || q.year);
        const featuredRow = filtered || q.page > 1 ? null : await prisma.post.findFirst({ where: { ...base, isFeatured: true }, orderBy: { publicationDate: 'desc' } });
        // Exclude the featured item with its own AND clause (merging into the existing NOT would change its meaning).
        if (featuredRow) where.AND = [...(where.AND ?? []), { NOT: { id: featuredRow.id } }];
        const [rows, total, all, popularRows, years] = await Promise.all([
          prisma.post.findMany({ where, orderBy: { publicationDate: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
          prisma.post.count({ where }),
          prisma.post.findMany({ where: base, select: { category: true } }),
          prisma.post.findMany({ where: base, orderBy: [{ views: 'desc' }, { publicationDate: 'desc' }], take: 3 }),
          prisma.post.findMany({ where: base, select: { publicationDate: true } }),
        ]);
        const ser = (r: any) => data(postsConfig, r, preview).then(strip);
        return hydrate({
          featured: featuredRow ? await ser(featuredRow) : null,
          items: await Promise.all(rows.map(ser)),
          pagination: pagination(q, total),
          categories: await categoryCounts(scope, all),
          popular: await Promise.all(popularRows.map(ser)),
          years: [...new Set(years.map((y) => y.publicationDate.getFullYear()))].sort((a, b) => b - a),
          recent: kind === 'ANNOUNCEMENT' ? await Promise.all((await prisma.post.findMany({ where: { ...base, publicationDate: { gte: new Date(Date.now() - 21 * 86400_000) } }, orderBy: { publicationDate: 'desc' }, take: 3 })).map(ser)) : [],
        });
      }),
    );
  }),
);

doc({ method: 'get', path: '/api/public/posts/:slug', tag, summary: 'One published news item / announcement / achievement' });
listsRouter.get(
  '/posts/:slug',
  ah(async (req, res) => {
    const preview = isPreview(req);
    const body = await respond(req, `post:${req.params.slug}`, async () => {
      const row = await prisma.post.findFirst({ where: { slug: req.params.slug!, ...visible(preview) } });
      if (!row) return null;
      const related = await prisma.post.findMany({ where: { ...visible(preview), kind: row.kind, NOT: { id: row.id } }, orderBy: { publicationDate: 'desc' }, take: 3 });
      const all = await prisma.post.findMany({ where: { ...visible(preview), kind: row.kind }, select: { category: true } });
      const scope = Object.entries(KIND).find(([, k]) => k === row.kind)![0];
      return hydrate({ post: await data(postsConfig, row, preview), related: await Promise.all(related.map((r) => data(postsConfig, r, preview).then(strip))), categories: await categoryCounts(scope, all) });
    });
    if (!body) throw notFound('Article');
    res.json(body);
  }),
);

doc({ method: 'post', path: '/api/public/posts/:slug/view', tag, summary: 'Count a page view (for "Popular news")' });
listsRouter.post(
  '/posts/:slug/view',
  ah(async (req, res) => {
    await prisma.post.updateMany({ where: { slug: req.params.slug!, ...LIVE }, data: { views: { increment: 1 } } });
    res.status(204).end();
  }),
);

// ─────────────── Events ───────────────
const eventsQuery = z.object({ ...pageQ, pageSize: z.coerce.number().int().min(1).max(60).default(4), when: z.enum(['all', 'upcoming', 'past']).default('all'), category: z.string().max(80).optional(), search: z.string().trim().max(100).optional(), year: z.coerce.number().int().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

doc({ method: 'get', path: '/api/public/events', tag, summary: 'Events: featured, upcoming, past, a month calendar and category counts', query: eventsQuery });
listsRouter.get(
  '/events',
  ah(async (req, res) => {
    const q = parse(eventsQuery, req.query);
    const preview = isPreview(req);
    res.json(
      await respond(req, `events:${JSON.stringify(q)}`, async () => {
        const now = new Date();
        const base: any = { ...visible(preview) };
        const catName = await categoryName('events', q.category);
        const filter: any = { ...base, ...(catName ? { category: ci(catName) } : {}), ...yearRange(q.year, 'startDate') };
        if (q.search) filter.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { location: { contains: q.search, mode: 'insensitive' } }];
        const upcomingWhere = { ...filter, startDate: { ...(filter.startDate ?? {}), gte: new Date(now.toDateString()) } };
        const pastWhere = { ...filter, startDate: { ...(filter.startDate ?? {}), lt: new Date(now.toDateString()) } };
        const [m, y] = q.month ? [Number(q.month.slice(5)), Number(q.month.slice(0, 4))] : [now.getMonth() + 1, now.getFullYear()];
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd = new Date(Date.UTC(y, m, 1));
        const ser = (r: any) => data(eventsConfig, r, preview).then(strip);
        const [featured, upcoming, past, upTotal, pastTotal, month, all, years] = await Promise.all([
          prisma.event.findFirst({ where: { ...base, isFeatured: true, startDate: { gte: new Date(now.toDateString()) } }, orderBy: { startDate: 'asc' } }),
          prisma.event.findMany({ where: upcomingWhere, orderBy: { startDate: 'asc' }, skip: q.when === 'upcoming' ? (q.page - 1) * q.pageSize : 0, take: q.pageSize }),
          prisma.event.findMany({ where: pastWhere, orderBy: { startDate: 'desc' }, skip: q.when === 'past' ? (q.page - 1) * q.pageSize : 0, take: q.pageSize }),
          prisma.event.count({ where: upcomingWhere }),
          prisma.event.count({ where: pastWhere }),
          prisma.event.findMany({ where: { ...base, startDate: { lt: monthEnd }, OR: [{ startDate: { gte: monthStart } }, { endDate: { gte: monthStart } }] }, select: { slug: true, title: true, startDate: true, endDate: true } }),
          prisma.event.findMany({ where: base, select: { category: true } }),
          prisma.event.findMany({ where: base, select: { startDate: true } }),
        ]);
        return hydrate({
          featured: featured ? await ser(featured) : null,
          upcoming: await Promise.all(upcoming.map(ser)),
          past: await Promise.all(past.map(ser)),
          pagination: { upcoming: pagination(q, upTotal), past: pagination(q, pastTotal) },
          month: { year: y, month: m, events: month },
          highlights: await Promise.all((await prisma.event.findMany({ where: { ...base, startDate: { gte: new Date(now.toDateString()) } }, orderBy: { startDate: 'asc' }, take: 3 })).map(ser)),
          categories: await categoryCounts('events', all),
          years: [...new Set(years.map((e) => e.startDate.getFullYear()))].sort((a, b) => b - a),
        });
      }),
    );
  }),
);

doc({ method: 'get', path: '/api/public/events/:slug', tag, summary: 'One published event' });
listsRouter.get(
  '/events/:slug',
  ah(async (req, res) => {
    const preview = isPreview(req);
    const body = await respond(req, `event:${req.params.slug}`, async () => {
      const row = await prisma.event.findFirst({ where: { slug: req.params.slug!, ...visible(preview) } });
      if (!row) return null;
      const more = await prisma.event.findMany({ where: { ...visible(preview), NOT: { id: row.id }, startDate: { gte: new Date(new Date().toDateString()) } }, orderBy: { startDate: 'asc' }, take: 3 });
      return hydrate({ event: await data(eventsConfig, row, preview), related: await Promise.all(more.map((r) => data(eventsConfig, r, preview).then(strip))) });
    });
    if (!body) throw notFound('Event');
    res.json(body);
  }),
);

// ─────────────── Gallery ───────────────
const galleryQuery = z.object({ ...pageQ, pageSize: z.coerce.number().int().min(1).max(60).default(8), category: z.string().max(60).optional(), year: z.coerce.number().int().optional(), search: z.string().trim().max(100).optional() });
doc({ method: 'get', path: '/api/public/galleries', tag, summary: 'Published albums with featured album, videos and totals', query: galleryQuery });
listsRouter.get(
  '/galleries',
  ah(async (req, res) => {
    const q = parse(galleryQuery, req.query);
    res.json(
      await cached(`galleries:${JSON.stringify(q)}`, async () => {
        const base = { isPublished: true, deletedAt: null };
        const where: any = { ...base, ...(q.category ? { category: q.category } : {}), ...yearRange(q.year, 'eventDate') };
        if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
        const shape = ({ createdById, updatedById, deletedAt, _count, ...g }: any) => ({ ...g, imageCount: _count?.images ?? 0 });
        const [rows, total, featured, all] = await Promise.all([
          prisma.gallery.findMany({ where, orderBy: [{ eventDate: 'desc' }, { sortOrder: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { _count: { select: { images: true } } } }),
          prisma.gallery.count({ where }),
          prisma.gallery.findFirst({ where: { ...base, isFeatured: true }, orderBy: { eventDate: 'desc' }, include: { _count: { select: { images: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 8 } } }),
          prisma.gallery.findMany({ where: base, select: { category: true, eventDate: true, videos: true, _count: { select: { images: true } } } }),
        ]);
        const videos = all.flatMap((g) => (Array.isArray(g.videos) ? (g.videos as any[]) : []));
        return hydrate({
          featured: featured ? shape(featured) : null,
          items: rows.map(shape),
          pagination: pagination(q, total),
          stats: { albums: all.length, photos: all.reduce((n, g) => n + g._count.images, 0), videos: videos.length },
          videos: videos.slice(0, 6),
          categories: await categoryCounts('gallery', all),
          years: [...new Set(all.map((g) => g.eventDate?.getFullYear()).filter(Boolean))].sort((a: any, b: any) => b - a),
        });
      }),
    );
  }),
);

doc({ method: 'get', path: '/api/public/galleries/:slug', tag, summary: 'One published album with images' });
listsRouter.get(
  '/galleries/:slug',
  ah(async (req, res) => {
    const body = await cached(`gallery:${req.params.slug}`, async () => {
      const g = await prisma.gallery.findFirst({ where: { slug: req.params.slug!, isPublished: true, deletedAt: null }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
      if (!g) return null;
      const { createdById, updatedById, deletedAt, ...rest } = g;
      return hydrate({ gallery: rest });
    });
    if (!body) throw notFound('Album');
    res.json(body);
  }),
);

// ─────────────── Downloads ───────────────
const docsQuery = z.object({ ...pageQ, pageSize: z.coerce.number().int().min(1).max(60).default(10), category: z.string().max(60).optional(), year: z.coerce.number().int().optional(), search: z.string().trim().max(100).optional() });
doc({ method: 'get', path: '/api/public/documents', tag, summary: 'Published downloads with category counts', query: docsQuery });
listsRouter.get(
  '/documents',
  ah(async (req, res) => {
    const q = parse(docsQuery, req.query);
    res.json(
      await cached(`documents:${JSON.stringify(q)}`, async () => {
        const base = { isPublished: true, deletedAt: null };
        const where: any = { ...base, ...(q.category ? { category: q.category } : {}), ...yearRange(q.year, 'updatedAt') };
        if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }];
        const [rows, total, all] = await Promise.all([
          prisma.document.findMany({ where, orderBy: [{ updatedAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true } }),
          prisma.document.count({ where }),
          prisma.document.findMany({ where: base, select: { category: true, updatedAt: true } }),
        ]);
        const dict = await documentDictionary(rows.map((r) => r.id));
        return {
          items: rows.map((r) => dict[r.id]).filter(Boolean),
          pagination: pagination(q, total),
          categories: await categoryCounts('documents', all),
          years: [...new Set(all.map((d) => d.updatedAt.getFullYear()))].sort((a, b) => b - a),
        };
      }),
    );
  }),
);

// ─────────────── Faculty ───────────────
const facultyQuery = z.object({ ...pageQ, pageSize: z.coerce.number().int().min(1).max(60).default(12), search: z.string().trim().max(100).optional(), department: z.string().max(120).optional(), programme: z.string().max(150).optional(), designation: z.string().max(150).optional(), sort: z.enum(['name', 'name-desc', 'experience']).default('name') });
doc({ method: 'get', path: '/api/public/faculty', tag, summary: 'Faculty directory with search & filters', query: facultyQuery });
listsRouter.get(
  '/faculty',
  ah(async (req, res) => {
    const q = parse(facultyQuery, req.query);
    const preview = isPreview(req);
    res.json(
      await respond(req, `faculty:${JSON.stringify(q)}`, async () => {
        const where: any = { ...visible(preview), ...(q.department ? { department: q.department } : {}), ...(q.programme ? { programmes: q.programme } : {}), ...(q.designation ? { designation: q.designation } : {}) };
        if (q.search) where.OR = ['fullName', 'subject', 'department', 'designation'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
        const orderBy = q.sort === 'name-desc' ? { fullName: 'desc' as const } : { fullName: 'asc' as const };
        const [rows, total] = await Promise.all([prisma.faculty.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }), prisma.faculty.count({ where })]);
        return hydrate({ items: await Promise.all(rows.map((r) => data(facultyConfig, r, preview))), pagination: pagination(q, total), filters: await facultyFilters() });
      }),
    );
  }),
);

doc({ method: 'get', path: '/api/public/faculty/:slug', tag, summary: 'Faculty profile' });
listsRouter.get(
  '/faculty/:slug',
  ah(async (req, res) => {
    const preview = isPreview(req);
    const body = await respond(req, `faculty:${req.params.slug}`, async () => {
      const row = await prisma.faculty.findFirst({ where: { slug: req.params.slug!, ...visible(preview) } });
      return row && hydrate({ faculty: await data(facultyConfig, row, preview) });
    });
    if (!body) throw notFound('Faculty member');
    res.json(body);
  }),
);

// ─────────────── Examination results ───────────────
const resultQuery = z.object({ exam: z.string().max(100).optional(), year: z.coerce.number().int().optional() });
doc({ method: 'get', path: '/api/public/results', tag, summary: 'One examination result (latest by default) with available exams/years', query: resultQuery });
listsRouter.get(
  '/results',
  ah(async (req, res) => {
    const q = parse(resultQuery, req.query);
    const preview = isPreview(req);
    res.json(
      await respond(req, `results:${JSON.stringify(q)}`, async () => {
        const all = await prisma.examResult.findMany({ where: visible(preview), orderBy: [{ year: 'desc' }, { examination: 'asc' }] });
        const pick = all.find((r) => (!q.exam || r.examination === q.exam) && (!q.year || r.year === q.year)) ?? all.find((r) => !q.exam || r.examination === q.exam) ?? all[0];
        return hydrate({
          result: pick ? await data(resultsConfig, pick, preview) : null,
          options: { examinations: [...new Set(all.map((r) => r.examination))], years: [...new Set(all.map((r) => r.year))] },
        });
      }),
    );
  }),
);

// ─────────────── Vacancies ───────────────
doc({ method: 'get', path: '/api/public/vacancies/:slug', tag, summary: 'One open vacancy' });
listsRouter.get(
  '/vacancies/:slug',
  ah(async (req, res) => {
    const preview = isPreview(req);
    const body = await respond(req, `vacancy:${req.params.slug}`, async () => {
      const row = await prisma.vacancy.findFirst({ where: { slug: req.params.slug!, ...visible(preview) } });
      return row && hydrate({ vacancy: await data(vacanciesConfig, row, preview) });
    });
    if (!body) throw notFound('Vacancy');
    res.json(body);
  }),
);

// ─────────────── Site search ───────────────
doc({ method: 'get', path: '/api/public/search', tag, summary: 'Search pages, news, events, people and faculty', query: z.object({ q: z.string() }) });
listsRouter.get(
  '/search',
  ah(async (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().min(2).max(100) }), req.query);
    res.json(
      await cached(`search:${q.toLowerCase()}`, async () => {
        const has = { contains: q, mode: 'insensitive' as const };
        const [pages, posts, events, people, faculty] = await Promise.all([
          prisma.page.findMany({ where: { ...LIVE, OR: [{ title: has }, { subtitle: has }] }, take: 10, select: { slug: true, title: true, subtitle: true, template: true } }),
          prisma.post.findMany({ where: { ...LIVE, OR: [{ title: has }, { excerpt: has }] }, take: 10, orderBy: { publicationDate: 'desc' }, select: { slug: true, title: true, excerpt: true, kind: true, publicationDate: true } }),
          prisma.event.findMany({ where: { ...LIVE, OR: [{ title: has }, { excerpt: has }] }, take: 5, select: { slug: true, title: true, excerpt: true, startDate: true } }),
          prisma.committeeMember.findMany({ where: { isVisible: true, person: { ...LIVE, fullName: has } }, take: 6, select: { roleTitle: true, committee: { select: { slug: true, name: true } }, person: { select: { slug: true, fullName: true } } } }),
          prisma.faculty.findMany({ where: { ...LIVE, OR: [{ fullName: has }, { subject: has }] }, take: 6, select: { slug: true, fullName: true, designation: true, subject: true } }),
        ]);
        const KP: Record<string, string> = { NEWS: 'news', ANNOUNCEMENT: 'announcements', ACHIEVEMENT: 'achievements' };
        return {
          results: [
            ...pages.filter((p) => p.template !== 'person-profile').map((p) => ({ type: 'Page', title: p.title, text: p.subtitle, href: p.slug === 'home' ? '/' : `/${p.slug}` })),
            ...posts.map((p) => ({ type: KP[p.kind] === 'news' ? 'News' : KP[p.kind] === 'announcements' ? 'Announcement' : 'Achievement', title: p.title, text: p.excerpt, date: p.publicationDate, href: `/news-events/${KP[p.kind]}/${p.slug}` })),
            ...events.map((e) => ({ type: 'Event', title: e.title, text: e.excerpt, date: e.startDate, href: `/news-events/events/${e.slug}` })),
            ...people.map((m) => ({ type: m.committee.name, title: m.person.fullName, text: m.roleTitle, href: `/about/leadership-governance/${m.committee.slug}/${m.person.slug}` })),
            ...faculty.map((f) => ({ type: 'Faculty', title: f.fullName, text: [f.designation, f.subject].filter(Boolean).join(' – '), href: `/academics/faculty/${f.slug}` })),
          ],
        };
      }),
    );
  }),
);
