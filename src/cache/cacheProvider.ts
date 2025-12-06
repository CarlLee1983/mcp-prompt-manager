/**
 * Cache provider abstract interface
 * Supports local cache and Redis cache (future)
 */

/**
 * Cache statistics information
 */
export interface CacheStats {
    /** Number of cache items */
    size: number
    /** Number of cache hits */
    hits: number
    /** Number of cache misses */
    misses: number
    /** Cache hit rate (percentage) */
    hitRate: number
    /** Number of evicted items */
    evictions: number
    /** Number of expired items */
    expirations?: number
    /** Average access count */
    averageAccessCount?: number
    /** Top keys (most accessed) */
    topKeys?: Array<{ key: string; accessCount: number }>
    /** Cache creation timestamp */
    createdAt?: number
    /** Last cleanup timestamp */
    lastCleanup?: number
}

/**
 * Cache provider abstract interface
 * Defines methods that all cache implementations must provide
 */
export interface CacheProvider {
    /**
     * Get cache value
     * @param key - Cache key
     * @returns Cache value, or null if not exists
     */
    get<T>(key: string): Promise<T | null>

    /**
     * Set cache value
     * @param key - Cache key
     * @param value - Cache value
     * @param ttl - Time to live (milliseconds), optional
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>

    /**
     * Delete cache value
     * @param key - Cache key
     */
    delete(key: string): Promise<void>

    /**
     * Check if cache exists
     * @param key - Cache key
     * @returns Whether the cache exists
     */
    has(key: string): Promise<boolean>

    /**
     * Clear all cache
     */
    clear(): Promise<void>

    /**
     * Get cache size
     * @returns Number of cache items
     */
    size(): Promise<number>

    /**
     * Get cache statistics
     * @returns Cache statistics information
     */
    getStats(): Promise<CacheStats>
}

/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Cache provider type */
    provider: "local" | "redis"
    /** Maximum cache size (only for local cache) */
    maxSize?: number
    /** Default TTL (milliseconds) */
    ttl?: number
    /** Redis configuration (only for Redis cache) */
    redis?: {
        host: string
        port: number
        password?: string
        db?: number
        keyPrefix?: string
    }
}
