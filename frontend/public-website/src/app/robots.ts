import type { MetadataRoute } from 'next';
import { getSite, siteUrl } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = siteUrl(await getSite().catch(() => null));
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/cms-hooks/', '/search'] }], sitemap: `${base}/sitemap.xml` };
}
