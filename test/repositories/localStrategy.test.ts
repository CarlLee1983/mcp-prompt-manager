import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalRepositoryStrategy } from '../../src/repositories/localStrategy'
import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'

// Mock dependencies
vi.mock('fs/promises')
vi.mock('chokidar')
vi.mock('../../src/utils/logger')

describe('LocalRepositoryStrategy', () => {
    let strategy: LocalRepositoryStrategy
    const repoPath = '/path/to/source'
    const storageDir = '/path/to/target'

    beforeEach(() => {
        vi.clearAllMocks()
        strategy = new LocalRepositoryStrategy(repoPath)
    })

    describe('validate', () => {
        it('should return true if directory exists', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)
            expect(await strategy.validate()).toBe(true)
        })

        it('should return false if directory does not exist', async () => {
            vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'))
            expect(await strategy.validate()).toBe(false)
        })
    })

    describe('sync', () => {
        it('should copy files from source to target', async () => {
            // Mock source exists
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

            // Mock readdir returning file
            vi.mocked(fs.readdir).mockResolvedValue([
                { name: 'file.txt', isFile: () => true, isDirectory: () => false } as any
            ])

            await strategy.sync(storageDir)

            expect(fs.mkdir).toHaveBeenCalledWith(storageDir, { recursive: true })
            expect(fs.copyFile).toHaveBeenCalledWith(
                path.join(repoPath, 'file.txt'),
                path.join(storageDir, 'file.txt')
            )
        })

        it('should fail if source directory does not exist', async () => {
            vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'))

            await expect(strategy.sync(storageDir)).rejects.toThrow('Source directory does not exist')
        })

        it('should recursively copy directories', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

            // First call (root): has 'subdir'
            // Second call (subdir): has 'file.txt'
            vi.mocked(fs.readdir)
                .mockResolvedValueOnce([
                    { name: 'subdir', isFile: () => false, isDirectory: () => true } as any
                ])
                .mockResolvedValueOnce([
                    { name: 'file.txt', isFile: () => true, isDirectory: () => false } as any
                ])
                .mockResolvedValueOnce([]) // Empty subdir recursion check

            await strategy.sync(storageDir)

            expect(fs.mkdir).toHaveBeenCalledWith(path.join(storageDir, 'subdir'), { recursive: true })
            expect(fs.copyFile).toHaveBeenCalledWith(
                path.join(repoPath, 'subdir', 'file.txt'),
                path.join(storageDir, 'subdir', 'file.txt')
            )
        })

        it('should skip copying if source and target are the same', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

            // Spy on path.resolve to pretend they are the same
            vi.spyOn(path, 'resolve').mockReturnValue('/same/path')

            await strategy.sync('/same/path')

            expect(fs.copyFile).not.toHaveBeenCalled()
        })
    })

    describe('watching', () => {
        it('should start watcher', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            const callback = vi.fn()
            strategy.startWatching(callback)

            expect(chokidar.watch).toHaveBeenCalledWith(repoPath, expect.any(Object))
            expect(strategy.isWatching()).toBe(true)
        })

        it('should stop watcher', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            strategy.startWatching(vi.fn())
            strategy.stopWatching()

            expect(mockWatcher.close).toHaveBeenCalled()
            expect(strategy.isWatching()).toBe(false)
        })
    })
})
