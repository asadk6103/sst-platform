import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader (optional — Docker installs need no .env). Real environment variables win.
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

/**
 * Infrastructure configuration only. Security secrets are generated on first start (lib/secrets.ts)
 * and site-level settings (public address, upload limit, secure cookies) are managed in the
 * administration portal (lib/system.ts). Environment variables, when present, override both.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4200),
  DATABASE_URL: z.string().min(1),
  /** Folder for generated secrets and the first-run setup code (a private Docker volume). */
  CONFIG_DIR: z.string().default('./config'),
  UPLOAD_DIR: z.string().default('./uploads'),
  REVALIDATE_URL: z.string().optional(),
  TRUST_PROXY: z.coerce.number().default(0),
  // Optional overrides — normally managed in Administration → System.
  PUBLIC_URL: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().optional(),
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  uploadDir: resolve(process.cwd(), parsed.data.UPLOAD_DIR),
  configDir: resolve(process.cwd(), parsed.data.CONFIG_DIR),
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlDays: 7,
  /** Hard ceiling for uploads; the effective limit is set in Administration → System. */
  uploadCeilingMb: 100,
};
