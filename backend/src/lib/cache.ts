import { config } from '../config';
import { secret } from './secrets';

/**
 * Small in-memory TTL cache for public API responses. Every publish / settings change calls
 * `invalidatePublic()`, which clears the cache and asks the Next.js website to revalidate.
 */
const store = new Map<string, { expires: number; value: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function cached<T>(key: string, fn: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  store.set(key, { expires: Date.now() + ttl, value });
  if (store.size > 2000) store.delete(store.keys().next().value!);
  return value;
}

let pending: NodeJS.Timeout | null = null;
export function invalidatePublic() {
  store.clear();
  // Debounce website revalidation so bulk operations trigger one request.
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    if (!config.REVALIDATE_URL) return;
    fetch(config.REVALIDATE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret('revalidate') },
      body: JSON.stringify({ tag: 'cms' }),
    }).catch((e) => console.warn('Website revalidation failed:', e.message));
  }, 300);
}
