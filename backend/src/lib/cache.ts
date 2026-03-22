/**
 * Redis Query Cache
 *
 * Simple caching layer for frequently-accessed database queries.
 * Reduces load on PostgreSQL for common operations like:
 * - Supplier/processor lists
 * - CAD status counts
 * - Style variants
 *
 * Falls back to direct query execution if Redis is unavailable.
 */

import Redis from 'ioredis';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';

// Cache configuration
const CACHE_PREFIX = 'erp:cache:';
const DEFAULT_TTL = 300; // 5 minutes in seconds

// Redis connection (singleton)
let redis: Redis | null = null;
let connectionAttempted = false;

/**
 * Get Redis connection config from environment
 */
function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logWarn('Redis connection failed after 3 attempts - caching disabled');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  };
}

/**
 * Check if Redis caching is enabled
 */
function isCacheEnabled(): boolean {
  return process.env.REDIS_CACHE_ENABLED === 'true' || process.env.REDIS_ENABLED === 'true' || !!process.env.REDIS_HOST;
}

/**
 * Initialize Redis connection for caching
 */
export async function initializeCache(): Promise<boolean> {
  if (connectionAttempted) {
    return redis !== null;
  }
  connectionAttempted = true;

  if (!isCacheEnabled()) {
    logInfo('Redis caching disabled - using direct queries');
    return false;
  }

  try {
    redis = new Redis(getRedisConfig());

    // Test connection
    await redis.connect();
    await redis.ping();

    logInfo('Redis cache initialized successfully');
    return true;
  } catch (error) {
    logWarn('Redis cache connection failed - using direct queries:', error);
    redis = null;
    return false;
  }
}

/**
 * Generate cache key with prefix
 */
function getCacheKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/**
 * Get value from cache
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const cached = await redis.get(getCacheKey(key));
    if (cached) {
      logDebug(`Cache HIT: ${key}`);
      return JSON.parse(cached) as T;
    }
    logDebug(`Cache MISS: ${key}`);
    return null;
  } catch (error) {
    logError('Cache get error:', error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function setInCache<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.setex(getCacheKey(key), ttlSeconds, JSON.stringify(value));
    logDebug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    logError('Cache set error:', error);
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function deleteFromCache(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(getCacheKey(key));
    logDebug(`Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    logError('Cache delete error:', error);
    return false;
  }
}

/**
 * Invalidate all keys matching pattern
 */
export async function invalidateByPattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logDebug(`Cache INVALIDATE: ${pattern} (${keys.length} keys)`);
    }
    return keys.length;
  } catch (error) {
    logError('Cache invalidate error:', error);
    return 0;
  }
}

/**
 * Execute query with caching
 *
 * Usage:
 * ```
 * const suppliers = await cachedQuery(
 *   'suppliers:all',
 *   () => prisma.suppliers.findMany(),
 *   300 // 5 minutes TTL
 * );
 * ```
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL
): Promise<T> {
  // Try to get from cache
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute query
  const result = await fetcher();

  // Store in cache (don't await - fire and forget)
  setInCache(key, result, ttlSeconds).catch(() => {
    // Silently ignore cache errors
  });

  return result;
}

/**
 * Pre-defined cache keys for common queries
 */
export const cacheKeys = {
  // Suppliers
  suppliers: {
    all: 'suppliers:all',
    active: 'suppliers:active',
    byId: (id: string) => `suppliers:${id}`,
  },

  // CAD Status
  cad: {
    statusCounts: 'cad:status-counts',
  },

  // Styles
  styles: {
    variants: (styleId: string) => `styles:variants:${styleId}`,
    list: (filters: string) => `styles:list:${filters}`,
  },

  // Materials
  materials: {
    all: 'materials:all',
    byType: (type: string) => `materials:type:${type}`,
  },

  // Permissions
  permissions: {
    matrix: 'permissions:matrix',
    byRole: (role: string) => `permissions:role:${role}`,
    definitions: 'permissions:definitions',
  },
};

/**
 * Cache TTL presets (in seconds)
 */
export const cacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 600, // 10 minutes
  HOUR: 3600, // 1 hour
};

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  dbSize: number;
  info: string;
} | null> {
  if (!redis) return null;

  try {
    const dbSize = await redis.dbsize();
    const info = await redis.info('stats');
    return { connected: true, dbSize, info };
  } catch {
    return { connected: false, dbSize: 0, info: '' };
  }
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logInfo('Redis cache connection closed');
  }
}

export default {
  initializeCache,
  cachedQuery,
  getFromCache,
  setInCache,
  deleteFromCache,
  invalidateByPattern,
  getCacheStats,
  closeCache,
  cacheKeys,
  cacheTTL,
};
