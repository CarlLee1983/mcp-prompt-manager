import type { CacheProvider, CacheConfig } from "./cacheProvider.js"
import { LocalCache } from "./localCache.js"
import { logger } from "../utils/logger.js"

/**
 * Cache factory
 * Creates corresponding cache provider based on configuration
 */
export class CacheFactory {
    /**
     * Create cache provider
     * @param config - Cache configuration
     * @returns Cache provider instance
     */
    static create(config: CacheConfig): CacheProvider {
        switch (config.provider) {
            case "local":
                return new LocalCache(config.maxSize, config.ttl)
            case "redis":
                // Redis cache will be implemented in the future
                throw new Error(
                    'Redis cache provider is not yet implemented. Please use "local" provider for now.'
                )
            default:
                throw new Error(
                    `Unsupported cache provider: ${String(config.provider)}`
                )
        }
    }

    /**
     * Create cache provider from environment variables
     * @returns Cache provider instance
     */
    static createFromEnv(): CacheProvider {
        const provider = (process.env.CACHE_PROVIDER || "local") as
            | "local"
            | "redis"
        const maxSize = process.env.CACHE_MAX_SIZE
            ? parseInt(process.env.CACHE_MAX_SIZE, 10)
            : 1000
        const ttl = process.env.CACHE_TTL
            ? parseInt(process.env.CACHE_TTL, 10)
            : undefined
        const cleanupIntervalMs = process.env.CACHE_CLEANUP_INTERVAL
            ? parseInt(process.env.CACHE_CLEANUP_INTERVAL, 10)
            : 60000 // Default 1 minute

        if (provider === "redis") {
            logger.warn(
                "Redis cache provider is not yet implemented. Falling back to local cache."
            )
            // Temporarily fall back to local cache
            const config: CacheConfig = {
                provider: "local",
                maxSize,
            }
            if (ttl !== undefined) {
                config.ttl = ttl
            }
            return this.create(config)
        }

        logger.info(
            { provider, maxSize, ttl, cleanupIntervalMs },
            "Creating cache provider from environment"
        )

        // For local cache, need to directly create LocalCache instance to support cleanupIntervalMs
        if (provider === "local") {
            return new LocalCache(maxSize, ttl, cleanupIntervalMs)
        }

        return this.create({
            provider: "local",
            maxSize,
            ...(ttl !== undefined && { ttl }),
        })
    }
}
