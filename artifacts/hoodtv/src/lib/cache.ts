const PREFIX = "hoodtv_cache_";
const TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs = TTL_MS): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export async function withCache<T>(key: string, fn: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;
  const data = await fn();
  cacheSet(key, data, ttlMs);
  return data;
}
