import type { CacheProvider, CacheStats } from './cacheProvider.js'
import { logger } from '../utils/logger.js'

/**
 * Internal cache entry structure
 */
interface CacheEntry<T> {
    /** Cache value */
    value: T
    /** Creation timestamp */
    timestamp: number
    /** Time to live (milliseconds), optional */
    ttl: number | undefined
    /** Access count */
    accessCount: number
    /** Last access timestamp */
    lastAccessed: number
}

/**
 * Local in-memory cache implementation
 * Uses Map for storage, supports LRU strategy and TTL
 * 
 * Note: For backward compatibility, LocalCache provides synchronous methods
 * These methods are only for local cache, not applicable to remote caches like Redis
 */
export class LocalCache implements CacheProvider {
    private cache = new Map<string, CacheEntry<unknown>>()
    private maxSize: number
    private defaultTTL: number | undefined
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        expirations: 0,
        totalAccesses: 0,
    }
    private createdAt: number
    private lastCleanup: number | undefined
    private cleanupInterval: NodeJS.Timeout | null = null
    private cleanupIntervalMs: number

    /**
     * Create local cache instance
     * @param maxSize - Maximum cache size, default 1000
     * @param defaultTTL - Default TTL (milliseconds), optional
     * @param cleanupIntervalMs - TTL cleanup interval (milliseconds), default 60000 (1 minute)
     */
    constructor(maxSize: number = 1000, defaultTTL?: number, cleanupIntervalMs: number = 60000) {
        this.maxSize = maxSize
        this.defaultTTL = defaultTTL
        this.cleanupIntervalMs = cleanupIntervalMs
        this.createdAt = Date.now()
        
        // Start periodic cleanup if TTL is set
        if (defaultTTL) {
            this.startCleanupInterval()
        }
        
        logger.debug(
            { maxSize, defaultTTL, cleanupIntervalMs },
            'Local cache initialized'
        )
    }


    /**
     * Get cache value
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async get<T>(key: string): Promise<T | null> {
        this.stats.totalAccesses++
        const entry = this.cache.get(key) as CacheEntry<T> | undefined

        if (!entry) {
            this.stats.misses++
            return null
        }

        // Check TTL
        const now = Date.now()
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            this.stats.misses++
            this.stats.expirations++
            logger.debug({ key }, 'Cache entry expired')
            return null
        }

        // Update access statistics
        entry.lastAccessed = now
        entry.accessCount++
        this.stats.hits++

        // LRU: Move to end (indicates recently used)
        this.cache.delete(key)
        this.cache.set(key, entry)

        return entry.value as unknown as T
    }

    /**
     * Set cache value
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        // If exceeds size limit and key doesn't exist, remove oldest item (LRU)
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest()
        }

        const entry: CacheEntry<T> = {
            value,
            timestamp: Date.now(),
            ttl: ttl ?? this.defaultTTL,
            accessCount: 1,
            lastAccessed: Date.now(),
        }

        this.cache.set(key, entry)
        logger.debug({ key, ttl: entry.ttl }, 'Cache entry set')
    }

    /**
     * Delete cache value
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async delete(key: string): Promise<void> {
        const deleted = this.cache.delete(key)
        if (deleted) {
            logger.debug({ key }, 'Cache entry deleted')
        }
    }

    /**
     * Check if cache exists
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async has(key: string): Promise<boolean> {
        const entry = this.cache.get(key)
        if (!entry) return false

        // Check TTL
        if (entry.ttl) {
            const now = Date.now()
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key)
                this.stats.expirations++
                return false
            }
        }

        return true
    }

    /**
     * Clear all cache
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async clear(): Promise<void> {
        const size = this.cache.size
        this.cache.clear()
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            expirations: 0,
            totalAccesses: 0,
        }
        logger.info({ cleared: size }, 'Cache cleared')
    }

    /**
     * Get cache size
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async size(): Promise<number> {
        return this.cache.size
    }

    /**
     * Get cache statistics
     * Note: This method is async to match CacheProvider interface,
     * but implementation is synchronous for local cache
     */
    // eslint-disable-next-line @typescript-eslint/require-await
    async getStats(): Promise<CacheStats> {
        const hitRate =
            this.stats.totalAccesses > 0
                ? (this.stats.hits / this.stats.totalAccesses) * 100
                : 0

        // Calculate average access count
        let totalAccessCount = 0
        const accessCounts: Array<{ key: string; accessCount: number }> = []
        
        for (const [key, entry] of this.cache.entries()) {
            totalAccessCount += entry.accessCount
            accessCounts.push({ key, accessCount: entry.accessCount })
        }
        
        const averageAccessCount =
            this.cache.size > 0
                ? parseFloat((totalAccessCount / this.cache.size).toFixed(2))
                : 0

        // Get top keys (top 10)
        const topKeys = accessCounts
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 10)

        const stats: CacheStats = {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: parseFloat(hitRate.toFixed(2)),
            evictions: this.stats.evictions,
        }

        // Optional fields
        if (this.stats.expirations !== undefined) {
            stats.expirations = this.stats.expirations
        }
        if (averageAccessCount > 0) {
            stats.averageAccessCount = averageAccessCount
        }
        if (topKeys.length > 0) {
            stats.topKeys = topKeys
        }
        if (this.createdAt) {
            stats.createdAt = this.createdAt
        }
        if (this.lastCleanup) {
            stats.lastCleanup = this.lastCleanup
        }

        return stats
    }

    /**
     * Synchronously get cache value (only for local cache)
     * Provided for backward compatibility
     */
    getSync<T>(key: string): T | null {
        this.stats.totalAccesses++
        const entry = this.cache.get(key) as CacheEntry<T> | undefined

        if (!entry) {
            this.stats.misses++
            return null
        }

        // Check TTL
        const now = Date.now()
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            this.stats.misses++
            this.stats.expirations++
            return null
        }

        // Update access statistics
        entry.lastAccessed = now
        entry.accessCount++
        this.stats.hits++

        // LRU: Move to end (indicates recently used)
        this.cache.delete(key)
        this.cache.set(key, entry)

        return entry.value as unknown as T
    }

    /**
     * Synchronously set cache value (only for local cache)
     * Provided for backward compatibility
     */
    setSync<T>(key: string, value: T, ttl?: number): void {
        // If exceeds size limit and key doesn't exist, remove oldest item (LRU)
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest()
        }

        const entry: CacheEntry<T> = {
            value,
            timestamp: Date.now(),
            ttl: ttl ?? this.defaultTTL,
            accessCount: 1,
            lastAccessed: Date.now(),
        }

        this.cache.set(key, entry)
    }

    /**
     * Synchronously delete cache value (only for local cache)
     * Provided for backward compatibility
     */
    deleteSync(key: string): void {
        const deleted = this.cache.delete(key)
        if (deleted) {
            logger.debug({ key }, 'Cache entry deleted')
        }
    }

    /**
     * Synchronously clear all cache (only for local cache)
     * Provided for backward compatibility
     */
    clearSync(): void {
        const size = this.cache.size
        this.cache.clear()
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            expirations: 0,
            totalAccesses: 0,
        }
        logger.info({ cleared: size }, 'Cache cleared')
    }

    /**
     * Evict oldest cache item (LRU strategy)
     * Improved: Considers both lastAccessed and accessCount
     */
    private evictOldest(): void {
        let oldestKey: string | null = null
        let highestScore = -1

        const now = Date.now()
        
        for (const [key, entry] of this.cache.entries()) {
            // Calculate eviction score: considers last access time and access frequency
            // Higher score means more likely to be evicted
            // Formula: time distance (ms) / (access count + 1)
            // This prioritizes keeping frequently accessed items
            const timeSinceAccess = now - entry.lastAccessed
            const score = timeSinceAccess / (entry.accessCount + 1)
            
            if (score > highestScore) {
                highestScore = score
                oldestKey = key
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey)
            this.stats.evictions++
            logger.debug({ key: oldestKey, score: highestScore.toFixed(2) }, 'Cache entry evicted (LRU)')
        }
    }

    /**
     * Start periodic cleanup of expired items
     */
    private startCleanupInterval(): void {
        if (this.cleanupInterval) {
            return // Already started
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired()
        }, this.cleanupIntervalMs)

        // Ensure cleanup on process exit
        if (typeof process !== 'undefined') {
            process.once('SIGINT', () => this.stopCleanupInterval())
            process.once('SIGTERM', () => this.stopCleanupInterval())
        }
    }

    /**
     * Stop periodic cleanup
     */
    private stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
    }

    /**
     * Clean up expired cache items
     * @returns Number of cleaned items
     */
    private cleanupExpired(): number {
        const now = Date.now()
        let cleaned = 0
        const expiredKeys: string[] = []

        // Collect expired keys
        for (const [key, entry] of this.cache.entries()) {
            if (entry.ttl && now - entry.timestamp > entry.ttl) {
                expiredKeys.push(key)
            }
        }

        // Delete expired items
        for (const key of expiredKeys) {
            this.cache.delete(key)
            this.stats.expirations++
            cleaned++
        }

        if (cleaned > 0) {
            this.lastCleanup = now
            logger.debug({ cleaned }, 'Expired cache entries cleaned')
        }

        return cleaned
    }

    /**
     * Manually trigger cleanup of expired items
     */
    public cleanup(): Promise<number> {
        return Promise.resolve(this.cleanupExpired())
    }

    /**
     * Destroy cache instance (clean up resources)
     */
    public destroy(): void {
        this.stopCleanupInterval()
        this.cache.clear()
        logger.info('Local cache destroyed')
    }
}

