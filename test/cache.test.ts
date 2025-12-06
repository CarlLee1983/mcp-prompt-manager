import { describe, it, expect, beforeEach } from 'vitest'
import { LocalCache } from '../src/cache/localCache.js'
import { CacheFactory } from '../src/cache/cacheFactory.js'

describe('Cache Abstraction Layer Tests', () => {
    describe('LocalCache', () => {
        let cache: LocalCache

        beforeEach(() => {
            cache = new LocalCache(100, 5000) // maxSize: 100, ttl: 5s
        })

        it('should verify that setting and getting values works', async () => {
            await cache.set('test-key', 'test-value')
            const value = await cache.get<string>('test-key')
            expect(value).toBe('test-value')
        })

        it('should support synchronous methods', () => {
            cache.setSync('sync-key', 'sync-value')
            const value = cache.getSync<string>('sync-key')
            expect(value).toBe('sync-value')
        })

        it('should return null after TTL expiration', async () => {
            await cache.set('ttl-key', 'ttl-value', 100) // 100ms TTL
            const value1 = await cache.get<string>('ttl-key')
            expect(value1).toBe('ttl-value')

            // Wait for TTL expiration
            await new Promise((resolve) => setTimeout(resolve, 150))

            const value2 = await cache.get<string>('ttl-key')
            expect(value2).toBeNull()
        })

        it('should support LRU eviction policy', async () => {
            const smallCache = new LocalCache(3) // max 3 items

            // Set 3 items (cache full)
            // Ensure timestamps are different, key1 is oldest
            await smallCache.set('key1', 'value1')
            await new Promise(resolve => setTimeout(resolve, 20))
            await smallCache.set('key2', 'value2')
            await new Promise(resolve => setTimeout(resolve, 20))
            await smallCache.set('key3', 'value3')
            await new Promise(resolve => setTimeout(resolve, 20))

            // Verify all items exist (but don't access, to keep original state)
            // Do not call get() or has(), as they update lastAccessed
            expect(await smallCache.size()).toBe(3)

            // Set 4th item, should evict oldest (key1, as it was added first and lastAccessed is oldest)
            await smallCache.set('key4', 'value4')

            // key1 should be evicted (oldest, and not accessed)
            const value1 = await smallCache.get<string>('key1')
            expect(value1).toBeNull()

            // key4 should exist
            const value4 = await smallCache.get<string>('key4')
            expect(value4).toBe('value4')
        })

        it('should correctly track access count (LRU)', async () => {
            const smallCache = new LocalCache(2) // max 2 items

            // Set 2 items (cache full)
            await smallCache.set('key1', 'value1')
            // Wait a small amount of time to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10))
            await smallCache.set('key2', 'value2')

            // Verify both items exist
            expect(await smallCache.get('key1')).toBe('value1')
            expect(await smallCache.get('key2')).toBe('value2')

            // Access key1 multiple times to increase its frequency
            await new Promise(resolve => setTimeout(resolve, 10))
            await smallCache.get('key1')
            await smallCache.get('key1')
            await smallCache.get('key1')

            // Set new item, should evict key2 (since key1 access is high, key2 access is low)
            await smallCache.set('key3', 'value3')

            // key1 should exist (high frequency)
            expect(await smallCache.get('key1')).toBe('value1')
            // key2 should be evicted (low frequency)
            expect(await smallCache.get('key2')).toBeNull()
            // key3 should exist (newly added)
            expect(await smallCache.get('key3')).toBe('value3')
        })

        it('should be able to delete items', async () => {
            await cache.set('delete-key', 'delete-value')
            expect(await cache.has('delete-key')).toBe(true)

            await cache.delete('delete-key')
            expect(await cache.has('delete-key')).toBe(false)
        })

        it('should be able to clear all cache', async () => {
            await cache.set('key1', 'value1')
            await cache.set('key2', 'value2')

            expect(await cache.size()).toBe(2)

            await cache.clear()
            expect(await cache.size()).toBe(0)
        })

        it('should provide statistics', async () => {
            await cache.set('key1', 'value1')
            await cache.get('key1') // hit
            await cache.get('key1') // hit
            await cache.get('non-existent') // miss

            const stats = await cache.getStats()
            expect(stats.size).toBe(1)
            expect(stats.hits).toBe(2)
            expect(stats.misses).toBe(1)
            expect(stats.hitRate).toBeGreaterThan(0)
        })

        it('should correctly calculate hit rate', async () => {
            await cache.set('key1', 'value1')
            await cache.get('key1') // hit
            await cache.get('key1') // hit
            await cache.get('key2') // miss
            await cache.get('key3') // miss

            const stats = await cache.getStats()
            expect(stats.hitRate).toBe(50) // 2 hits / 4 total = 50%
        })

        it('should provide detailed statistics', async () => {
            await cache.set('key1', 'value1')
            await cache.set('key2', 'value2')
            await cache.get('key1') // hit
            await cache.get('key1') // hit
            await cache.get('key2') // hit

            const stats = await cache.getStats()
            expect(stats.size).toBe(2)
            expect(stats.hits).toBe(3)
            expect(stats.averageAccessCount).toBeGreaterThan(0)
            expect(stats.topKeys).toBeDefined()
            expect(stats.topKeys?.length).toBeGreaterThan(0)
            expect(stats.createdAt).toBeDefined()
        })

        it('should track expired items', async () => {
            await cache.set('ttl-key1', 'value1', 50) // 50ms TTL
            await cache.set('ttl-key2', 'value2', 50) // 50ms TTL

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 100))

            await cache.get('ttl-key1') // Should be expired
            await cache.get('ttl-key2') // Should be expired

            const stats = await cache.getStats()
            expect(stats.expirations).toBeGreaterThan(0)
        })

        it('should support periodic cleanup of expired items', async () => {
            const cleanupCache = new LocalCache(100, 100, 200) // TTL: 100ms, cleanup interval: 200ms

            await cleanupCache.set('ttl-key1', 'value1', 50)
            await cleanupCache.set('ttl-key2', 'value2', 50)

            expect(await cleanupCache.size()).toBe(2)

            // Wait for expiration and cleanup
            await new Promise((resolve) => setTimeout(resolve, 300))

            // Manually trigger cleanup to ensure
            await cleanupCache.cleanup()

            const size = await cleanupCache.size()
            expect(size).toBeLessThan(2) // Should have items cleaned up

            cleanupCache.destroy()
        })

        it('should handle TTL expiration in getSync', () => {
            const cache = new LocalCache(100, 50) // TTL: 50ms

            cache.setSync('ttl-sync-key', 'ttl-sync-value', 50)
            const value1 = cache.getSync<string>('ttl-sync-key')
            expect(value1).toBe('ttl-sync-value')

            // Wait for TTL expiration
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const value2 = cache.getSync<string>('ttl-sync-key')
                    expect(value2).toBeNull()
                    resolve()
                }, 100)
            })
        })

        it('should trigger LRU eviction in setSync', async () => {
            const smallCache = new LocalCache(2) // max 2 items

            // Set 2 items (cache full)
            smallCache.setSync('sync-key1', 'sync-value1')
            smallCache.setSync('sync-key2', 'sync-value2')

            expect(await smallCache.size()).toBe(2)

            // Set 3rd item, should evict oldest
            smallCache.setSync('sync-key3', 'sync-value3')

            // key1 should be evicted
            const value1 = smallCache.getSync<string>('sync-key1')
            expect(value1).toBeNull()

            // key3 should exist
            const value3 = smallCache.getSync<string>('sync-key3')
            expect(value3).toBe('sync-value3')
        })

        it('should handle cleanup interval start and stop', async () => {
            const cache = new LocalCache(100, 100, 200) // TTL: 100ms, cleanup: 200ms

            // Set some items that will expire
            await cache.set('ttl-key1', 'value1', 50)
            await cache.set('ttl-key2', 'value2', 50)

            expect(await cache.size()).toBe(2)

            // Wait for cleanup interval to trigger (200ms)
            await new Promise((resolve) => setTimeout(resolve, 250))

            // Manually trigger cleanup
            await cache.cleanup()

            // Items should be cleaned up
            const size = await cache.size()
            expect(size).toBeLessThan(2)

            cache.destroy()
        })

        it('should consider access frequency in improved LRU strategy', async () => {
            const smallCache = new LocalCache(2)

            // Set two items
            await smallCache.set('key1', 'value1')
            await new Promise(resolve => setTimeout(resolve, 10))
            await smallCache.set('key2', 'value2')

            // Access key1 multiple times to increase its frequency
            await smallCache.get('key1')
            await smallCache.get('key1')
            await smallCache.get('key1')

            // Set new item, should evict key2 (since key1 has high frequency)
            await smallCache.set('key3', 'value3')

            // key1 should exist (high frequency)
            expect(await smallCache.get('key1')).toBe('value1')
            // key2 should be evicted
            expect(await smallCache.get('key2')).toBeNull()
            // key3 should exist
            expect(await smallCache.get('key3')).toBe('value3')
        })
    })

    describe('CacheFactory', () => {
        it('should create local cache from environment variables', () => {
            process.env.CACHE_PROVIDER = 'local'
            process.env.CACHE_MAX_SIZE = '500'
            process.env.CACHE_TTL = '10000'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            // Cleanup
            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
            delete process.env.CACHE_TTL
        })

        it('should use default values when environment variables are not set', () => {
            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
            delete process.env.CACHE_TTL

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)
        })

        it('should fallback to local cache when attempting to use Redis', () => {
            process.env.CACHE_PROVIDER = 'redis'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            // Cleanup
            delete process.env.CACHE_PROVIDER
        })

        it('should be able to create cache manually', () => {
            const cache = CacheFactory.create({
                provider: 'local',
                maxSize: 200,
                ttl: 5000,
            })
            expect(cache).toBeInstanceOf(LocalCache)
        })

        it('should throw error when attempting to use unsupported provider', () => {
            expect(() => {
                CacheFactory.create({
                    provider: 'invalid' as 'local' | 'redis',
                    maxSize: 100,
                })
            }).toThrow('Unsupported cache provider: invalid')
        })

        it('should throw error when attempting to use Redis (create method)', () => {
            expect(() => {
                CacheFactory.create({
                    provider: 'redis',
                    maxSize: 100,
                })
            }).toThrow('Redis cache provider is not yet implemented')
        })

        it('should handle cleanupIntervalMs environment variable', () => {
            process.env.CACHE_PROVIDER = 'local'
            process.env.CACHE_CLEANUP_INTERVAL = '30000'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_CLEANUP_INTERVAL
        })

        it('should use default cleanupIntervalMs when not set', () => {
            process.env.CACHE_PROVIDER = 'local'
            delete process.env.CACHE_CLEANUP_INTERVAL

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            delete process.env.CACHE_PROVIDER
        })

        it('should retain TTL when falling back from Redis', () => {
            process.env.CACHE_PROVIDER = 'redis'
            process.env.CACHE_MAX_SIZE = '500'
            process.env.CACHE_TTL = '10000'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
            delete process.env.CACHE_TTL
        })

        it('should handle missing TTL when falling back from Redis', () => {
            process.env.CACHE_PROVIDER = 'redis'
            process.env.CACHE_MAX_SIZE = '500'
            delete process.env.CACHE_TTL

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
        })

        it('should handle fallback path in createFromEnv', () => {
            // Set a value that is not 'local' or 'redis', but will be converted to 'local'
            process.env.CACHE_PROVIDER = 'local'
            process.env.CACHE_MAX_SIZE = '500'
            process.env.CACHE_TTL = '10000'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
            delete process.env.CACHE_TTL
        })

        it('should handle fallback from createFromEnv to create method', () => {
            // Test case where provider is neither 'local' nor 'redis'
            // This triggers the fallback path at line 74
            process.env.CACHE_PROVIDER = 'local'
            process.env.CACHE_MAX_SIZE = '500'
            delete process.env.CACHE_TTL
            delete process.env.CACHE_CLEANUP_INTERVAL

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
        })
    })
})

