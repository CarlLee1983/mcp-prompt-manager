import fs from 'fs/promises'
import path from 'path'
import { simpleGit, type SimpleGitOptions } from 'simple-git'
import type { Repository, RepositoryConfig } from '../../types/repository.js'
import { logger } from '../../utils/logger.js'
import { ensureDirectoryAccess, clearFileCache } from '../../utils/fileSystem.js'
import { GIT_MAX_RETRIES } from '../../config/env.js'

export class GitRepository implements Repository {
    private config: RepositoryConfig
    private maxRetries: number

    constructor(config: RepositoryConfig, maxRetries: number = GIT_MAX_RETRIES) {
        this.config = config
        this.maxRetries = maxRetries
    }

    async sync(): Promise<void> {
        const { url: repoUrl, branch: gitBranch, targetDir } = this.config

        logger.info({ repoUrl, branch: gitBranch }, 'Git syncing from repository')

        const exists = await fs.stat(targetDir).catch(() => null)
        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: targetDir,
            binary: 'git',
            maxConcurrentProcesses: 6,
        }

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                if (exists) {
                    const isRepo = await fs
                        .stat(path.join(targetDir, '.git'))
                        .catch(() => null)
                    if (isRepo) {
                        // Ensure directory is accessible
                        await ensureDirectoryAccess(targetDir)

                        const git = simpleGit(gitOptions)

                        // Fetch remote updates first
                        await git.fetch()

                        // Check current branch
                        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD'])
                        const branchName = currentBranch.trim() || gitBranch

                        // Try pull with rebase (preferred strategy)
                        try {
                            await git.pull(['--rebase'])
                            logger.info({ branch: branchName }, 'Git pull with rebase successful')
                        } catch (rebaseError) {
                            // If rebase fails (possibly due to divergence), use reset to force sync to remote
                            logger.warn(
                                { branch: branchName, error: rebaseError },
                                'Git pull with rebase failed, resetting to remote branch'
                            )
                            // Assuming origin is the default remote
                            const remoteBranch = `origin/${branchName}`
                            await git.reset(['--hard', remoteBranch])
                            logger.info({ branch: branchName }, 'Git reset to remote branch successful')
                        }

                        // Clear cache to ensure data consistency
                        clearFileCache(targetDir)
                        logger.info('Git sync successful')
                        return
                    } else {
                        // Directory exists but is not a git repo, re-clone
                        logger.warn(
                            'Directory exists but is not a git repository, re-cloning'
                        )
                        await fs.rm(targetDir, { recursive: true, force: true })
                        await fs.mkdir(targetDir, { recursive: true })
                        await this.cloneRepository(repoUrl, targetDir, gitBranch)
                        // Clear cache to ensure data consistency
                        clearFileCache(targetDir)
                        logger.info('Git re-cloned successful')
                        return
                    }
                } else {
                    // Directory doesn't exist, first-time clone
                    await fs.mkdir(targetDir, { recursive: true })
                    await this.cloneRepository(repoUrl, targetDir, gitBranch)
                    // Clear cache to ensure data consistency
                    clearFileCache(targetDir)
                    logger.info('Git first clone successful')
                    return
                }
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error))
                logger.warn(
                    { attempt, maxRetries: this.maxRetries, error: lastError },
                    'Git sync attempt failed'
                )

                if (attempt < this.maxRetries) {
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
            `Git sync failed after ${this.maxRetries} attempts: ${lastError?.message}`
        )
    }

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
