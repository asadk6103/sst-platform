import { Router, type Request } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { ah, badRequest, HttpError, notFound, parse } from '../../lib/http';
import { paged, parseList } from '../../lib/query';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { stripTags } from '../../lib/sanitize';
import { requirePermission } from '../../middleware/auth';

/**
 * Website forms. Submissions are stored for staff in the admin portal (no email is sent yet).
 * Spam protection: per-IP rate limit, a hidden "website" honeypot field and a minimum fill time.
 * Uploaded CVs are kept OUTSIDE the public uploads folder and only downloadable by staff.
 */
export const publicFormsRouter = Router();
export const submissionsRouter = Router();

const PRIVATE_DIR = join(config.uploadDir, '..', 'private-uploads');
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many submissions. Please try again later.' } },
});
const cvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

const clean = (max: number) => z.string().trim().max(max).transform((v) => stripTags(v));
const optClean = (max: number) => clean(max).optional().or(z.literal('')).transform((v) => v || null);
const email = z.string().trim().email('Enter a valid email address').max(200).transform((e) => e.toLowerCase());
const antiSpam = { website: z.string().max(0, 'Spam detected').optional().or(z.literal('')), startedAt: z.coerce.number().optional() };

function assertHuman(req: Request, body: { startedAt?: number }) {
  // Forms filled in under 2 seconds are almost certainly automated.
  if (body.startedAt && Date.now() - body.startedAt < 2000) throw badRequest('Please take a moment to complete the form.');
}

const schemas = {
  contact: z.object({ name: clean(120).pipe(z.string().min(1, 'Required')), email, phone: optClean(40), inquiryType: optClean(80), subject: clean(200).pipe(z.string().min(1, 'Required')), message: clean(500).pipe(z.string().min(5, 'Please write a message')), ...antiSpam }),
  subscribe: z.object({ email, source: optClean(60), ...antiSpam }),
  nomination: z.object({ name: clean(120).pipe(z.string().min(1, 'Required')), email, phone: optClean(40), studentName: clean(150).pipe(z.string().min(1, 'Required')), title: clean(200).pipe(z.string().min(1, 'Required')), message: clean(1000).pipe(z.string().min(5, 'Please describe the achievement')), ...antiSpam }),
  alumni: z.object({ name: clean(120).pipe(z.string().min(1, 'Required')), email, phone: optClean(40), graduationYear: optClean(10), profession: optClean(150), city: optClean(100), message: optClean(1000), ...antiSpam }),
  career: z.object({ name: clean(120).pipe(z.string().min(1, 'Required')), email, phone: clean(40).pipe(z.string().min(5, 'Required')), vacancy: optClean(200), message: optClean(2000), ...antiSpam }),
};

doc({ method: 'post', path: '/api/public/forms/contact', tag: 'Public forms', summary: 'Contact form', body: schemas.contact });
publicFormsRouter.post(
  '/contact',
  formLimiter,
  ah(async (req, res) => {
    const d = parse(schemas.contact, req.body);
    assertHuman(req, d);
    await prisma.submission.create({ data: { type: 'CONTACT', name: d.name, email: d.email, phone: d.phone, subject: d.subject, message: d.message, data: { inquiryType: d.inquiryType }, ip: req.ip } });
    res.status(201).json({ ok: true, message: 'Thank you — your message has been received. Our team will get back to you soon.' });
  }),
);

doc({ method: 'post', path: '/api/public/forms/subscribe', tag: 'Public forms', summary: 'Newsletter subscription', body: schemas.subscribe });
publicFormsRouter.post(
  '/subscribe',
  formLimiter,
  ah(async (req, res) => {
    const d = parse(schemas.subscribe, req.body);
    assertHuman(req, d);
    const existing = await prisma.submission.findFirst({ where: { type: 'SUBSCRIBE', email: d.email, status: { not: 'ARCHIVED' } } });
    if (!existing) await prisma.submission.create({ data: { type: 'SUBSCRIBE', email: d.email, data: { source: d.source }, ip: req.ip } });
    res.status(201).json({ ok: true, message: 'Thank you for subscribing to SST updates.' });
  }),
);

doc({ method: 'post', path: '/api/public/forms/nomination', tag: 'Public forms', summary: 'Nominate an achievement', body: schemas.nomination });
publicFormsRouter.post(
  '/nomination',
  formLimiter,
  ah(async (req, res) => {
    const d = parse(schemas.nomination, req.body);
    assertHuman(req, d);
    await prisma.submission.create({ data: { type: 'NOMINATION', name: d.name, email: d.email, phone: d.phone, subject: d.title, message: d.message, data: { studentName: d.studentName }, ip: req.ip } });
    res.status(201).json({ ok: true, message: 'Thank you — the nomination has been sent to the school for review.' });
  }),
);

doc({ method: 'post', path: '/api/public/forms/alumni', tag: 'Public forms', summary: 'Alumni network registration', body: schemas.alumni });
publicFormsRouter.post(
  '/alumni',
  formLimiter,
  ah(async (req, res) => {
    const d = parse(schemas.alumni, req.body);
    assertHuman(req, d);
    await prisma.submission.create({ data: { type: 'ALUMNI', name: d.name, email: d.email, phone: d.phone, message: d.message, data: { graduationYear: d.graduationYear, profession: d.profession, city: d.city }, ip: req.ip } });
    res.status(201).json({ ok: true, message: 'Welcome back! Your details have been added to the SST alumni network.' });
  }),
);

doc({ method: 'post', path: '/api/public/forms/career', tag: 'Public forms', summary: 'Job application with CV (multipart, field "cv": PDF/DOCX ≤ 5 MB)', multipart: true });
publicFormsRouter.post(
  '/career',
  formLimiter,
  cvUpload.single('cv'),
  ah(async (req, res) => {
    const d = parse(schemas.career, req.body);
    assertHuman(req, d);
    if (!req.file) throw badRequest('Please attach your CV');
    const ft = await fileTypeFromBuffer(req.file.buffer);
    const allowed: Record<string, string> = { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
    if (!ft || !allowed[ft.mime]) throw new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Your CV must be a PDF or Word (.docx) document');
    const key = `cv/${new Date().getFullYear()}/${crypto.randomUUID()}.${allowed[ft.mime]}`;
    await mkdir(join(PRIVATE_DIR, key, '..'), { recursive: true });
    await writeFile(join(PRIVATE_DIR, key), req.file.buffer);
    await prisma.submission.create({
      data: { type: 'CAREER', name: d.name, email: d.email, phone: d.phone, subject: d.vacancy, message: d.message, fileKey: key, fileName: stripTags(req.file.originalname).slice(0, 200), ip: req.ip },
    });
    res.status(201).json({ ok: true, message: 'Thank you for applying. Our HR team will review your application.' });
  }),
);

// ─────────────── Admin inbox ───────────────
const TYPES = ['CONTACT', 'SUBSCRIBE', 'NOMINATION', 'CAREER', 'ALUMNI'] as const;

doc({ method: 'get', path: '/api/admin/submissions', tag: 'Submissions', summary: 'List form submissions', auth: true, permission: 'submissions.view' });
submissionsRouter.get(
  '/',
  requirePermission('submissions.view'),
  ah(async (req, res) => {
    const q = parseList(req.query, ['createdAt', 'name', 'email'], 'createdAt');
    const where: any = {};
    if (req.query.type && TYPES.includes(req.query.type as any)) where.type = req.query.type;
    where.status = q.status && ['NEW', 'READ', 'ARCHIVED'].includes(q.status) ? q.status : { not: 'ARCHIVED' };
    if (q.search) where.OR = ['name', 'email', 'subject', 'message'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
    const [items, total, counts] = await Promise.all([
      prisma.submission.findMany({ where, orderBy: q.orderBy, skip: q.skip, take: q.take }),
      prisma.submission.count({ where }),
      prisma.submission.groupBy({ by: ['type'], where: { status: 'NEW' }, _count: true }),
    ]);
    res.json({ ...paged(items, total, q), unread: Object.fromEntries(counts.map((c) => [c.type, c._count])) });
  }),
);

doc({ method: 'get', path: '/api/admin/submissions/export', tag: 'Submissions', summary: 'Export submissions of a type as CSV', auth: true, permission: 'submissions.manage' });
submissionsRouter.get(
  '/export',
  requirePermission('submissions.manage'),
  ah(async (req, res) => {
    const type = TYPES.includes(req.query.type as any) ? (req.query.type as (typeof TYPES)[number]) : 'SUBSCRIBE';
    const rows = await prisma.submission.findMany({ where: { type, status: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'desc' } });
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
    const head = ['Date', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Details', 'Status'];
    const csv = [head.map(esc).join(','), ...rows.map((r) => [r.createdAt.toISOString(), r.name, r.email, r.phone, r.subject, r.message, JSON.stringify(r.data), r.status].map(esc).join(','))].join('\r\n');
    await audit(req, 'submissions.export', 'submission', undefined, `Exported ${rows.length} ${type.toLowerCase()} submissions`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sst-${type.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + csv);
  }),
);

doc({ method: 'put', path: '/api/admin/submissions/:id', tag: 'Submissions', summary: 'Mark read / archived', auth: true, permission: 'submissions.manage' });
submissionsRouter.put(
  '/:id',
  requirePermission('submissions.manage'),
  ah(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['NEW', 'READ', 'ARCHIVED']) }), req.body);
    const s = await prisma.submission.update({ where: { id: req.params.id! }, data: { status } });
    res.json(s);
  }),
);

doc({ method: 'get', path: '/api/admin/submissions/:id/file', tag: 'Submissions', summary: 'Download the private attachment (CV)', auth: true, permission: 'submissions.view' });
submissionsRouter.get(
  '/:id/file',
  requirePermission('submissions.view'),
  ah(async (req, res) => {
    const s = await prisma.submission.findUnique({ where: { id: req.params.id! } });
    if (!s?.fileKey) throw notFound('Attachment');
    const buf = await readFile(join(PRIVATE_DIR, s.fileKey));
    await audit(req, 'submissions.file_download', 'submission', s.id, `Downloaded attachment of ${s.name}`);
    res.setHeader('Content-Type', s.fileKey.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${(s.fileName ?? 'attachment').replace(/[^\w.\- ]/g, '_')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }),
);

doc({ method: 'delete', path: '/api/admin/submissions/:id', tag: 'Submissions', summary: 'Permanently delete a submission', auth: true, permission: 'submissions.manage' });
submissionsRouter.delete(
  '/:id',
  requirePermission('submissions.manage'),
  ah(async (req, res) => {
    const s = await prisma.submission.delete({ where: { id: req.params.id! } });
    await audit(req, 'submissions.delete', 'submission', s.id, `Deleted ${s.type.toLowerCase()} submission from ${s.name ?? s.email}`);
    res.json({ ok: true });
  }),
);
