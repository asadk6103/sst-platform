import { prisma } from './prisma';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Collect every UUID-shaped string in a JSON value (candidate media references). */
export function collectUuids(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (UUID_RE.test(value)) out.add(value.toLowerCase());
  } else if (Array.isArray(value)) value.forEach((v) => collectUuids(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectUuids(v, out));
  return out;
}

export interface PublicMedia {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string | null;
  variants: { width: number; url: string }[];
}

export function mediaUrl(key: string, revision = 1) {
  return `/uploads/${key}?v=${revision}`;
}

export function toPublicMedia(m: {
  id: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  variants: unknown;
  revision: number;
  originalName: string;
}): PublicMedia {
  const variants = (Array.isArray(m.variants) ? m.variants : []) as { width: number; key: string }[];
  return {
    id: m.id,
    url: mediaUrl(m.storageKey, m.revision),
    mimeType: m.mimeType,
    width: m.width,
    height: m.height,
    alt: m.alt ?? '',
    caption: m.caption,
    variants: variants.map((v) => ({ width: v.width, url: mediaUrl(v.key, m.revision) })),
  };
}

/** Builds the `media` dictionary for a public response from the ids it references. */
export async function mediaDictionary(value: unknown): Promise<Record<string, PublicMedia>> {
  const ids = [...collectUuids(value)];
  if (!ids.length) return {};
  const rows = await prisma.media.findMany({ where: { id: { in: ids }, deletedAt: null } });
  return Object.fromEntries(rows.map((m) => [m.id, toPublicMedia(m)]));
}

/** Records which media items a content record uses (for usage tracking & safe deletion). */
export async function syncMediaUsage(entityType: string, entityId: string, value: unknown, label?: string) {
  const ids = [...collectUuids(value)];
  const existing = ids.length ? await prisma.media.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
  await prisma.$transaction([
    prisma.mediaUsage.deleteMany({ where: { entityType, entityId } }),
    prisma.mediaUsage.createMany({
      data: existing.map((m) => ({ mediaId: m.id, entityType, entityId, label })),
      skipDuplicates: true,
    }),
  ]);
}
