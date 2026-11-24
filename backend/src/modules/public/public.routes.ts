import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, notFound, parse } from '../../lib/http';
import { cached } from '../../lib/cache';
import { doc } from '../../lib/openapi';
import { collectUuids, mediaDictionary, mediaUrl } from '../../lib/media-refs';
import { messagesConfig, pagesConfig, peopleConfig, postsConfig, eventsConfig, storiesConfig, facultyConfig, resultsConfig, vacanciesConfig } from '../content/entities';
import { verifyPreviewToken } from '../content/content-factory';
import { system } from '../../lib/system';

/**
 * Public, read-only API used by the website. Only published content is returned. A valid
 * preview token (x-preview-token header) switches to working copies for administrators' previews.
 */
export const publicRouter = Router();
const tag = 'Public';

export const isPreview = (req: Request) => verifyPreviewToken(req.get('x-preview-token'));
export const LIVE = { deletedAt: null, NOT: { publishedData: { equals: Prisma.DbNull } } };
export const visible = (preview: boolean) => (preview ? { deletedAt: null } : LIVE);
export const data = async (cfg: { serialize: (r: any) => any }, row: any, preview: boolean) => (preview ? await cfg.serialize(row) : row.publishedData);

/** Resolve referenced documents (only published ones). */
export async function documentDictionary(value: unknown) {
  const ids = [...collectUuids(value)];
  if (!ids.length) return {};
  const docs = await prisma.document.findMany({ where: { id: { in: ids }, isPublished: true, deletedAt: null } });
  const files = await prisma.media.findMany({ where: { id: { in: docs.map((d) => d.fileId) } } });
  const fileMap = new Map(files.map((f) => [f.id, f]));
  return Object.fromEntries(
    docs.map((d) => {
      const f = fileMap.get(d.fileId);
      const ext = f?.originalName.split('.').pop()?.toUpperCase() ?? null;
      return [d.id, { id: d.id, slug: d.slug, title: d.title, description: d.description, category: d.category, url: f ? mediaUrl(f.storageKey, f.revision) : null, size: f?.size ?? null, mimeType: f?.mimeType ?? null, fileType: ext, publishedDate: d.publishedDate, updatedAt: d.updatedAt }];
    }),
  );
}

/** Wraps a response with the media & document dictionaries it references. */
export async function hydrate<T extends object>(body: T) {
  const [media, documents] = await Promise.all([mediaDictionary(body), documentDictionary(body)]);
  return { ...body, media, documents };
}

/** Cache only non-preview responses. */
export const respond = async (req: Request, key: string, fn: () => Promise<unknown>) => (isPreview(req) ? fn() : cached(key, fn));

// ─────────────── Site shell (settings + navigation) ───────────────
async function getSettings() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, any>;
}

doc({ method: 'get', path: '/api/public/site', tag, summary: 'Website settings, theme and navigation menus' });
publicRouter.get(
  '/site',
  ah(async (req, res) => {
    res.json(
      await respond(req, 'site', async () => {
        const [settings, nav, categories] = await Promise.all([
          getSettings(),
          prisma.navigationItem.findMany({ where: { isVisible: true }, orderBy: { sortOrder: 'asc' } }),
          prisma.category.findMany({ orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }], select: { scope: true, name: true, slug: true, icon: true } }),
        ]);
        const menus: Record<string, any[]> = {};
        const tree = (n: (typeof nav)[number]): any => ({
          id: n.id,
          label: n.label,
          href: n.href,
          icon: n.icon,
          isComingSoon: n.isComingSoon,
          openInNewTab: n.openInNewTab,
          children: nav.filter((c) => c.parentId === n.id).map(tree),
        });
        for (const n of nav.filter((n) => !n.parentId)) (menus[n.menu] ??= []).push(tree(n));
        const cats: Record<string, any[]> = {};
        for (const c of categories) (cats[c.scope] ??= []).push({ name: c.name, slug: c.slug, icon: c.icon });
        // Only the public address leaves the server; other system values stay private.
        const { system: _sys, _seedVersion: _v, ...publicSettings } = settings;
        return hydrate({ settings: { ...publicSettings, system: { publicUrl: (await system()).publicUrl } }, navigation: menus, categories: cats });
      }),
    );
  }),
);

// ─────────────── Leadership helpers ───────────────
async function committeeMembers(slug: string, preview: boolean) {
  const committee = await prisma.committee.findUnique({
    where: { slug },
    include: {
      members: {
        where: { isVisible: true, person: visible(preview) },
        orderBy: { sortOrder: 'asc' },
        include: { person: true },
      },
    },
  });
  if (!committee) return null;
  const members = [];
  for (const m of committee.members) {
    const p = await data(peopleConfig, m.person, preview);
    members.push({
      ...p,
      roleTitle: m.roleTitle,
      isHead: m.isHead,
      href: `/about/leadership-governance/${committee.slug}/${m.person.slug}`,
    });
  }
  return { slug: committee.slug, name: committee.name, description: committee.description, profileLabel: committee.profileLabel, members };
}

async function leadershipMessage(key: string, preview: boolean) {
  const m = await prisma.leadershipMessage.findFirst({ where: { key, ...visible(preview) }, include: { person: { include: { memberships: { include: { committee: true }, orderBy: { sortOrder: 'asc' } } } } } });
  if (!m) return null;
  const msg = await data(messagesConfig, m, preview);
  let person = null;
  if (m.person && !m.person.deletedAt && (preview || m.person.publishedData)) {
    const membership = m.person.memberships[0];
    person = {
      ...(await data(peopleConfig, m.person, preview)),
      roleTitle: membership?.roleTitle ?? m.person.designation,
      href: membership ? `/about/leadership-governance/${membership.committee.slug}/${m.person.slug}` : null,
    };
  }
  return { ...msg, person };
}

const MESSAGE_PAGES: Record<string, string> = {
  'about/leadership-governance/chairmans-message': 'chairman',
  'about/leadership-governance/principals-message': 'principal',
};
const COMMITTEE_PAGES: Record<string, string> = {
  'about/leadership-governance/board-of-trustees': 'board-of-trustees',
  'about/leadership-governance/executive-committee': 'executive-committee',
  'about/leadership-governance/school-administration': 'school-administration',
};

async function latestPosts(count: number, preview: boolean, featuredFirst = true) {
  const rows = await prisma.post.findMany({
    where: { ...visible(preview), kind: 'NEWS' },
    orderBy: featuredFirst ? [{ isFeatured: 'desc' }, { publicationDate: 'desc' }] : [{ publicationDate: 'desc' }],
    take: count,
  });
  return Promise.all(rows.map((r) => data(postsConfig, r, preview)));
}

/** Additional data each fixed template needs from other modules. */
async function extrasFor(page: { slug: string; template: string; content: any }, preview: boolean) {
  switch (page.template) {
    case 'home':
      return { news: await latestPosts(Math.min(Number(page.content?.news?.count) || 3, 6), preview) };
    case 'leadership-overview': {
      const [chairman, principal, trustees, executive] = await Promise.all([
        leadershipMessage('chairman', preview),
        leadershipMessage('principal', preview),
        committeeMembers('board-of-trustees', preview),
        committeeMembers('executive-committee', preview),
      ]);
      return { chairman, principal, trustees, executive: executive && { ...executive, members: [] } };
    }
    case 'leadership-message':
      return { message: await leadershipMessage(MESSAGE_PAGES[page.slug] ?? 'chairman', preview) };
    case 'committee-directory':
    case 'executive-committee':
      return { committee: await committeeMembers(COMMITTEE_PAGES[page.slug] ?? '', preview) };
    case 'school-administration':
      return { committee: await committeeMembers('school-administration', preview), principal: await leadershipMessage('principal', preview) };
    case 'our-impact': {
      const [statistics, stories] = await Promise.all([
        prisma.statistic.findMany({ where: { group: 'impact', isPublished: true }, orderBy: { sortOrder: 'asc' } }),
        prisma.story.findMany({ where: { ...visible(preview), kind: { in: ['STUDENT_SUCCESS', 'ALUMNI_STORY', 'SCHOLARSHIP_SUCCESS'] } }, orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }], take: 8 }),
      ]);
      return { statistics, stories: await Promise.all(stories.map((s) => data(storiesConfig, s, preview))) };
    }
    case 'faculty-overview': {
      const rows = await prisma.faculty.findMany({ where: { ...visible(preview), isFeatured: true }, orderBy: [{ sortOrder: 'asc' }, { fullName: 'asc' }], take: 5 });
      return { faculty: await Promise.all(rows.map((r) => data(facultyConfig, r, preview))), filters: await facultyFilters() };
    }
    case 'academic-achievements': {
      const r = await prisma.examResult.findFirst({ where: visible(preview), orderBy: [{ isFeatured: 'desc' }, { year: 'desc' }] });
      return { result: r && (await data(resultsConfig, r, preview)) };
    }
    case 'results-list': {
      const rows = await prisma.examResult.findMany({ where: visible(preview), orderBy: [{ year: 'desc' }, { examination: 'asc' }] });
      return { results: await Promise.all(rows.map((r) => data(resultsConfig, r, preview))) };
    }
    case 'achievement-category': {
      const cat = String(page.content?.achievementCategory ?? '');
      const rows = await prisma.post.findMany({ where: { ...visible(preview), kind: 'ACHIEVEMENT', ...(cat ? { category: { equals: cat, mode: 'insensitive' } } : {}) }, orderBy: { publicationDate: 'desc' }, take: 24 });
      return { posts: await Promise.all(rows.map((r) => data(postsConfig, r, preview))) };
    }
    case 'careers': {
      const rows = await prisma.vacancy.findMany({ where: { ...visible(preview), OR: [{ closingDate: null }, { closingDate: { gte: startOfToday() } }] }, orderBy: [{ isFeatured: 'desc' }, { closingDate: 'asc' }] });
      return { vacancies: await Promise.all(rows.map((r) => data(vacanciesConfig, r, preview))) };
    }
    case 'alumni': {
      const rows = await prisma.story.findMany({ where: { ...visible(preview), kind: 'ALUMNI_STORY' }, orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }], take: 6 });
      return { stories: await Promise.all(rows.map((r) => data(storiesConfig, r, preview))) };
    }
    case 'faqs': {
      const [faqs, cats] = await Promise.all([
        prisma.faq.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: 'asc' }] }),
        prisma.category.findMany({ where: { scope: 'faq' }, orderBy: { sortOrder: 'asc' } }),
      ]);
      return { faqs: faqs.map(({ id, category, question, answer }) => ({ id, category, question, answer })), categories: cats.map((c) => ({ name: c.name, slug: c.slug, icon: c.icon, count: faqs.filter((f) => f.category === c.slug).length })) };
    }
    default:
      return {};
  }
}

const startOfToday = () => new Date(new Date().toDateString());
export async function facultyFilters() {
  const rows = await prisma.faculty.findMany({ where: LIVE, select: { department: true, programmes: true, designation: true } });
  const uniq = (k: 'department' | 'programmes' | 'designation') => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort() as string[];
  return { departments: uniq('department'), programmes: uniq('programmes'), designations: uniq('designation') };
}

// ─────────────── Pages ───────────────
doc({ method: 'get', path: '/api/public/pages/{slug}', tag, summary: 'Published page by slug (slug may contain "/"), plus the data its template needs' });
publicRouter.get(
  /^\/pages\/(.+)$/,
  ah(async (req, res) => {
    const slug = decodeURIComponent((req.params as any)[0]).replace(/^\/+|\/+$/g, '');
    const preview = isPreview(req);
    const body = await respond(req, `page:${slug}`, async () => {
      const row = await prisma.page.findFirst({ where: { slug, ...visible(preview) } });
      if (!row) return null;
      const page = (await data(pagesConfig, row, preview)) as any;
      return hydrate({ page, extras: await extrasFor(page, preview) });
    });
    if (!body) throw notFound('Page');
    res.json(body);
  }),
);

// ─────────────── People / profiles ───────────────
doc({ method: 'get', path: '/api/public/committees/:slug', tag, summary: 'Committee directory (members from role assignments)' });
publicRouter.get(
  '/committees/:slug',
  ah(async (req, res) => {
    const body = await respond(req, `committee:${req.params.slug}`, async () => {
      const c = await committeeMembers(req.params.slug!, isPreview(req));
      return c && hydrate({ committee: c });
    });
    if (!body) throw notFound('Committee');
    res.json(body);
  }),
);

doc({ method: 'get', path: '/api/public/committees/:slug/people/:personSlug', tag, summary: 'Individual profile within a committee' });
publicRouter.get(
  '/committees/:slug/people/:personSlug',
  ah(async (req, res) => {
    const preview = isPreview(req);
    const body = await respond(req, `profile:${req.params.slug}:${req.params.personSlug}`, async () => {
      const person = await prisma.person.findFirst({
        where: { slug: req.params.personSlug!, ...visible(preview), memberships: { some: { isVisible: true, committee: { slug: req.params.slug! } } } },
        include: { memberships: { where: { isVisible: true }, include: { committee: true }, orderBy: { sortOrder: 'asc' } }, messages: true },
      });
      if (!person) return null;
      const current = person.memberships.find((m) => m.committee.slug === req.params.slug)!;
      const labelsRow = await prisma.page.findFirst({ where: { slug: 'about/leadership-governance/profile', ...visible(preview) } });
      const messages = [];
      for (const m of person.messages.filter((m) => !m.deletedAt && (preview || m.publishedData))) {
        const md = (await data(messagesConfig, m, preview)) as any;
        messages.push({ ...md, href: messagesConfig.publicPath!(m) });
      }
      return hydrate({
        person: await data(peopleConfig, person, preview),
        roleTitle: current.roleTitle,
        committee: { slug: current.committee.slug, name: current.committee.name, profileLabel: current.committee.profileLabel },
        roles: person.memberships.map((m) => ({ committee: m.committee.name, committeeSlug: m.committee.slug, roleTitle: m.roleTitle, href: `/about/leadership-governance/${m.committee.slug}/${person.slug}` })),
        messages,
        labels: labelsRow ? ((await data(pagesConfig, labelsRow, preview)) as any).content : {},
      });
    });
    if (!body) throw notFound('Profile');
    res.json(body);
  }),
);

// ─────────────── News, events, stories, statistics ───────────────
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(9) });

doc({ method: 'get', path: '/api/public/stories', tag, summary: 'Published testimonials & success stories', query: z.object({ kind: z.string().optional() }) });
publicRouter.get(
  '/stories',
  ah(async (req, res) => {
    const kinds = req.query.kind ? String(req.query.kind).split(',').slice(0, 6) : undefined;
    const preview = isPreview(req);
    res.json(
      await respond(req, `stories:${kinds?.join(',')}`, async () => {
        const rows = await prisma.story.findMany({ where: { ...visible(preview), ...(kinds ? { kind: { in: kinds as any } } : {}) }, orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }], take: 100 });
        return hydrate({ items: await Promise.all(rows.map((r) => data(storiesConfig, r, preview))) });
      }),
    );
  }),
);

doc({ method: 'get', path: '/api/public/statistics', tag, summary: 'Published statistics', query: z.object({ group: z.string().optional() }) });
publicRouter.get(
  '/statistics',
  ah(async (req, res) => {
    const group = req.query.group ? String(req.query.group).slice(0, 40) : undefined;
    res.json(
      await cached(`stats:${group}`, async () => ({
        items: await prisma.statistic.findMany({ where: { isPublished: true, ...(group ? { group } : {}) }, orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }], select: { key: true, group: true, label: true, value: true, description: true, icon: true } }),
      })),
    );
  }),
);

// ─────────────── Galleries & documents ───────────────
// ─────────────── Sitemap data ───────────────
doc({ method: 'get', path: '/api/public/sitemap', tag, summary: 'All public URLs (for sitemap.xml)' });
publicRouter.get(
  '/sitemap',
  ah(async (_req, res) => {
    res.json(
      await cached('sitemap', async () => {
        const [pages, members, posts, events] = await Promise.all([
          prisma.page.findMany({ where: LIVE, select: { slug: true, publishedAt: true } }),
          prisma.committeeMember.findMany({ where: { isVisible: true, person: LIVE }, select: { committee: { select: { slug: true } }, person: { select: { slug: true, publishedAt: true } } } }),
          prisma.post.findMany({ where: LIVE, select: { slug: true, kind: true, publishedAt: true } }),
          prisma.event.findMany({ where: LIVE, select: { slug: true, publishedAt: true } }),
        ]);
        return {
          urls: [
            ...pages.filter((p) => p.slug !== 'about/leadership-governance/profile').map((p) => ({ path: p.slug === 'home' ? '/' : `/${p.slug}`, lastModified: p.publishedAt })),
            ...members.map((m) => ({ path: `/about/leadership-governance/${m.committee.slug}/${m.person.slug}`, lastModified: m.person.publishedAt })),
            ...posts.map((p) => ({ path: `/news-events/${({ NEWS: 'news', ANNOUNCEMENT: 'announcements', ACHIEVEMENT: 'achievements' } as Record<string, string>)[p.kind]}/${p.slug}`, lastModified: p.publishedAt })),
            ...(await prisma.faculty.findMany({ where: LIVE, select: { slug: true, publishedAt: true } })).map((x) => ({ path: `/academics/faculty/${x.slug}`, lastModified: x.publishedAt })),
            ...(await prisma.vacancy.findMany({ where: LIVE, select: { slug: true, publishedAt: true } })).map((x) => ({ path: `/careers/${x.slug}`, lastModified: x.publishedAt })),
            ...events.map((e) => ({ path: `/news-events/events/${e.slug}`, lastModified: e.publishedAt })),
          ],
        };
      }),
    );
  }),
);
