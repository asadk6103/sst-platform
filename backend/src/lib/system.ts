import { z } from 'zod';
import { config } from '../config';
import { prisma } from './prisma';

/**
 * Site-level system settings, managed in Administration → System (stored in website_settings
 * under the "system" key). Environment variables override them when set.
 */
export const systemSchema = z.object({
  publicUrl: z
    .string()
    .trim()
    .url('Enter the full address, e.g. https://www.sst.edu.pk')
    .refine((u) => /^https?:\/\//.test(u), 'Must start with http:// or https://')
    .transform((u) => u.replace(/\/+$/, '')),
  maxUploadMb: z.coerce.number().int().min(1).max(config.uploadCeilingMb),
  secureCookies: z.enum(['auto', 'on', 'off']),
});
export type SystemSettings = z.infer<typeof systemSchema>;

export const DEFAULT_SYSTEM: SystemSettings = { publicUrl: 'http://localhost:8000', maxUploadMb: 15, secureCookies: 'auto' };

let cache: { at: number; value: SystemSettings } | null = null;

/** Stored settings merged over defaults (without environment overrides). */
export async function storedSystem(): Promise<SystemSettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'system' } });
  const parsed = systemSchema.partial().safeParse(row?.value ?? {});
  return { ...DEFAULT_SYSTEM, ...(parsed.success ? parsed.data : {}) };
}

/** Effective settings (environment overrides applied), cached for 15 seconds. */
export async function system(): Promise<SystemSettings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const s = await storedSystem();
  const value: SystemSettings = {
    publicUrl: (config.PUBLIC_URL ?? s.publicUrl).replace(/\/+$/, ''),
    maxUploadMb: config.MAX_UPLOAD_MB ?? s.maxUploadMb,
    secureCookies: config.COOKIE_SECURE ? ({ auto: 'auto', true: 'on', false: 'off' } as const)[config.COOKIE_SECURE] : s.secureCookies,
  };
  cache = { at: Date.now(), value };
  return value;
}
export const clearSystemCache = () => (cache = null);

export const envOverrides = () => ({ publicUrl: !!config.PUBLIC_URL, maxUploadMb: config.MAX_UPLOAD_MB !== undefined, secureCookies: !!config.COOKIE_SECURE });

/** Whether cookies must be HTTPS-only for this request. */
export function cookieSecure(s: SystemSettings, requestIsHttps: boolean) {
  if (s.secureCookies === 'on') return true;
  if (s.secureCookies === 'off') return false;
  return requestIsHttps || s.publicUrl.startsWith('https://');
}
