import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitRepositoryStrategy } from '../../src/repositories/gitStrategy'
import { simpleGit } from 'simple-git'
import fs from 'fs/promises'
import { logger } from '../../src/utils/logger'

// Mock simple-git
vi.mock('simple-git')
// Mock fs
vi.mock('fs/promises')
// Mock logger to avoid cluttering output
vi.mock('../../src/utils/logger')

describe('GitRepositoryStrategy', () => {
    let strategy: GitRepositoryStrategy
    const repoUrl = 'https://github.com/example/repo.git'
    const storageDir = '/tmp/test-storage'

    // Mock git instance
    const mockGit = {
        fetch: vi.fn(),
        clone: vi.fn(),
        pull: vi.fn(),
        reset: vi.fn(),
        revparse: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        // Setup simple-git mock
        vi.mocked(simpleGit).mockReturnValue(mockGit as any)

        strategy = new GitRepositoryStrategy(repoUrl)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('validate', () => {
        it('should return true for valid HTTP URL', async () => {
            expect(await strategy.validate()).toBe(true)
        })

        it('should return true for valid HTTPS URL', async () => {
            const httpsStrategy = new GitRepositoryStrategy('https://github.com/example/repo.git')
            expect(await httpsStrategy.validate()).toBe(true)
        })

        it('should return true for valid SSH URL', async () => {
            const sshStrategy = new GitRepositoryStrategy('git@github.com:example/repo.git')
            expect(await sshStrategy.validate()).toBe(true)
        })

        it('should throw error for invalid URL', () => {
            expect(() => new GitRepositoryStrategy('invalid-url')).toThrow()
        })
    })

    describe('getType', () => {
        it('should return "git"', () => {
            expect(strategy.getType()).toBe('git')
        })
    })

    describe('getUrl', () => {
        it('should return the repo URL', () => {
            expect(strategy.getUrl()).toBe(repoUrl)
        })
    })

    describe('sync', () => {
        it('should clone repository if directory does not exist', async () => {
            // Mock directory does not exist
            vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'))

            await strategy.sync(storageDir)

            expect(fs.mkdir).toHaveBeenCalledWith(storageDir, { recursive: true })
            expect(mockGit.clone).toHaveBeenCalledWith(repoUrl, storageDir, ['-b', 'main'])
        })

        it('should pull repository if directory exists and is a git repo', async () => {
            // Mock directory exists
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)
            // Mock .git exists
            vi.mocked(fs.stat).mockResolvedValueOnce({ isDirectory: () => true } as any) // storageDir
                .mockResolvedValueOnce({ isDirectory: () => true } as any) // .git

            // Mock revparse to return branch name
            mockGit.revparse.mockResolvedValue('main')

            await strategy.sync(storageDir)

            expect(mockGit.fetch).toHaveBeenCalled()
            expect(mockGit.pull).toHaveBeenCalledWith(['--rebase'])
        })

        it('should reset repository if rebase fails', async () => {
            // Mock directory exists
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)
            // Mock .git exists
            vi.mocked(fs.stat).mockResolvedValueOnce({ isDirectory: () => true } as any)
                .mockResolvedValueOnce({ isDirectory: () => true } as any)

            mockGit.revparse.mockResolvedValue('main')
            mockGit.pull.mockRejectedValue(new Error('Conflict'))

            await strategy.sync(storageDir)

            expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'origin/main'])
        })

        it('should re-clone if directory exists but is not a git repo', async () => {
            // Mock directory exists
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)
            // Mock .git does NOT exist (first time checks storageDir, second time checks .git)
            vi.mocked(fs.stat).mockResolvedValueOnce({ isDirectory: () => true } as any)
                .mockRejectedValueOnce(new Error('ENOENT'))

            await strategy.sync(storageDir)

            expect(fs.rm).toHaveBeenCalledWith(storageDir, { recursive: true, force: true })
            expect(fs.mkdir).toHaveBeenCalledWith(storageDir, { recursive: true })
            expect(mockGit.clone).toHaveBeenCalledWith(repoUrl, storageDir, ['-b', 'main'])
        })
    })

    describe('polling', () => {
        it('should start polling', async () => {
            vi.useFakeTimers()
            const callback = vi.fn()

            // Mock initial commit hash
            mockGit.revparse.mockResolvedValue('hash1')

            strategy.startPolling(callback, storageDir, 'main', 1000)

            expect(strategy.isPolling()).toBe(true)

            // Fast forward time
            vi.advanceTimersByTime(1000)

            // Advance promises
            await vi.runOnlyPendingTimersAsync()

            // Should verify initial hash check
            expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD'])
        })

        it('should stop polling', () => {
            const callback = vi.fn()
            strategy.startPolling(callback, storageDir)
            expect(strategy.isPolling()).toBe(true)

            strategy.stopPolling()
            expect(strategy.isPolling()).toBe(false)
        })
    })
})
