/**
 * In-memory cache with TTL for Edge Functions
 * Caches bouquets, user memories, profiles to reduce DB calls
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLSeconds = 300) {
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deletePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// Singleton cache instance with 5 minute default TTL
export const cache = new MemoryCache(300);

// Cache keys
export const CACHE_KEYS = {
  BOUQUETS_GLOBAL: "bouquets:global",
  BOUQUETS_BY_REGIE: (regieId: string) => `bouquets:regie:${regieId}`,
  USER_MEMORIES: (userId: string) => `memories:${userId}`,
  USER_PROMPTS: (userId: string) => `prompts:${userId}`,
  USER_PROFILE: (userId: string) => `profile:${userId}`,
  CONFIG_COMMISSIONS: "config:commissions",
  REGIES_LIST: (userId: string) => `regies:${userId}`,
} as const;

// TTL values in seconds
export const CACHE_TTL = {
  BOUQUETS: 600,      // 10 minutes - rarely changes
  MEMORIES: 120,      // 2 minutes - can be updated
  PROMPTS: 300,       // 5 minutes
  PROFILE: 300,       // 5 minutes
  CONFIG: 600,        // 10 minutes
  REGIES: 300,        // 5 minutes
} as const;
