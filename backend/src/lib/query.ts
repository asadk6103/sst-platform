import { z } from 'zod';
import { parse } from './http';

/** Standard list query: ?page=1&pageSize=20&search=...&sort=updatedAt&order=desc */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().max(30).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export function parseList(query: unknown, sortable: string[], defaultSort = 'updatedAt'): ListQuery & { orderBy: Record<string, 'asc' | 'desc'>; skip: number; take: number } {
  const q = parse(listQuerySchema, query);
  const sort = q.sort && sortable.includes(q.sort) ? q.sort : defaultSort;
  return { ...q, orderBy: { [sort]: q.order }, skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export const paged = <T>(items: T[], total: number, q: { page: number; pageSize: number }) => ({
  items,
  pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
});

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

export const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');
