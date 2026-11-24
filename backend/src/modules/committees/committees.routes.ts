import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, notFound, parse } from '../../lib/http';
import { audit } from '../../lib/audit';
import { doc } from '../../lib/openapi';
import { invalidatePublic } from '../../lib/cache';
import { requirePermission } from '../../middleware/auth';

/**
 * Committees (Board of Trustees, Executive Committee, School Administration) and the role
 * assignments that link centralised people to them. Website directories are generated from these.
 */
export const committeesRouter = Router();
const base = '/api/admin/committees';
const tag = 'Committees';

doc({ method: 'get', path: base, tag, summary: 'List committees with their members', auth: true, permission: 'people.view' });
committeesRouter.get(
  '/',
  requirePermission('people.view'),
  ah(async (_req, res) => {
    const committees = await prisma.committee.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        members: {
          orderBy: [{ sortOrder: 'asc' }],
          include: { person: { select: { id: true, fullName: true, slug: true, photoId: true, status: true, publishedData: true, deletedAt: true } } },
        },
      },
    });
    res.json(
      committees.map((c) => ({
        ...c,
        members: c.members
          .filter((m) => !m.person.deletedAt)
          .map(({ person: { publishedData, deletedAt, ...p }, ...m }) => ({ ...m, person: { ...p, isLive: publishedData != null } })),
      })),
    );
  }),
);

const committeeSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  profileLabel: z.string().trim().min(1).max(80),
});
doc({ method: 'put', path: `${base}/:id`, tag, summary: 'Update committee details', auth: true, permission: 'people.edit', body: committeeSchema });
committeesRouter.put(
  '/:id',
  requirePermission('people.edit'),
  ah(async (req, res) => {
    const data = parse(committeeSchema, req.body);
    const c = await prisma.committee.update({ where: { id: req.params.id! }, data });
    await audit(req, 'committee.update', 'committee', c.id, `Updated committee ${c.name}`);
    invalidatePublic();
    res.json(c);
  }),
);

const memberSchema = z.object({
  personId: z.string().uuid(),
  roleTitle: z.string().trim().min(1).max(200),
  isHead: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

doc({ method: 'post', path: `${base}/:id/members`, tag, summary: 'Assign a person to this committee', auth: true, permission: 'people.edit', body: memberSchema });
committeesRouter.post(
  '/:id/members',
  requirePermission('people.edit'),
  ah(async (req, res) => {
    const data = parse(memberSchema, req.body);
    const committee = await prisma.committee.findUnique({ where: { id: req.params.id! } });
    if (!committee) throw notFound('Committee');
    const person = await prisma.person.findFirst({ where: { id: data.personId, deletedAt: null } });
    if (!person) throw notFound('Person');
    const max = await prisma.committeeMember.aggregate({ where: { committeeId: committee.id }, _max: { sortOrder: true } });
    const m = await prisma.committeeMember.create({ data: { ...data, committeeId: committee.id, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    await audit(req, 'committee.member_add', 'committee', committee.id, `Assigned ${person.fullName} to ${committee.name} as ${data.roleTitle}`);
    invalidatePublic();
    res.status(201).json(m);
  }),
);

doc({ method: 'put', path: `${base}/:id/members/:memberId`, tag, summary: 'Update a role assignment', auth: true, permission: 'people.edit', body: memberSchema.omit({ personId: true }) });
committeesRouter.put(
  '/:id/members/:memberId',
  requirePermission('people.edit'),
  ah(async (req, res) => {
    const data = parse(memberSchema.omit({ personId: true }), req.body);
    const m = await prisma.committeeMember.update({ where: { id: req.params.memberId!, committeeId: req.params.id! }, data, include: { person: true, committee: true } });
    await audit(req, 'committee.member_update', 'committee', m.committeeId, `Updated ${m.person.fullName} in ${m.committee.name}`);
    invalidatePublic();
    res.json(m);
  }),
);

doc({ method: 'delete', path: `${base}/:id/members/:memberId`, tag, summary: 'Remove a role assignment', auth: true, permission: 'people.edit' });
committeesRouter.delete(
  '/:id/members/:memberId',
  requirePermission('people.edit'),
  ah(async (req, res) => {
    const m = await prisma.committeeMember.delete({ where: { id: req.params.memberId!, committeeId: req.params.id! }, include: { person: true, committee: true } });
    await audit(req, 'committee.member_remove', 'committee', m.committeeId, `Removed ${m.person.fullName} from ${m.committee.name}`);
    invalidatePublic();
    res.json({ ok: true });
  }),
);

const reorderSchema = z.object({ memberIds: z.array(z.string().uuid()).max(200) });
doc({ method: 'post', path: `${base}/:id/reorder`, tag, summary: 'Set the display order of members', auth: true, permission: 'people.edit', body: reorderSchema });
committeesRouter.post(
  '/:id/reorder',
  requirePermission('people.edit'),
  ah(async (req, res) => {
    const { memberIds } = parse(reorderSchema, req.body);
    await prisma.$transaction(memberIds.map((id, i) => prisma.committeeMember.update({ where: { id, committeeId: req.params.id! }, data: { sortOrder: i + 1 } })));
    await audit(req, 'committee.reorder', 'committee', req.params.id!);
    invalidatePublic();
    res.json({ ok: true });
  }),
);
