import type { MetadataRoute } from 'next';
import { api, getSite, siteUrl } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(await getSite().catch(() => null));
  const data = await api<{ urls: { path: string; lastModified: string | null }[] }>('/sitemap').catch(() => null);
  return (data?.urls ?? []).map((u) => ({ url: `${base}${u.path}`, lastModified: u.lastModified ?? undefined }));
}
