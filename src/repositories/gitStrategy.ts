import { simpleGit, type SimpleGitOptions } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import type { RepositoryStrategy } from './strategy.js'
import { logger } from '../utils/logger.js'
import { ensureDirectoryAccess, clearFileCache } from '../utils/fileSystem.js'
import { GIT_MAX_RETRIES } from '../config/env.js'

/**
 * Git Repository Strategy
 * Handles synchronization operations for Git remote repositories
 */
export class GitRepositoryStrategy implements RepositoryStrategy {
    private readonly repoUrl: string
    private readonly defaultBranch: string
    private readonly maxRetries: number

    constructor(
        repoUrl: string,
        defaultBranch: string = 'main',
        maxRetries: number = GIT_MAX_RETRIES
    ) {
        this.repoUrl = repoUrl
        this.defaultBranch = defaultBranch
        this.maxRetries = maxRetries
    }

    getType(): string {
        return 'git'
    }

    getUrl(): string {
        return this.repoUrl
    }

    async validate(): Promise<boolean> {
        try {
            // Simple validation: check if URL format is correct
            const isValidUrl =
                this.repoUrl.startsWith('http://') ||
                this.repoUrl.startsWith('https://') ||
                this.repoUrl.startsWith('git@')
            return isValidUrl
        } catch {
            return false
        }
    }

    async sync(
        storageDir: string,
        branch?: string,
        maxRetries?: number
    ): Promise<void> {
        const gitBranch = branch || this.defaultBranch
        const retries = maxRetries ?? this.maxRetries

        logger.info(
            { repoUrl: this.repoUrl, branch: gitBranch },
            'Git syncing from repository'
        )

        const exists = await fs.stat(storageDir).catch(() => null)
        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: storageDir,
            binary: 'git',
            maxConcurrentProcesses: 6,
        }

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                if (exists) {
                    const isRepo = await fs
                        .stat(path.join(storageDir, '.git'))
                        .catch(() => null)
                    if (isRepo) {
                        // Ensure directory is accessible
                        await ensureDirectoryAccess(storageDir)

                        const git = simpleGit(gitOptions)

                        // Fetch remote updates first
                        await git.fetch()

                        // Check current branch
                        const currentBranch = await git.revparse([
                            '--abbrev-ref',
                            'HEAD',
                        ])
                        const branchName = currentBranch.trim() || gitBranch

                        // Try pull with rebase (preferred strategy)
                        try {
                            await git.pull(['--rebase'])
                            logger.info(
                                { branch: branchName },
                                'Git pull with rebase successful'
                            )
                        } catch (rebaseError) {
                            // If rebase fails (possibly due to divergence), use reset to force sync to remote
                            logger.warn(
                                { branch: branchName, error: rebaseError },
                                'Git pull with rebase failed, resetting to remote branch'
                            )
                            const remoteBranch = `origin/${branchName}`
                            await git.reset(['--hard', remoteBranch])
                            logger.info(
                                { branch: branchName },
                                'Git reset to remote branch successful'
                            )
                        }

                        // Clear cache to ensure data consistency
                        clearFileCache(storageDir)
                        logger.info('Git sync successful')
                        return
                    } else {
                        // Directory exists but is not a git repo, re-clone
                        logger.warn(
                            'Directory exists but is not a git repository, re-cloning'
                        )
                        await fs.rm(storageDir, { recursive: true, force: true })
                        await fs.mkdir(storageDir, { recursive: true })
                        await this.cloneRepository(
                            this.repoUrl,
                            storageDir,
                            gitBranch
                        )
                        // Clear cache to ensure data consistency
                        clearFileCache(storageDir)
                        logger.info('Git re-cloned successful')
                        return
                    }
                } else {
                    // Directory doesn't exist, first-time clone
                    await fs.mkdir(storageDir, { recursive: true })
                    await this.cloneRepository(
                        this.repoUrl,
                        storageDir,
                        gitBranch
                    )
                    // Clear cache to ensure data consistency
                    clearFileCache(storageDir)
                    logger.info('Git first clone successful')
                    return
                }
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error))
                logger.warn(
                    { attempt, maxRetries: retries, error: lastError },
                    'Git sync attempt failed'
                )

                if (attempt < retries) {
                    const delay = 1000 * attempt // Exponential backoff
                    logger.info(
                        { delay, nextAttempt: attempt + 1 },
                        'Retrying git sync'
                    )
                    await new Promise((resolve) => setTimeout(resolve, delay))
                    continue
                }
            }
        }

        // All retries failed
        logger.error({ error: lastError }, 'Git sync failed after all retries')
        throw new Error(
            `Git sync failed after ${retries} attempts: ${lastError?.message}`
        )
    }

    /**
     * Clone Git repository to specified directory
     * @param repoUrl - Repository URL (supports HTTP/HTTPS/SSH)
     * @param targetDir - Target directory (must be absolute path)
     * @param branch - Branch name (optional, defaults to repository default branch)
     * @throws {Error} When clone operation fails
     */
    private async cloneRepository(
        repoUrl: string,
        targetDir: string,
        branch?: string
    ): Promise<void> {
        const git = simpleGit()
        const cloneOptions = branch ? ['-b', branch] : []
        await git.clone(repoUrl, targetDir, cloneOptions)
    }
}

