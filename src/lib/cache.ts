/**
 * Simple TTL-based in-memory cache
 *
 * Used for caching expensive database queries on the server side.
 * For client-side caching, use React Query or SWR.
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private cleanupIntervalMs: number = 60000) {
    // Start periodic cleanup
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache with TTL
   */
  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    this.cleanup(); // Clean expired entries first
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval (for cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Cache TTL constants
export const CACHE_TTL = {
  STATS: 5 * 60 * 1000, // 5 minutes
  CLUSTER: 60 * 60 * 1000, // 1 hour
  DOMAIN: 24 * 60 * 60 * 1000, // 24 hours
  SEARCH: 5 * 60 * 1000, // 5 minutes
} as const;

// Singleton cache instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const statsCache = new TTLCache<any>(10 * 60 * 1000);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterCache = new TTLCache<any>(10 * 60 * 1000);

/**
 * Generic cached query helper
 */
export async function cachedQuery<T>(
  cache: TTLCache<T>,
  key: string,
  ttlMs: number,
  queryFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await queryFn();
  cache.set(key, result, ttlMs);
  return result;
}
