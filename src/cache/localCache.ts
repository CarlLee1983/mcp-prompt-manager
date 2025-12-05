import type { CacheProvider, CacheStats } from './cacheProvider.js'
import { logger } from '../utils/logger.js'

/**
 * 快取項目內部結構
 */
interface CacheEntry<T> {
    /** 快取值 */
    value: T
    /** 建立時間戳 */
    timestamp: number
    /** 存活時間（毫秒），可選 */
    ttl: number | undefined
    /** 存取次數 */
    accessCount: number
    /** 最後存取時間 */
    lastAccessed: number
}

/**
 * 本地記憶體快取實作
 * 使用 Map 儲存，支援 LRU 策略和 TTL
 * 
 * 注意：為了向後兼容，LocalCache 提供同步方法
 * 這些方法僅用於本地快取，不適用於 Redis 等遠程快取
 */
export class LocalCache implements CacheProvider {
    private cache = new Map<string, CacheEntry<unknown>>()
    private maxSize: number
    private defaultTTL: number | undefined
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalAccesses: 0,
    }

    /**
     * 建立本地快取實例
     * @param maxSize - 最大快取大小，預設 1000
     * @param defaultTTL - 預設 TTL（毫秒），可選
     */
    constructor(maxSize: number = 1000, defaultTTL?: number) {
        this.maxSize = maxSize
        this.defaultTTL = defaultTTL
        logger.debug(
            { maxSize, defaultTTL },
            'Local cache initialized'
        )
    }

    /**
     * 取得快取值
     */
    async get<T>(key: string): Promise<T | null> {
        this.stats.totalAccesses++
        const entry = this.cache.get(key) as CacheEntry<T> | undefined

        if (!entry) {
            this.stats.misses++
            return null
        }

        // 檢查 TTL
        const now = Date.now()
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            this.stats.misses++
            logger.debug({ key }, 'Cache entry expired')
            return null
        }

        // 更新存取統計
        entry.lastAccessed = now
        entry.accessCount++
        this.stats.hits++

        // LRU: 移動到最後（表示最近使用）
        this.cache.delete(key)
        this.cache.set(key, entry)

        return entry.value as T
    }

    /**
     * 設定快取值
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        // 如果超過大小限制且鍵不存在，移除最舊的項目（LRU）
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
     * 刪除快取值
     */
    async delete(key: string): Promise<void> {
        const deleted = this.cache.delete(key)
        if (deleted) {
            logger.debug({ key }, 'Cache entry deleted')
        }
    }

    /**
     * 檢查快取是否存在
     */
    async has(key: string): Promise<boolean> {
        const entry = this.cache.get(key)
        if (!entry) return false

        // 檢查 TTL
        if (entry.ttl) {
            const now = Date.now()
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key)
                return false
            }
        }

        return true
    }

    /**
     * 清除所有快取
     */
    async clear(): Promise<void> {
        const size = this.cache.size
        this.cache.clear()
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalAccesses: 0,
        }
        logger.info({ cleared: size }, 'Cache cleared')
    }

    /**
     * 取得快取大小
     */
    async size(): Promise<number> {
        return this.cache.size
    }

    /**
     * 取得快取統計資訊
     */
    async getStats(): Promise<CacheStats> {
        const hitRate =
            this.stats.totalAccesses > 0
                ? (this.stats.hits / this.stats.totalAccesses) * 100
                : 0

        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: parseFloat(hitRate.toFixed(2)),
            evictions: this.stats.evictions,
        }
    }

    /**
     * 同步取得快取值（僅用於本地快取）
     * 為了向後兼容而提供
     */
    getSync<T>(key: string): T | null {
        this.stats.totalAccesses++
        const entry = this.cache.get(key) as CacheEntry<T> | undefined

        if (!entry) {
            this.stats.misses++
            return null
        }

        // 檢查 TTL
        const now = Date.now()
        if (entry.ttl && now - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            this.stats.misses++
            return null
        }

        // 更新存取統計
        entry.lastAccessed = now
        entry.accessCount++
        this.stats.hits++

        // LRU: 移動到最後（表示最近使用）
        this.cache.delete(key)
        this.cache.set(key, entry)

        return entry.value as T
    }

    /**
     * 同步設定快取值（僅用於本地快取）
     * 為了向後兼容而提供
     */
    setSync<T>(key: string, value: T, ttl?: number): void {
        // 如果超過大小限制且鍵不存在，移除最舊的項目（LRU）
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
     * 同步刪除快取值（僅用於本地快取）
     * 為了向後兼容而提供
     */
    deleteSync(key: string): void {
        const deleted = this.cache.delete(key)
        if (deleted) {
            logger.debug({ key }, 'Cache entry deleted')
        }
    }

    /**
     * 同步清除所有快取（僅用於本地快取）
     * 為了向後兼容而提供
     */
    clearSync(): void {
        const size = this.cache.size
        this.cache.clear()
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalAccesses: 0,
        }
        logger.info({ cleared: size }, 'Cache cleared')
    }

    /**
     * 驅逐最舊的快取項目（LRU 策略）
     */
    private evictOldest(): void {
        let oldestKey: string | null = null
        let oldestTime = Date.now()

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed
                oldestKey = key
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey)
            this.stats.evictions++
            logger.debug({ key: oldestKey }, 'Cache entry evicted (LRU)')
        }
    }
}

