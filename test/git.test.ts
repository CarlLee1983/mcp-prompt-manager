import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { syncRepo } from '../src/services/git.js'
import * as env from '../src/config/env.js'
import * as fileSystem from '../src/utils/fileSystem.js'
import { logger } from '../src/utils/logger.js'

// Mock dependencies
vi.mock('../src/config/env.js', async () => {
    const actual = await vi.importActual('../src/config/env.js')
    return {
        ...actual,
        getRepoUrl: vi.fn(),
        getGitBranch: vi.fn(),
        STORAGE_DIR: '/tmp/test-storage', // Will be overridden in tests
        GIT_MAX_RETRIES: 3,
    }
})

vi.mock('../src/utils/fileSystem.js', () => ({
    ensureDirectoryAccess: vi.fn(),
    clearFileCache: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

// Mock simple-git
const mockGit = {
    fetch: vi.fn(),
    pull: vi.fn(),
    reset: vi.fn(),
    revparse: vi.fn(),
    clone: vi.fn(),
}

vi.mock('simple-git', () => ({
    simpleGit: vi.fn(() => mockGit),
}))

describe('git.ts', () => {
    let testStorageDir: string
    let testSourceDir: string

    beforeEach(async () => {
        // Create temporary directories
        testStorageDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'mcp-git-test-storage-')
        )
        testSourceDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'mcp-git-test-source-')
        )

        // Reset mocks
        vi.clearAllMocks()
        vi.spyOn(env, 'getRepoUrl').mockReturnValue('')
        vi.spyOn(env, 'getGitBranch').mockReturnValue('main')
        
        // Override STORAGE_DIR for this test
        Object.defineProperty(env, 'STORAGE_DIR', {
            value: testStorageDir,
            writable: true,
            configurable: true,
        })

        // Don't mock fs.stat by default - let individual tests decide
    })

    afterEach(async () => {
        // Clean up
        try {
            await fs.rm(testStorageDir, { recursive: true, force: true })
            await fs.rm(testSourceDir, { recursive: true, force: true })
        } catch {
            // Ignore cleanup errors
        }
    })

    describe('syncRepo - 錯誤處理', () => {
        it('應該在缺少 PROMPT_REPO_URL 時拋出錯誤', async () => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue('')

            await expect(syncRepo()).rejects.toThrow(
                '❌ Error: PROMPT_REPO_URL is missing.'
            )
        })
    })

    describe('syncRepo - 本地路徑同步', () => {
        beforeEach(async () => {
            // Create test files in source directory
            await fs.writeFile(
                path.join(testSourceDir, 'test-file.txt'),
                'test content'
            )
            await fs.mkdir(path.join(testSourceDir, 'subdir'), {
                recursive: true,
            })
            await fs.writeFile(
                path.join(testSourceDir, 'subdir', 'nested.txt'),
                'nested content'
            )
        })

        it('應該從本地路徑複製檔案', async () => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(testSourceDir)
            vi.spyOn(fs, 'stat')
                .mockResolvedValueOnce({} as any) // Source exists
                .mockRejectedValueOnce(new Error('Not found')) // Storage doesn't exist

            await syncRepo()

            // Verify files were copied
            const copiedFile = await fs.readFile(
                path.join(testStorageDir, 'test-file.txt'),
                'utf-8'
            )
            expect(copiedFile).toBe('test content')

            const nestedFile = await fs.readFile(
                path.join(testStorageDir, 'subdir', 'nested.txt'),
                'utf-8'
            )
            expect(nestedFile).toBe('nested content')

            // Verify cache was cleared
            expect(fileSystem.clearFileCache).toHaveBeenCalledWith(
                testStorageDir
            )
        })

        it('應該排除 .git 目錄', async () => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(testSourceDir)
            await fs.mkdir(path.join(testSourceDir, '.git'), {
                recursive: true,
            })
            await fs.writeFile(
                path.join(testSourceDir, '.git', 'config'),
                'git config'
            )
            await fs.writeFile(
                path.join(testSourceDir, 'test-file.txt'),
                'content'
            )

            // Restore real fs.stat for this test
            vi.restoreAllMocks()
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(testSourceDir)
            vi.spyOn(env, 'getGitBranch').mockReturnValue('main')
            Object.defineProperty(env, 'STORAGE_DIR', {
                value: testStorageDir,
                writable: true,
                configurable: true,
            })

            await syncRepo()

            // Verify .git directory was not copied
            await expect(
                fs.stat(path.join(testStorageDir, '.git'))
            ).rejects.toThrow()
            
            // But other files should be copied
            const copiedFile = await fs.readFile(
                path.join(testStorageDir, 'test-file.txt'),
                'utf-8'
            )
            expect(copiedFile).toBe('content')
        })

        it('應該排除 node_modules 目錄', async () => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(testSourceDir)
            await fs.mkdir(path.join(testSourceDir, 'node_modules'), {
                recursive: true,
            })
            await fs.writeFile(
                path.join(testSourceDir, 'node_modules', 'package.json'),
                '{}'
            )
            await fs.writeFile(
                path.join(testSourceDir, 'test-file.txt'),
                'content'
            )

            // Mock fs.stat: source exists, storage doesn't
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                const pathStr = String(pathArg)
                if (pathStr === testSourceDir) {
                    return {} as any // Source exists
                }
                if (pathStr === testStorageDir) {
                    throw new Error('Not found') // Storage doesn't exist
                }
                // For other paths, use real fs.stat
                return fs.stat(pathArg)
            })

            await syncRepo()

            // Verify node_modules was not copied
            await expect(
                fs.stat(path.join(testStorageDir, 'node_modules'))
            ).rejects.toThrow()
            
            // But other files should be copied
            const copiedFile = await fs.readFile(
                path.join(testStorageDir, 'test-file.txt'),
                'utf-8'
            )
            expect(copiedFile).toBe('content')
        })

        it('應該在來源目錄不存在時拋出錯誤', async () => {
            const nonExistentPath = path.join(os.tmpdir(), 'non-existent')
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(nonExistentPath)
            
            // Mock fs.stat to fail for the source directory check
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                if (String(pathArg) === nonExistentPath) {
                    throw new Error('Not found')
                }
                throw new Error('Not found')
            })

            await expect(syncRepo()).rejects.toThrow(
                'Local repository sync failed'
            )
            await expect(syncRepo()).rejects.toThrow(
                'Source directory does not exist'
            )
        })

        it('應該在複製失敗時記錄警告但繼續處理', async () => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(testSourceDir)
            
            // Create test files
            await fs.writeFile(
                path.join(testSourceDir, 'file1.txt'),
                'content1'
            )
            await fs.writeFile(
                path.join(testSourceDir, 'file2.txt'),
                'content2'
            )

            // Mock fs.stat only for the initial source check
            let statCallCount = 0
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                const pathStr = String(pathArg)
                statCallCount++
                // First call: check if source exists
                if (statCallCount === 1 && pathStr === testSourceDir) {
                    return {} as any // Source exists
                }
                // For all other calls, use real fs.stat
                return fs.stat(pathArg)
            })

            // Mock copyFile to fail for one file
            let copyCount = 0
            const originalCopyFile = fs.copyFile
            vi.spyOn(fs, 'copyFile').mockImplementation(async (src, dest) => {
                copyCount++
                if (copyCount === 1) {
                    throw new Error('Copy failed')
                }
                // For subsequent calls, use real copyFile
                return originalCopyFile(src, dest)
            })

            await syncRepo()

            // Should have logged warning
            expect(logger.warn).toHaveBeenCalled()
            
            // Other files should still be copied
            const file2 = await fs.readFile(
                path.join(testStorageDir, 'file2.txt'),
                'utf-8'
            )
            expect(file2).toBe('content2')
        })
    })

    describe('syncRepo - 遠端 Git 同步', () => {
        beforeEach(() => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(
                'https://github.com/user/repo.git'
            )
        })

        it('應該在目錄不存在時執行首次 clone', async () => {
            vi.spyOn(fs, 'stat')
                .mockRejectedValueOnce(new Error('Not found')) // Storage doesn't exist
                .mockResolvedValueOnce({} as any) // mkdir succeeds

            mockGit.clone.mockResolvedValue(undefined)

            await syncRepo()

            expect(mockGit.clone).toHaveBeenCalledWith(
                'https://github.com/user/repo.git',
                testStorageDir,
                ['-b', 'main']
            )
            expect(fileSystem.clearFileCache).toHaveBeenCalledWith(
                testStorageDir
            )
        })

        it('應該在目錄存在但不是 Git 倉庫時重新 clone', async () => {
            // Storage exists but is not a git repo
            vi.spyOn(fs, 'stat')
                .mockResolvedValueOnce({} as any) // Storage exists
                .mockRejectedValueOnce(new Error('Not found')) // .git doesn't exist

            mockGit.clone.mockResolvedValue(undefined)

            await syncRepo()

            expect(mockGit.clone).toHaveBeenCalled()
            expect(fileSystem.clearFileCache).toHaveBeenCalled()
        })

        it('應該在現有 Git 倉庫中執行 fetch 和 pull', async () => {
            // Storage exists and is a git repo
            vi.spyOn(fs, 'stat')
                .mockResolvedValueOnce({} as any) // Storage exists
                .mockResolvedValueOnce({} as any) // .git exists

            mockGit.fetch.mockResolvedValue(undefined)
            mockGit.pull.mockResolvedValue(undefined)
            mockGit.revparse.mockResolvedValue('main')

            await syncRepo()

            expect(mockGit.fetch).toHaveBeenCalled()
            expect(mockGit.pull).toHaveBeenCalledWith(['--rebase'])
            expect(fileSystem.clearFileCache).toHaveBeenCalled()
        })

        it('應該在 pull rebase 失敗時使用 reset', async () => {
            vi.spyOn(fs, 'stat')
                .mockResolvedValueOnce({} as any)
                .mockResolvedValueOnce({} as any)

            mockGit.fetch.mockResolvedValue(undefined)
            mockGit.pull.mockRejectedValue(new Error('Rebase failed'))
            mockGit.revparse.mockResolvedValue('main')
            mockGit.reset.mockResolvedValue(undefined)

            await syncRepo()

            expect(mockGit.pull).toHaveBeenCalled()
            expect(mockGit.reset).toHaveBeenCalledWith([
                '--hard',
                'origin/main',
            ])
            expect(logger.warn).toHaveBeenCalled()
        })

        it('應該使用當前分支名稱或預設分支', async () => {
            vi.spyOn(env, 'getGitBranch').mockReturnValue('develop')
            vi.spyOn(fs, 'stat')
                .mockResolvedValueOnce({} as any)
                .mockResolvedValueOnce({} as any)

            mockGit.fetch.mockResolvedValue(undefined)
            mockGit.pull.mockResolvedValue(undefined)
            mockGit.revparse.mockResolvedValue('feature-branch')

            await syncRepo()

            expect(mockGit.revparse).toHaveBeenCalledWith([
                '--abbrev-ref',
                'HEAD',
            ])
        })

        it('應該在分支名稱為空時使用預設分支', async () => {
            vi.spyOn(env, 'getGitBranch').mockReturnValue('main')
            vi.spyOn(fs, 'stat')
                .mockResolvedValueOnce({} as any)
                .mockResolvedValueOnce({} as any)

            mockGit.fetch.mockResolvedValue(undefined)
            mockGit.pull.mockResolvedValue(undefined)
            mockGit.revparse.mockResolvedValue('   ') // Empty/whitespace

            await syncRepo()

            // Should use default branch (main)
            expect(mockGit.reset).not.toHaveBeenCalled()
        })
    })

    describe('syncRepo - 重試機制', () => {
        beforeEach(() => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(
                'https://github.com/user/repo.git'
            )
        })

        it('應該在失敗時重試', async () => {
            // Mock fs.stat: storage doesn't exist
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                if (String(pathArg) === testStorageDir) {
                    throw new Error('Not found') // Storage doesn't exist
                }
                return {} as any
            })

            let attemptCount = 0
            mockGit.clone.mockImplementation(async () => {
                attemptCount++
                if (attemptCount < 2) {
                    throw new Error('Clone failed')
                }
                // Success on second attempt
            })

            await syncRepo(2) // maxRetries = 2

            expect(mockGit.clone).toHaveBeenCalledTimes(2)
            expect(logger.warn).toHaveBeenCalled()
        })

        it('應該在所有重試失敗後拋出錯誤', async () => {
            // Mock fs.stat: storage doesn't exist
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                if (String(pathArg) === testStorageDir) {
                    throw new Error('Not found') // Storage doesn't exist
                }
                return {} as any
            })

            mockGit.clone.mockRejectedValue(new Error('Clone failed'))

            await expect(syncRepo(2)).rejects.toThrow(
                'Git sync failed after 2 attempts'
            )

            expect(mockGit.clone).toHaveBeenCalledTimes(2)
            expect(logger.error).toHaveBeenCalled()
        })

        it('應該使用指數退避延遲', async () => {
            vi.spyOn(fs, 'stat')
                .mockRejectedValueOnce(new Error('Not found'))
                .mockResolvedValueOnce({} as any)

            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            mockGit.clone.mockRejectedValue(new Error('Clone failed'))

            try {
                await syncRepo(2)
            } catch {
                // Expected to fail
            }

            // Verify delay was used (1000 * attempt)
            expect(setTimeoutSpy).toHaveBeenCalled()
        })
    })

    describe('syncRepo - 邊界情況', () => {
        it('應該處理自訂 maxRetries 參數', async () => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(
                'https://github.com/user/repo.git'
            )
            
            // Mock fs.stat: storage doesn't exist (always fail for storage dir)
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                const pathStr = String(pathArg)
                if (pathStr === testStorageDir || pathStr.startsWith(testStorageDir)) {
                    throw new Error('Not found') // Storage doesn't exist
                }
                return {} as any
            })

            mockGit.clone.mockRejectedValue(new Error('Clone failed'))
            
            // Mock setTimeout to resolve immediately
            const originalSetTimeout = global.setTimeout
            vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, delay: any) => {
                // Execute immediately instead of waiting
                Promise.resolve().then(() => fn())
                return {} as any
            })
            
            await expect(syncRepo(5)).rejects.toThrow(
                'Git sync failed after 5 attempts'
            )

            expect(mockGit.clone).toHaveBeenCalledTimes(5)
            
            // Restore original setTimeout
            global.setTimeout = originalSetTimeout
        }, 10000) // Increase timeout for this test

        it('應該正確識別本地路徑（絕對路徑）', async () => {
            // Use actual test source directory
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(testSourceDir)
            
            // Create a test file in source
            await fs.writeFile(
                path.join(testSourceDir, 'test.txt'),
                'test content'
            )
            
            // Mock fs.stat only for the initial source check, let real fs handle the rest
            let statCallCount = 0
            vi.spyOn(fs, 'stat').mockImplementation(async (pathArg: any) => {
                const pathStr = String(pathArg)
                statCallCount++
                // First call: check if source exists
                if (statCallCount === 1 && pathStr === testSourceDir) {
                    return {} as any // Source exists
                }
                // For all other calls, use real fs.stat
                return fs.stat(pathArg)
            })

            await syncRepo()

            // Should use copyLocalRepository, not git clone
            expect(mockGit.clone).not.toHaveBeenCalled()
            
            // Verify file was copied
            const copiedFile = await fs.readFile(
                path.join(testStorageDir, 'test.txt'),
                'utf-8'
            )
            expect(copiedFile).toBe('test content')
        })
    })

    describe('syncRepo - 日誌記錄', () => {
        beforeEach(() => {
            vi.spyOn(env, 'getRepoUrl').mockReturnValue(
                'https://github.com/user/repo.git'
            )
        })

        it('應該記錄同步開始', async () => {
            vi.spyOn(fs, 'stat')
                .mockRejectedValueOnce(new Error('Not found'))
                .mockResolvedValueOnce({} as any)

            mockGit.clone.mockResolvedValue(undefined)

            await syncRepo()

            expect(logger.info).toHaveBeenCalledWith(
                { repoUrl: 'https://github.com/user/repo.git', branch: 'main' },
                'Git syncing from repository'
            )
        })

        it('應該記錄成功訊息', async () => {
            vi.spyOn(fs, 'stat')
                .mockRejectedValueOnce(new Error('Not found'))
                .mockResolvedValueOnce({} as any)

            mockGit.clone.mockResolvedValue(undefined)

            await syncRepo()

            // Check that success message was logged (could be first clone or re-clone)
            const successMessages = [
                'Git first clone successful',
                'Git re-cloned successful',
                'Git sync successful',
            ]
            const infoCalls = (logger.info as any).mock.calls
            const hasSuccessMessage = infoCalls.some((call: any[]) =>
                successMessages.some((msg) => call.includes(msg))
            )
            expect(hasSuccessMessage).toBe(true)
        })

        it('應該記錄錯誤訊息', async () => {
            vi.spyOn(fs, 'stat')
                .mockRejectedValueOnce(new Error('Not found'))
                .mockResolvedValueOnce({} as any)

            mockGit.clone.mockRejectedValue(new Error('Clone failed'))

            try {
                await syncRepo(1)
            } catch {
                // Expected
            }

            expect(logger.error).toHaveBeenCalled()
        })
    })
})

