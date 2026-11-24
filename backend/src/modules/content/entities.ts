import { z } from 'zod';
import { ICON_NAMES, TEMPLATE_MAP, mapRichText, templateSchema } from '@sst/shared';
import { prisma } from '../../lib/prisma';
import { sanitizeRich } from '../../lib/sanitize';
import { slugify, slugSchema } from '../../lib/query';
import { badRequest } from '../../lib/http';
import { createContentRouter, type ContentConfig } from './content-factory';

const optText = (max = 300) => z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v));
const optUuid = z.string().uuid().nullable().optional().or(z.literal('').transform(() => null));
const optDate = z.coerce.date().nullable().optional().or(z.literal('').transform(() => null));

// ─────────────── Pages ───────────────
export const pagesConfig: ContentConfig = {
  type: 'page',
  module: 'pages',
  label: 'Pages',
  path: 'pages',
  delegate: () => prisma.page,
  updateSchema: (row) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      subtitle: optText(400),
      heroImageId: optUuid,
      content: templateSchema(row.template),
      seoTitle: optText(200),
      seoDescription: optText(320),
      seoKeywords: optText(300),
      ogImageId: optUuid,
    }),
  prepare: (data, row) => ({ ...data, content: mapRichText(TEMPLATE_MAP[row.template]!.fields, data.content, sanitizeRich) }),
  editableFields: ['title', 'subtitle', 'heroImageId', 'content', 'seoTitle', 'seoDescription', 'seoKeywords', 'ogImageId'],
  serialize: (p) => ({
    slug: p.slug,
    template: p.template,
    section: p.section,
    title: p.title,
    subtitle: p.subtitle,
    heroImageId: p.heroImageId,
    content: p.content,
    seo: { title: p.seoTitle, description: p.seoDescription, keywords: p.seoKeywords, ogImageId: p.ogImageId },
    updatedAt: p.updatedAt,
  }),
  titleOf: (p) => p.title,
  publicPath: (p) => (p.slug === 'home' ? '/' : `/${p.slug}`),
  searchFields: ['title', 'slug'],
  sortable: ['title', 'slug', 'updatedAt', 'sortOrder', 'status'],
  defaultSort: 'sortOrder',
  listFilter: (q) => (q.section ? { section: String(q.section) } : {}),
  listSelect: { slug: true, template: true, section: true, title: true, sortOrder: true },
  listQueryDoc: z.object({ section: z.string().optional() }),
  canDelete: false,
};

// ─────────────── People (centralised leadership records) ───────────────
const personFields = {
  fullName: z.string().trim().min(1).max(150),
  slug: slugSchema.optional(),
  photoId: optUuid,
  designation: optText(200),
  shortBio: optText(600),
  biography: z.string().max(50_000).nullable().optional(),
  education: optText(300),
  profession: optText(300),
  experience: optText(2000),
  responsibilities: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  focusAreas: z.array(z.object({ icon: z.enum(ICON_NAMES).nullable().optional(), label: z.string().trim().min(1).max(100) })).max(12).default([]),
  affiliations: z.array(z.object({ name: z.string().trim().min(1).max(200), role: optText(200) })).max(20).default([]),
  socialLinks: z
    .array(z.object({ platform: z.enum(['linkedin', 'facebook', 'x', 'instagram', 'website']), url: z.string().url().max(400) }))
    .max(6)
    .default([]),
  appointmentDate: optDate,
  tenure: optText(100),
  email: z.string().email().max(200).nullable().optional().or(z.literal('').transform(() => null)),
  isActive: z.boolean().default(true),
};
const personSchema = z.object(personFields);

async function uniqueSlug(model: 'person' | 'post' | 'event' | 'faculty' | 'examResult' | 'vacancy', base: string, exceptId?: string) {
  let slug = slugify(base) || 'item';
  for (let i = 2; ; i++) {
    const found = await (prisma[model] as any).findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!found) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

export const peopleConfig: ContentConfig = {
  type: 'person',
  module: 'people',
  label: 'People',
  path: 'people',
  delegate: () => prisma.person,
  createSchema: personSchema,
  updateSchema: () => personSchema,
  prepare: async (data, row) => ({
    ...data,
    biography: data.biography ? sanitizeRich(data.biography) : null,
    slug: await uniqueSlug('person', data.slug || data.fullName, row?.id),
  }),
  editableFields: Object.keys(personFields),
  include: { memberships: { include: { committee: { select: { id: true, slug: true, name: true } } }, orderBy: { sortOrder: 'asc' } } },
  serialize: (p) => ({
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
    photoId: p.photoId,
    designation: p.designation,
    shortBio: p.shortBio,
    biography: p.biography,
    education: p.education,
    profession: p.profession,
    experience: p.experience,
    responsibilities: p.responsibilities,
    focusAreas: p.focusAreas,
    affiliations: p.affiliations,
    socialLinks: p.socialLinks,
    appointmentDate: p.appointmentDate,
    tenure: p.tenure,
  }),
  titleOf: (p) => p.fullName,
  publicPath: (p) => {
    const m = p.memberships?.[0];
    return m ? `/about/leadership-governance/${m.committee.slug}/${p.slug}` : null;
  },
  searchFields: ['fullName', 'designation', 'slug'],
  sortable: ['fullName', 'updatedAt', 'status'],
  defaultSort: 'fullName',
  listSelect: { slug: true, fullName: true, designation: true, photoId: true, isActive: true, memberships: { select: { roleTitle: true, committee: { select: { name: true, slug: true } } } } },
  listFilter: (q) => (q.committee ? { memberships: { some: { committee: { slug: String(q.committee) } } } } : {}),
  listQueryDoc: z.object({ committee: z.string().optional() }),
};

// ─────────────── Leadership messages ───────────────
const messageFields = {
  personId: optUuid,
  eyebrow: optText(120),
  heading: z.string().trim().min(1).max(200),
  salutation: optText(200),
  excerpt: optText(600),
  body: z.string().min(1).max(50_000),
  quote: optText(600),
  signatureImageId: optUuid,
  signatoryTitle: optText(200),
  pdfDocumentId: optUuid,
  publicationDate: optDate,
};
export const messagesConfig: ContentConfig = {
  type: 'message',
  module: 'messages',
  label: 'Leadership Messages',
  path: 'messages',
  delegate: () => prisma.leadershipMessage,
  updateSchema: () => z.object(messageFields),
  prepare: async (data) => {
    if (data.personId && !(await prisma.person.findFirst({ where: { id: data.personId, deletedAt: null } }))) throw badRequest('Selected person does not exist');
    return { ...data, body: sanitizeRich(data.body) };
  },
  editableFields: Object.keys(messageFields),
  serialize: (m) => ({
    key: m.key,
    personId: m.personId,
    eyebrow: m.eyebrow,
    heading: m.heading,
    salutation: m.salutation,
    excerpt: m.excerpt,
    body: m.body,
    quote: m.quote,
    signatureImageId: m.signatureImageId,
    signatoryTitle: m.signatoryTitle,
    pdfDocumentId: m.pdfDocumentId,
    publicationDate: m.publicationDate,
  }),
  titleOf: (m) => m.heading,
  publicPath: (m) => `/about/leadership-governance/${m.key === 'chairman' ? 'chairmans-message' : 'principals-message'}`,
  searchFields: ['heading', 'key'],
  sortable: ['heading', 'updatedAt'],
  defaultSort: 'heading',
  listSelect: { key: true, heading: true, personId: true },
  canDelete: false,
};

// ─────────────── News / announcements / achievements ───────────────
const postFields = {
  kind: z.enum(['NEWS', 'ANNOUNCEMENT', 'ACHIEVEMENT']),
  slug: slugSchema.optional(),
  title: z.string().trim().min(1).max(250),
  category: optText(80),
  excerpt: optText(600),
  body: z.string().max(100_000).default(''),
  featuredImageId: optUuid,
  author: optText(120),
  publicationDate: z.coerce.date(),
  isFeatured: z.boolean().default(false),
  badge: optText(60),
  documentId: optUuid,
  seoTitle: optText(200),
  seoDescription: optText(320),
};
const postSchema = z.object(postFields);
export const postsConfig: ContentConfig = {
  type: 'post',
  module: 'posts',
  label: 'News & Announcements',
  path: 'posts',
  delegate: () => prisma.post,
  createSchema: postSchema,
  updateSchema: () => postSchema,
  prepare: async (data, row) => ({ ...data, body: sanitizeRich(data.body ?? ''), slug: await uniqueSlug('post', data.slug || data.title, row?.id) }),
  editableFields: Object.keys(postFields),
  serialize: (p) => ({
    id: p.id,
    kind: p.kind,
    slug: p.slug,
    title: p.title,
    category: p.category,
    excerpt: p.excerpt,
    body: p.body,
    featuredImageId: p.featuredImageId,
    author: p.author,
    publicationDate: p.publicationDate,
    isFeatured: p.isFeatured,
    badge: p.badge,
    documentId: p.documentId,
    seo: { title: p.seoTitle, description: p.seoDescription },
  }),
  titleOf: (p) => p.title,
  publicPath: (p) => `/news-events/${POST_PATH[p.kind as string] ?? 'news'}/${p.slug}`,
  searchFields: ['title', 'category', 'slug'],
  sortable: ['title', 'publicationDate', 'updatedAt', 'status'],
  defaultSort: 'publicationDate',
  listSelect: { kind: true, slug: true, title: true, category: true, publicationDate: true, isFeatured: true, featuredImageId: true },
  listFilter: (q) => (q.kind ? { kind: String(q.kind) } : {}),
  listQueryDoc: z.object({ kind: z.enum(['NEWS', 'ANNOUNCEMENT', 'ACHIEVEMENT']).optional() }),
};

const POST_PATH: Record<string, string> = { NEWS: 'news', ANNOUNCEMENT: 'announcements', ACHIEVEMENT: 'achievements' };

// ─────────────── Events ───────────────
const eventFields = {
  slug: slugSchema.optional(),
  title: z.string().trim().min(1).max(250),
  category: optText(80),
  excerpt: optText(600),
  body: z.string().max(100_000).default(''),
  featuredImageId: optUuid,
  location: optText(200),
  startDate: z.coerce.date(),
  endDate: optDate,
  author: optText(120),
  isFeatured: z.boolean().default(false),
  seoTitle: optText(200),
  seoDescription: optText(320),
};
const eventSchema = z.object(eventFields).refine((e) => !e.endDate || e.endDate >= e.startDate, { message: 'End date must be after the start date', path: ['endDate'] });
export const eventsConfig: ContentConfig = {
  type: 'event',
  module: 'events',
  label: 'Events',
  path: 'events',
  delegate: () => prisma.event,
  createSchema: z.object(eventFields),
  updateSchema: () => eventSchema,
  prepare: async (data, row) => ({ ...data, body: sanitizeRich(data.body ?? ''), slug: await uniqueSlug('event', data.slug || data.title, row?.id) }),
  editableFields: Object.keys(eventFields),
  serialize: (e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    category: e.category,
    excerpt: e.excerpt,
    body: e.body,
    featuredImageId: e.featuredImageId,
    location: e.location,
    startDate: e.startDate,
    endDate: e.endDate,
    author: e.author,
    isFeatured: e.isFeatured,
    seo: { title: e.seoTitle, description: e.seoDescription },
  }),
  titleOf: (e) => e.title,
  publicPath: (e) => `/news-events/events/${e.slug}`,
  searchFields: ['title', 'category', 'location'],
  sortable: ['title', 'startDate', 'updatedAt', 'status'],
  defaultSort: 'startDate',
  listSelect: { slug: true, title: true, category: true, startDate: true, location: true, isFeatured: true },
};

// ─────────────── Testimonials & success stories ───────────────
const STORY_KINDS = ['STUDENT_TESTIMONIAL', 'PARENT_TESTIMONIAL', 'ALUMNI_STORY', 'STUDENT_SUCCESS', 'SCHOLARSHIP_SUCCESS', 'ACADEMIC_ACHIEVEMENT'] as const;
const storyFields = {
  kind: z.enum(STORY_KINDS),
  name: z.string().trim().min(1).max(150),
  subtitle: optText(200),
  detail: optText(200),
  quote: z.string().trim().min(1).max(1000),
  body: z.string().max(50_000).nullable().optional(),
  photoId: optUuid,
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
};
const storySchema = z.object(storyFields);
export const storiesConfig: ContentConfig = {
  type: 'story',
  module: 'stories',
  label: 'Testimonials & Stories',
  path: 'stories',
  delegate: () => prisma.story,
  createSchema: storySchema,
  updateSchema: () => storySchema,
  prepare: (data) => ({ ...data, body: data.body ? sanitizeRich(data.body) : null }),
  editableFields: Object.keys(storyFields),
  serialize: (s) => ({ id: s.id, kind: s.kind, name: s.name, subtitle: s.subtitle, detail: s.detail, quote: s.quote, body: s.body, photoId: s.photoId, isFeatured: s.isFeatured, sortOrder: s.sortOrder }),
  titleOf: (s) => s.name,
  searchFields: ['name', 'quote', 'subtitle'],
  sortable: ['name', 'sortOrder', 'updatedAt', 'status'],
  defaultSort: 'sortOrder',
  listSelect: { kind: true, name: true, subtitle: true, isFeatured: true, sortOrder: true, photoId: true },
  listFilter: (q) => (q.kind ? { kind: { in: String(q.kind).split(',') } } : {}),
  listQueryDoc: z.object({ kind: z.string().optional() }),
};


// ─────────────── Faculty ───────────────
const strList = (n = 20) => z.array(z.string().trim().min(1).max(300)).max(n).default([]);
const facultyFields = {
  fullName: z.string().trim().min(1).max(150),
  slug: slugSchema.optional(),
  photoId: optUuid,
  designation: optText(150),
  department: optText(120),
  programmes: optText(150),
  subject: optText(120),
  qualification: optText(200),
  experience: optText(60),
  joinedDate: optDate,
  email: z.string().email().max(200).nullable().optional().or(z.literal('').transform(() => null)),
  about: optText(4000),
  qualifications: strList(),
  teachingAreas: strList(),
  interests: strList(),
  development: strList(),
  achievements: strList(),
  quote: optText(300),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
};
const facultySchema = z.object(facultyFields);
export const facultyConfig: ContentConfig = {
  type: 'faculty',
  module: 'faculty',
  label: 'Faculty',
  path: 'faculty',
  delegate: () => prisma.faculty,
  createSchema: facultySchema,
  updateSchema: () => facultySchema,
  prepare: async (d, row) => ({ ...d, slug: await uniqueSlug('faculty', d.slug || d.fullName, row?.id) }),
  editableFields: Object.keys(facultyFields),
  serialize: (f) => Object.fromEntries(['id', 'slug', ...Object.keys(facultyFields)].map((k) => [k, f[k] ?? null])),
  titleOf: (f) => f.fullName,
  publicPath: (f) => `/academics/faculty/${f.slug}`,
  searchFields: ['fullName', 'subject', 'department'],
  sortable: ['fullName', 'sortOrder', 'updatedAt', 'status'],
  defaultSort: 'fullName',
  listSelect: { slug: true, fullName: true, designation: true, subject: true, department: true, photoId: true, isFeatured: true },
};

// ─────────────── Examination results ───────────────
const num = z.coerce.number().nullable().optional();
const resultFields = {
  examination: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1990).max(2100),
  slug: slugSchema.optional(),
  summary: z.object({ aRate: optText(20), totalStudents: optText(20), distinctions: optText(20), position: optText(40), passRate: optText(20), topHolders: optText(20) }).default({}),
  grades: z.array(z.object({ label: z.string().trim().min(1).max(40), range: optText(40), count: num, percent: optText(10) })).max(10).default([]),
  subjects: z.array(z.object({ name: z.string().trim().min(1).max(80), rate: num, distinctions: num, icon: optText(40) })).max(20).default([]),
  classes: z.array(z.object({ name: z.string().trim().min(1).max(40), total: num, aPlus: optText(30), b: optText(30), belowB: optText(30), passRate: optText(10) })).max(20).default([]),
  achievers: z.array(z.object({ name: z.string().trim().min(1).max(120), photoId: optUuid, marks: num, total: num, percentage: optText(10), grade: optText(10) })).max(50).default([]),
  documents: z.array(z.string().uuid()).max(10).default([]),
  isFeatured: z.boolean().default(false),
};
const resultSchema = z.object(resultFields);
export const resultsConfig: ContentConfig = {
  type: 'result',
  module: 'results',
  label: 'Examination Results',
  path: 'results',
  delegate: () => prisma.examResult,
  createSchema: resultSchema,
  updateSchema: () => resultSchema,
  prepare: async (d, row) => ({ ...d, slug: await uniqueSlug('examResult', d.slug || `${d.examination}-${d.year}`, row?.id) }),
  editableFields: Object.keys(resultFields),
  serialize: (r) => Object.fromEntries(['id', 'slug', ...Object.keys(resultFields)].map((k) => [k, r[k] ?? null])),
  titleOf: (r) => `${r.examination} ${r.year}`,
  publicPath: (r) => `/academics/academic-achievements/detailed-results?exam=${encodeURIComponent(r.examination)}&year=${r.year}`,
  searchFields: ['examination', 'slug'],
  sortable: ['year', 'examination', 'updatedAt', 'status'],
  defaultSort: 'year',
  listSelect: { slug: true, examination: true, year: true, isFeatured: true },
};

// ─────────────── Vacancies ───────────────
const vacancyFields = {
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  department: optText(120),
  location: optText(120),
  jobType: optText(60),
  closingDate: optDate,
  summary: optText(600),
  body: z.string().max(100_000).default(''),
  isFeatured: z.boolean().default(false),
};
const vacancySchema = z.object(vacancyFields);
export const vacanciesConfig: ContentConfig = {
  type: 'vacancy',
  module: 'vacancies',
  label: 'Vacancies',
  path: 'vacancies',
  delegate: () => prisma.vacancy,
  createSchema: vacancySchema,
  updateSchema: () => vacancySchema,
  prepare: async (d, row) => ({ ...d, body: sanitizeRich(d.body ?? ''), slug: await uniqueSlug('vacancy', d.slug || d.title, row?.id) }),
  editableFields: Object.keys(vacancyFields),
  serialize: (v) => Object.fromEntries(['id', 'slug', ...Object.keys(vacancyFields)].map((k) => [k, v[k] ?? null])),
  titleOf: (v) => v.title,
  publicPath: (v) => `/careers/${v.slug}`,
  searchFields: ['title', 'department'],
  sortable: ['title', 'closingDate', 'updatedAt', 'status'],
  defaultSort: 'closingDate',
  listSelect: { slug: true, title: true, department: true, jobType: true, closingDate: true },
};

export const contentRouters = {
  pages: createContentRouter(pagesConfig),
  people: createContentRouter(peopleConfig),
  messages: createContentRouter(messagesConfig),
  posts: createContentRouter(postsConfig),
  events: createContentRouter(eventsConfig),
  stories: createContentRouter(storiesConfig),
  faculty: createContentRouter(facultyConfig),
  results: createContentRouter(resultsConfig),
  vacancies: createContentRouter(vacanciesConfig),
};
