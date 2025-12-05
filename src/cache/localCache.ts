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
        expirations: 0,
        totalAccesses: 0,
    }
    private createdAt: number
    private lastCleanup: number | undefined
    private cleanupInterval: NodeJS.Timeout | null = null
    private cleanupIntervalMs: number

    /**
     * 建立本地快取實例
     * @param maxSize - 最大快取大小，預設 1000
     * @param defaultTTL - 預設 TTL（毫秒），可選
     * @param cleanupIntervalMs - TTL 清理間隔（毫秒），預設 60000（1分鐘）
     */
    constructor(maxSize: number = 1000, defaultTTL?: number, cleanupIntervalMs: number = 60000) {
        this.maxSize = maxSize
        this.defaultTTL = defaultTTL
        this.cleanupIntervalMs = cleanupIntervalMs
        this.createdAt = Date.now()
        
        // 如果有 TTL，啟動定期清理
        if (defaultTTL) {
            this.startCleanupInterval()
        }
        
        logger.debug(
            { maxSize, defaultTTL, cleanupIntervalMs },
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
            this.stats.expirations++
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
                this.stats.expirations++
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
            expirations: 0,
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

        // 計算平均存取次數
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

        // 取得最熱門的鍵（前 10 個）
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

        // 可選欄位
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
            this.stats.expirations++
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
            expirations: 0,
            totalAccesses: 0,
        }
        logger.info({ cleared: size }, 'Cache cleared')
    }

    /**
     * 驅逐最舊的快取項目（LRU 策略）
     * 改進：同時考慮 lastAccessed 和 accessCount
     */
    private evictOldest(): void {
        let oldestKey: string | null = null
        let highestScore = -1

        const now = Date.now()
        
        for (const [key, entry] of this.cache.entries()) {
            // 計算驅逐分數：考慮最後存取時間和存取頻率
            // 分數越高，越應該被驅逐
            // 公式：時間距離（毫秒） / (存取次數 + 1)
            // 這樣可以優先保留經常存取的項目
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
     * 啟動定期清理過期項目
     */
    private startCleanupInterval(): void {
        if (this.cleanupInterval) {
            return // 已經啟動
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired()
        }, this.cleanupIntervalMs)

        // 確保在進程退出時清理
        if (typeof process !== 'undefined') {
            process.once('SIGINT', () => this.stopCleanupInterval())
            process.once('SIGTERM', () => this.stopCleanupInterval())
        }
    }

    /**
     * 停止定期清理
     */
    private stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
    }

    /**
     * 清理過期的快取項目
     * @returns 清理的項目數量
     */
    private cleanupExpired(): number {
        const now = Date.now()
        let cleaned = 0
        const expiredKeys: string[] = []

        // 收集過期的鍵
        for (const [key, entry] of this.cache.entries()) {
            if (entry.ttl && now - entry.timestamp > entry.ttl) {
                expiredKeys.push(key)
            }
        }

        // 刪除過期的項目
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
     * 手動觸發清理過期項目
     */
    public cleanup(): Promise<number> {
        return Promise.resolve(this.cleanupExpired())
    }

    /**
     * 銷毀快取實例（清理資源）
     */
    public destroy(): void {
        this.stopCleanupInterval()
        this.cache.clear()
        logger.info('Local cache destroyed')
    }
}

