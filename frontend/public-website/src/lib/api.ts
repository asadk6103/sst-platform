import { cookies, draftMode } from 'next/headers';

/**
 * Server-side API client. Published content is cached (tag "cms") and revalidated on demand
 * when the CMS publishes; preview mode (draftMode + token cookie) bypasses the cache and
 * asks the API for working copies.
 */
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4200';
export const PREVIEW_COOKIE = 'sst_preview_token';

export interface Media {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string | null;
  variants: { width: number; url: string }[];
}
export interface Doc {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  size: number | null;
  mimeType: string | null;
  fileType: string | null;
  publishedDate: string | null;
  updatedAt: string;
}
export type MediaMap = Record<string, Media>;
export type DocMap = Record<string, Doc>;

export async function previewToken(): Promise<string | null> {
  try {
    if (!(await draftMode()).isEnabled) return null;
    return (await cookies()).get(PREVIEW_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function api<T = any>(path: string): Promise<T | null> {
  const token = await previewToken();
  const res = await fetch(`${API}/api/public${path}`, token ? { cache: 'no-store', headers: { 'x-preview-token': token } } : { next: { tags: ['cms'], revalidate: 300 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string | null;
  isComingSoon: boolean;
  openInNewTab: boolean;
  children: NavItem[];
}
export interface Site {
  settings: Record<string, any>;
  navigation: Record<string, NavItem[]>;
  categories: Record<string, { name: string; slug: string; icon: string | null }[]>;
  media: MediaMap;
  documents: DocMap;
}

/** Public address set in Administration → System (falls back to the environment, then localhost). */
export const siteUrl = (site?: Site | null) => (site?.settings.system?.publicUrl || process.env.PUBLIC_SITE_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function getSite(): Promise<Site> {
  const site = await api<Site>('/site');
  if (!site) throw new Error('Site settings unavailable');
  return site;
}

export const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};
