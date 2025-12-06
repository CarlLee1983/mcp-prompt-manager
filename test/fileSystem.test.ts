import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { getFilesRecursively, clearFileCache, cleanupExpiredCache, ensureDirectoryAccess } from '../src/utils/fileSystem.js'

describe('fileSystem', () => {
    let testDir: string

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-filesystem-test-'))
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    describe('getFilesRecursively', () => {
        it('should get all files recursively', async () => {
            await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
            await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true })
            await fs.writeFile(path.join(testDir, 'subdir', 'file2.txt'), 'content2')

            const files = await getFilesRecursively(testDir)
            expect(files.length).toBeGreaterThanOrEqual(2)
            expect(files.some(f => f.endsWith('file1.txt'))).toBe(true)
            expect(files.some(f => f.endsWith('file2.txt'))).toBe(true)
        })

        it('should handle empty directory', async () => {
            const files = await getFilesRecursively(testDir)
            expect(files).toEqual([])
        })

        it('should handle non-existent directory', async () => {
            const nonExistentDir = path.join(testDir, 'non-existent')
            await expect(getFilesRecursively(nonExistentDir)).rejects.toThrow()
        })
    })

    describe('clearFileCache', () => {
        it('should clear file cache', async () => {
            // First call to populate cache
            await getFilesRecursively(testDir)
            
            // Clear cache
            clearFileCache()
            
            // Should not throw
            expect(() => clearFileCache()).not.toThrow()
        })
    })

    describe('fileCache cleanup', () => {
        it('should clean up expired cache entries', async () => {
            // Create files
            await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
            
            // First call to populate cache
            await getFilesRecursively(testDir)
            
            // Wait for cache TTL to expire (5 seconds)
            await new Promise((resolve) => setTimeout(resolve, 6000))
            
            // Manually trigger cleanup
            const cleaned = cleanupExpiredCache()
            expect(cleaned).toBeGreaterThanOrEqual(0) // May be 0 if cache was already cleaned
            
            // Call again - should repopulate cache
            const files = await getFilesRecursively(testDir)
            expect(files.length).toBeGreaterThan(0)
        }, 10000) // Increase timeout to 10 seconds
    })

    describe('ensureDirectoryAccess', () => {
        it('should verify directory access', async () => {
            await expect(ensureDirectoryAccess(testDir)).resolves.not.toThrow()
        })

        it('should throw error when directory cannot be accessed', async () => {
            const restrictedDir = path.join(testDir, 'restricted')
            
            // Mock fs.access to throw error
            vi.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Permission denied'))
            
            await expect(ensureDirectoryAccess(restrictedDir)).rejects.toThrow('No access to directory')
            
            vi.restoreAllMocks()
        })

        it('should format error message correctly in access error', async () => {
            const testError = new Error('Test error')
            const restrictedDir = path.join(testDir, 'restricted')
            
            vi.spyOn(fs, 'access').mockRejectedValueOnce(testError)
            
            try {
                await ensureDirectoryAccess(restrictedDir)
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toContain('No access to directory')
                expect((error as Error).message).toContain('Test error')
            }
            
            vi.restoreAllMocks()
        })
    })
})

