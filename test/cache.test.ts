import { describe, it, expect, beforeEach } from 'vitest'
import { LocalCache } from '../src/cache/localCache.js'
import { CacheFactory } from '../src/cache/cacheFactory.js'

describe('快取抽象層測試', () => {
    describe('LocalCache', () => {
        let cache: LocalCache

        beforeEach(() => {
            cache = new LocalCache(100, 5000) // maxSize: 100, ttl: 5秒
        })

        it('應該可以設定和取得值', async () => {
            await cache.set('test-key', 'test-value')
            const value = await cache.get<string>('test-key')
            expect(value).toBe('test-value')
        })

        it('應該支援同步方法', () => {
            cache.setSync('sync-key', 'sync-value')
            const value = cache.getSync<string>('sync-key')
            expect(value).toBe('sync-value')
        })

        it('應該在 TTL 過期後返回 null', async () => {
            await cache.set('ttl-key', 'ttl-value', 100) // 100ms TTL
            const value1 = await cache.get<string>('ttl-key')
            expect(value1).toBe('ttl-value')

            // 等待 TTL 過期
            await new Promise((resolve) => setTimeout(resolve, 150))

            const value2 = await cache.get<string>('ttl-key')
            expect(value2).toBeNull()
        })

        it('應該支援 LRU 驅逐策略', async () => {
            const smallCache = new LocalCache(3) // 最大 3 個項目

            // 設定 3 個項目（快取滿了）
            // 確保時間戳不同，key1 最舊
            await smallCache.set('key1', 'value1')
            await new Promise(resolve => setTimeout(resolve, 20))
            await smallCache.set('key2', 'value2')
            await new Promise(resolve => setTimeout(resolve, 20))
            await smallCache.set('key3', 'value3')
            await new Promise(resolve => setTimeout(resolve, 20))

            // 確認所有項目都存在（但不存取，保持原始狀態）
            // 不調用 get() 或 has()，因為它們會更新 lastAccessed
            expect(await smallCache.size()).toBe(3)

            // 設定第 4 個項目，應該驅逐最舊的（key1，因為它是最先加入且 lastAccessed 最舊）
            await smallCache.set('key4', 'value4')

            // key1 應該被驅逐（最舊的，且未被存取）
            const value1 = await smallCache.get<string>('key1')
            expect(value1).toBeNull()

            // key4 應該存在
            const value4 = await smallCache.get<string>('key4')
            expect(value4).toBe('value4')
        })

        it('應該正確追蹤存取次數（LRU）', async () => {
            const smallCache = new LocalCache(2) // 最大 2 個項目
            
            // 設定 2 個項目（快取滿了）
            await smallCache.set('key1', 'value1')
            // 等待一小段時間，確保時間戳不同
            await new Promise(resolve => setTimeout(resolve, 10))
            await smallCache.set('key2', 'value2')
            
            // 確認兩個項目都存在
            expect(await smallCache.get('key1')).toBe('value1')
            expect(await smallCache.get('key2')).toBe('value2')
            
            // 多次存取 key1，增加其存取頻率
            await new Promise(resolve => setTimeout(resolve, 10))
            await smallCache.get('key1')
            await smallCache.get('key1')
            await smallCache.get('key1')
            
            // 設定新項目，應該驅逐 key2（因為 key1 存取頻率高，key2 的存取頻率低）
            await smallCache.set('key3', 'value3')

            // key1 應該存在（高存取頻率）
            expect(await smallCache.get('key1')).toBe('value1')
            // key2 應該被驅逐（低存取頻率）
            expect(await smallCache.get('key2')).toBeNull()
            // key3 應該存在（新加入）
            expect(await smallCache.get('key3')).toBe('value3')
        })

        it('應該可以刪除項目', async () => {
            await cache.set('delete-key', 'delete-value')
            expect(await cache.has('delete-key')).toBe(true)

            await cache.delete('delete-key')
            expect(await cache.has('delete-key')).toBe(false)
        })

        it('應該可以清除所有快取', async () => {
            await cache.set('key1', 'value1')
            await cache.set('key2', 'value2')

            expect(await cache.size()).toBe(2)

            await cache.clear()
            expect(await cache.size()).toBe(0)
        })

        it('應該提供統計資訊', async () => {
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

        it('應該正確計算命中率', async () => {
            await cache.set('key1', 'value1')
            await cache.get('key1') // hit
            await cache.get('key1') // hit
            await cache.get('key2') // miss
            await cache.get('key3') // miss

            const stats = await cache.getStats()
            expect(stats.hitRate).toBe(50) // 2 hits / 4 total = 50%
        })

        it('應該提供詳細統計資訊', async () => {
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

        it('應該追蹤過期項目', async () => {
            await cache.set('ttl-key1', 'value1', 50) // 50ms TTL
            await cache.set('ttl-key2', 'value2', 50) // 50ms TTL
            
            // 等待過期
            await new Promise((resolve) => setTimeout(resolve, 100))
            
            await cache.get('ttl-key1') // 應該過期
            await cache.get('ttl-key2') // 應該過期

            const stats = await cache.getStats()
            expect(stats.expirations).toBeGreaterThan(0)
        })

        it('應該支援定期清理過期項目', async () => {
            const cleanupCache = new LocalCache(100, 100, 200) // TTL: 100ms, 清理間隔: 200ms
            
            await cleanupCache.set('ttl-key1', 'value1', 50)
            await cleanupCache.set('ttl-key2', 'value2', 50)
            
            expect(await cleanupCache.size()).toBe(2)
            
            // 等待過期和清理
            await new Promise((resolve) => setTimeout(resolve, 300))
            
            // 手動觸發清理以確保
            await cleanupCache.cleanup()
            
            const size = await cleanupCache.size()
            expect(size).toBeLessThan(2) // 應該有項目被清理
            
            cleanupCache.destroy()
        })

        it('應該改進的 LRU 策略考慮存取頻率', async () => {
            const smallCache = new LocalCache(2)
            
            // 設定兩個項目
            await smallCache.set('key1', 'value1')
            await new Promise(resolve => setTimeout(resolve, 10))
            await smallCache.set('key2', 'value2')
            
            // 多次存取 key1，使其存取頻率更高
            await smallCache.get('key1')
            await smallCache.get('key1')
            await smallCache.get('key1')
            
            // 設定新項目，應該驅逐 key2（因為 key1 存取頻率高）
            await smallCache.set('key3', 'value3')
            
            // key1 應該存在（高存取頻率）
            expect(await smallCache.get('key1')).toBe('value1')
            // key2 應該被驅逐
            expect(await smallCache.get('key2')).toBeNull()
            // key3 應該存在
            expect(await smallCache.get('key3')).toBe('value3')
        })
    })

    describe('CacheFactory', () => {
        it('應該從環境變數建立本地快取', () => {
            process.env.CACHE_PROVIDER = 'local'
            process.env.CACHE_MAX_SIZE = '500'
            process.env.CACHE_TTL = '10000'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            // 清理
            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
            delete process.env.CACHE_TTL
        })

        it('應該使用預設值當環境變數未設定時', () => {
            delete process.env.CACHE_PROVIDER
            delete process.env.CACHE_MAX_SIZE
            delete process.env.CACHE_TTL

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)
        })

        it('應該在嘗試使用 Redis 時回退到本地快取', () => {
            process.env.CACHE_PROVIDER = 'redis'

            const cache = CacheFactory.createFromEnv()
            expect(cache).toBeInstanceOf(LocalCache)

            // 清理
            delete process.env.CACHE_PROVIDER
        })

        it('應該可以手動建立快取', () => {
            const cache = CacheFactory.create({
                provider: 'local',
                maxSize: 200,
                ttl: 5000,
            })
            expect(cache).toBeInstanceOf(LocalCache)
        })
    })
})

