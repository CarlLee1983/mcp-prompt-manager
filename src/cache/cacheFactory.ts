import type { CacheProvider, CacheConfig } from './cacheProvider.js'
import { LocalCache } from './localCache.js'
import { logger } from '../utils/logger.js'

/**
 * 快取工廠
 * 根據配置建立對應的快取提供者
 */
export class CacheFactory {
    /**
     * 建立快取提供者
     * @param config - 快取配置
     * @returns 快取提供者實例
     */
    static create(config: CacheConfig): CacheProvider {
        switch (config.provider) {
            case 'local':
                return new LocalCache(config.maxSize, config.ttl)
            case 'redis':
                // Redis 快取將在未來實作
                throw new Error(
                    'Redis cache provider is not yet implemented. Please use "local" provider for now.'
                )
            default:
                throw new Error(
                    `Unsupported cache provider: ${config.provider}`
                )
        }
    }

    /**
     * 從環境變數建立快取提供者
     * @returns 快取提供者實例
     */
    static createFromEnv(): CacheProvider {
        const provider = (process.env.CACHE_PROVIDER || 'local') as
            | 'local'
            | 'redis'
        const maxSize = process.env.CACHE_MAX_SIZE
            ? parseInt(process.env.CACHE_MAX_SIZE, 10)
            : 1000
        const ttl = process.env.CACHE_TTL
            ? parseInt(process.env.CACHE_TTL, 10)
            : undefined

        if (provider === 'redis') {
            logger.warn(
                'Redis cache provider is not yet implemented. Falling back to local cache.'
            )
            // 暫時回退到本地快取
            const config: CacheConfig = {
                provider: 'local',
                maxSize,
            }
            if (ttl !== undefined) {
                config.ttl = ttl
            }
            return this.create(config)
        }

        logger.info(
            { provider, maxSize, ttl },
            'Creating cache provider from environment'
        )
        return this.create({
            provider: 'local',
            maxSize,
            ...(ttl !== undefined && { ttl }),
        })
    }
}

