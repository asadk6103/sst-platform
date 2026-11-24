import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * Security secrets, generated automatically on first start and kept in CONFIG_DIR
 * (a private Docker volume shared read-only with the website for the revalidation secret).
 * Environment variables with the same names override the generated values.
 * Secrets can be rotated from Administration → System.
 */
export type SecretName = 'jwtAccess' | 'preview' | 'revalidate';
const ENV_OVERRIDE: Record<SecretName, string> = { jwtAccess: 'JWT_ACCESS_SECRET', preview: 'PREVIEW_SECRET', revalidate: 'REVALIDATE_SECRET' };

const file = () => join(config.configDir, 'secrets.json');
const gen = () => randomBytes(48).toString('base64url');
let cache: Record<SecretName, string> | null = null;

function writeAtomic(path: string, data: string, mode: number) {
  mkdirSync(config.configDir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data, { mode });
  renameSync(tmp, path);
  try {
    chmodSync(path, mode);
  } catch {
    /* not supported on some filesystems */
  }
}

function load(): Record<SecretName, string> {
  if (cache) return cache;
  let stored: Partial<Record<SecretName, string>> = {};
  if (existsSync(file())) {
    try {
      stored = JSON.parse(readFileSync(file(), 'utf8'));
    } catch {
      console.warn('[secrets] secrets.json is unreadable — generating new secrets (existing sessions end).');
    }
  }
  const all = { jwtAccess: stored.jwtAccess || gen(), preview: stored.preview || gen(), revalidate: stored.revalidate || gen() };
  if (all.jwtAccess !== stored.jwtAccess || all.preview !== stored.preview || all.revalidate !== stored.revalidate) {
    writeAtomic(file(), JSON.stringify(all, null, 2), 0o600);
    console.info(`[secrets] generated security secrets in ${file()}`);
  }
  cache = all;
  return all;
}

export function secret(name: SecretName): string {
  const env = process.env[ENV_OVERRIDE[name]];
  if (env && env.length >= 32) return env;
  return load()[name];
}

export const isOverridden = (name: SecretName) => (process.env[ENV_OVERRIDE[name]] ?? '').length >= 32;

export function rotate(name: SecretName) {
  const all = { ...load(), [name]: gen() };
  writeAtomic(file(), JSON.stringify(all, null, 2), 0o600);
  cache = all;
}

// ───────────── First-run setup code ─────────────
const setupFile = () => join(config.configDir, 'setup-code.txt');

/** Returns the one-time setup code, creating it if needed (only used while no user exists). */
export function ensureSetupCode(): string {
  if (existsSync(setupFile())) return readFileSync(setupFile(), 'utf8').trim();
  const code = randomBytes(9).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10).padEnd(10, 'X');
  const formatted = `${code.slice(0, 5)}-${code.slice(5, 10)}`;
  writeAtomic(setupFile(), formatted, 0o600);
  return formatted;
}

export function checkSetupCode(input: string): boolean {
  if (!existsSync(setupFile())) return false;
  const a = Buffer.from(readFileSync(setupFile(), 'utf8').trim().toUpperCase());
  const b = Buffer.from(String(input).trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export const clearSetupCode = () => rmSync(setupFile(), { force: true });
