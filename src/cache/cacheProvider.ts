/**
 * 快取提供者抽象介面
 * 支援本地快取和 Redis 快取（未來）
 */

/**
 * 快取統計資訊
 */
export interface CacheStats {
    /** 快取項目數量 */
    size: number
    /** 快取命中次數 */
    hits: number
    /** 快取未命中次數 */
    misses: number
    /** 快取命中率（百分比） */
    hitRate: number
    /** 被驅逐的項目數量 */
    evictions: number
    /** 過期項目數量 */
    expirations?: number
    /** 平均存取次數 */
    averageAccessCount?: number
    /** 最熱門的鍵（存取次數最多） */
    topKeys?: Array<{ key: string; accessCount: number }>
    /** 快取建立時間 */
    createdAt?: number
    /** 最後清理時間 */
    lastCleanup?: number
}

/**
 * 快取提供者抽象介面
 * 定義所有快取實作必須提供的方法
 */
export interface CacheProvider {
    /**
     * 取得快取值
     * @param key - 快取鍵
     * @returns 快取值，如果不存在則返回 null
     */
    get<T>(key: string): Promise<T | null>

    /**
     * 設定快取值
     * @param key - 快取鍵
     * @param value - 快取值
     * @param ttl - 存活時間（毫秒），可選
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>

    /**
     * 刪除快取值
     * @param key - 快取鍵
     */
    delete(key: string): Promise<void>

    /**
     * 檢查快取是否存在
     * @param key - 快取鍵
     * @returns 是否存在
     */
    has(key: string): Promise<boolean>

    /**
     * 清除所有快取
     */
    clear(): Promise<void>

    /**
     * 取得快取大小
     * @returns 快取項目數量
     */
    size(): Promise<number>

    /**
     * 取得快取統計資訊
     * @returns 快取統計資訊
     */
    getStats(): Promise<CacheStats>
}

/**
 * 快取配置
 */
export interface CacheConfig {
    /** 快取提供者類型 */
    provider: 'local' | 'redis'
    /** 最大快取大小（僅用於本地快取） */
    maxSize?: number
    /** 預設 TTL（毫秒） */
    ttl?: number
    /** Redis 配置（僅用於 Redis 快取） */
    redis?: {
        host: string
        port: number
        password?: string
        db?: number
        keyPrefix?: string
    }
}

