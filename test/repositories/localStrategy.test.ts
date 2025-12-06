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

            // Mock readdir with withFileTypes: true returning Dirent objects
            vi.mocked(fs.readdir).mockImplementation(async (dir, options) => {
                if (options && typeof options === 'object' && 'withFileTypes' in options && options.withFileTypes) {
                    return [
                        { name: 'file.txt', isFile: () => true, isDirectory: () => false } as any
                    ] as any
                }
                return [] as any
            })

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

            // Mock readdir with withFileTypes: true
            let callCount = 0
            vi.mocked(fs.readdir).mockImplementation(async (dir, options) => {
                if (options && typeof options === 'object' && 'withFileTypes' in options && options.withFileTypes) {
                    callCount++
                    if (callCount === 1) {
                        // First call (root): has 'subdir'
                        return [{ name: 'subdir', isFile: () => false, isDirectory: () => true } as any] as any
                    } else if (callCount === 2) {
                        // Second call (subdir): has 'file.txt'
                        return [{ name: 'file.txt', isFile: () => true, isDirectory: () => false } as any] as any
                    }
                    return [] as any
                }
                return [] as any
            })

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

    describe('sync edge cases', () => {
        it('should skip excluded items when copying', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

            // Ensure path.resolve returns different paths
            vi.spyOn(path, 'resolve').mockImplementation((...paths) => {
                const joined = path.join(...paths)
                // Return different resolved paths for source and target
                if (joined.includes('source')) {
                    return '/resolved/source'
                }
                return '/resolved/target'
            })

            // Mock readdir with withFileTypes: true returning Dirent objects
            vi.mocked(fs.readdir).mockImplementation(async (dir, options) => {
                if (options && typeof options === 'object' && 'withFileTypes' in options && options.withFileTypes) {
                    return [
                        { name: '.git', isFile: () => false, isDirectory: () => true } as any,
                        { name: 'node_modules', isFile: () => false, isDirectory: () => true } as any,
                        { name: 'file.txt', isFile: () => true, isDirectory: () => false } as any
                    ] as any
                }
                return [] as any
            })

            await strategy.sync(storageDir)

            // Should not copy excluded items (they are skipped in the loop)
            // Should copy non-excluded files
            expect(fs.copyFile).toHaveBeenCalledWith(
                path.join(repoPath, 'file.txt'),
                path.join(storageDir, 'file.txt')
            )
        })

        it('should handle copy errors gracefully', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

            // Ensure path.resolve returns different paths
            vi.spyOn(path, 'resolve').mockImplementation((...paths) => {
                const joined = path.join(...paths)
                if (joined.includes('source')) {
                    return '/resolved/source'
                }
                return '/resolved/target'
            })

            vi.mocked(fs.readdir).mockImplementation(async (dir, options) => {
                if (options && typeof options === 'object' && 'withFileTypes' in options && options.withFileTypes) {
                    return [
                        { name: 'file1.txt', isFile: () => true, isDirectory: () => false } as any,
                        { name: 'file2.txt', isFile: () => true, isDirectory: () => false } as any
                    ] as any
                }
                return [] as any
            })

            // Mock copyFile to fail for first file, succeed for second
            vi.mocked(fs.copyFile)
                .mockRejectedValueOnce(new Error('Copy failed'))
                .mockResolvedValueOnce(undefined)

            await strategy.sync(storageDir)

            // Should continue processing other files (both should be attempted)
            expect(fs.copyFile).toHaveBeenCalledTimes(2)
        })

        it('should skip non-file, non-directory entries', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

            // Ensure path.resolve returns different paths
            vi.spyOn(path, 'resolve').mockImplementation((...paths) => {
                const joined = path.join(...paths)
                if (joined.includes('source')) {
                    return '/resolved/source'
                }
                return '/resolved/target'
            })

            // Mock readdir with withFileTypes: true
            vi.mocked(fs.readdir).mockImplementation(async (dir, options) => {
                if (options && typeof options === 'object' && 'withFileTypes' in options && options.withFileTypes) {
                    return [
                        { name: 'symlink', isFile: () => false, isDirectory: () => false } as any,
                        { name: 'file.txt', isFile: () => true, isDirectory: () => false } as any
                    ] as any
                }
                return [] as any
            })

            await strategy.sync(storageDir)

            // Should not copy symlink (it's skipped in the loop)
            // Should copy regular file
            expect(fs.copyFile).toHaveBeenCalledWith(
                path.join(repoPath, 'file.txt'),
                path.join(storageDir, 'file.txt')
            )
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

        it('should stop existing watcher when starting new one', () => {
            const mockWatcher1 = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            const mockWatcher2 = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch)
                .mockReturnValueOnce(mockWatcher1 as any)
                .mockReturnValueOnce(mockWatcher2 as any)

            strategy.startWatching(vi.fn())
            expect(strategy.isWatching()).toBe(true)

            strategy.startWatching(vi.fn())
            expect(mockWatcher1.close).toHaveBeenCalled()
            expect(strategy.isWatching()).toBe(true)
        })

        it('should use custom watchPath when provided', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            const customPath = '/custom/watch/path'
            strategy.startWatching(vi.fn(), customPath)

            expect(chokidar.watch).toHaveBeenCalledWith(customPath, expect.any(Object))
        })

        it('should trigger callback on file change for YAML files', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            const callback = vi.fn()
            strategy.startWatching(callback)

            // Simulate change event
            const changeHandler = mockWatcher.on.mock.calls.find(
                (call) => call[0] === 'change'
            )?.[1] as (filePath: string) => void

            changeHandler?.('test.yaml')
            expect(callback).toHaveBeenCalledWith('test.yaml')

            changeHandler?.('test.yml')
            expect(callback).toHaveBeenCalledWith('test.yml')

            // Should not trigger for non-YAML files
            callback.mockClear()
            changeHandler?.('test.txt')
            expect(callback).not.toHaveBeenCalled()
        })

        it('should trigger callback on file add for YAML files', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            const callback = vi.fn()
            strategy.startWatching(callback)

            // Simulate add event
            const addHandler = mockWatcher.on.mock.calls.find(
                (call) => call[0] === 'add'
            )?.[1] as (filePath: string) => void

            addHandler?.('new-file.yaml')
            expect(callback).toHaveBeenCalledWith('new-file.yaml')
        })

        it('should trigger callback on file delete for YAML files', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            const callback = vi.fn()
            strategy.startWatching(callback)

            // Simulate unlink event
            const unlinkHandler = mockWatcher.on.mock.calls.find(
                (call) => call[0] === 'unlink'
            )?.[1] as (filePath: string) => void

            unlinkHandler?.('deleted-file.yaml')
            expect(callback).toHaveBeenCalledWith('deleted-file.yaml')
        })

        it('should handle watcher error event', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            strategy.startWatching(vi.fn())

            // Simulate error event
            const errorHandler = mockWatcher.on.mock.calls.find(
                (call) => call[0] === 'error'
            )?.[1] as (error: unknown) => void

            errorHandler?.(new Error('Watcher error'))
            // Should not throw, error should be logged
            expect(strategy.isWatching()).toBe(true)
        })

        it('should handle watcher ready event', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn()
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            strategy.startWatching(vi.fn())

            // Simulate ready event
            const readyHandler = mockWatcher.on.mock.calls.find(
                (call) => call[0] === 'ready'
            )?.[1] as () => void

            readyHandler?.()
            // Should not throw
            expect(strategy.isWatching()).toBe(true)
        })

        it('should handle watcher start failure', () => {
            vi.mocked(chokidar.watch).mockImplementation(() => {
                throw new Error('Failed to start watcher')
            })

            expect(() => {
                strategy.startWatching(vi.fn())
            }).toThrow('Failed to start watcher')

            expect(strategy.isWatching()).toBe(false)
        })

        it('should handle stop watcher error', () => {
            const mockWatcher = {
                on: vi.fn().mockReturnThis(),
                close: vi.fn().mockImplementation(() => {
                    throw new Error('Close failed')
                })
            }
            vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

            strategy.startWatching(vi.fn())
            strategy.stopWatching()

            // Should not throw, error should be logged
            expect(strategy.isWatching()).toBe(false)
        })

        it('should not stop watcher if not started', () => {
            strategy.stopWatching()
            expect(strategy.isWatching()).toBe(false)
        })
    })
})
