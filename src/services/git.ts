import { simpleGit, type SimpleGitOptions } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import {
    REPO_URL,
    STORAGE_DIR,
    GIT_BRANCH,
    GIT_MAX_RETRIES,
} from '../config/env.js'
import { logger } from '../utils/logger.js'
import { ensureDirectoryAccess, clearFileCache } from '../utils/fileSystem.js'

/**
 * Sync Git repository
 * Automatically clears file list cache to ensure data consistency
 * @param maxRetries - Maximum number of retries (defaults to value from environment variable)
 * @throws {Error} When Git operation fails
 */
export async function syncRepo(
    maxRetries: number = GIT_MAX_RETRIES
): Promise<void> {
    if (!REPO_URL) {
        throw new Error('❌ Error: PROMPT_REPO_URL is missing.')
    }

    logger.info({ repoUrl: REPO_URL }, 'Git syncing from repository')

    const exists = await fs.stat(STORAGE_DIR).catch(() => null)
    const gitOptions: Partial<SimpleGitOptions> = {
        baseDir: STORAGE_DIR,
        binary: 'git',
        maxConcurrentProcesses: 6,
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (exists) {
                const isRepo = await fs
                    .stat(path.join(STORAGE_DIR, '.git'))
                    .catch(() => null)
                if (isRepo) {
                    // Ensure directory is accessible
                    await ensureDirectoryAccess(STORAGE_DIR)

                    const git = simpleGit(gitOptions)
                    
                    // Fetch remote updates first
                    await git.fetch()
                    
                    // Check current branch
                    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD'])
                    const branchName = currentBranch.trim() || GIT_BRANCH
                    
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
                        const remoteBranch = `origin/${branchName}`
                        await git.reset(['--hard', remoteBranch])
                        logger.info({ branch: branchName }, 'Git reset to remote branch successful')
                    }
                    
                    // Clear cache to ensure data consistency
                    clearFileCache(STORAGE_DIR)
                    logger.info('Git sync successful')
                    return
                } else {
                    // Directory exists but is not a git repo, re-clone
                    logger.warn(
                        'Directory exists but is not a git repository, re-cloning'
                    )
                    await fs.rm(STORAGE_DIR, { recursive: true, force: true })
                    await fs.mkdir(STORAGE_DIR, { recursive: true })
                    await cloneRepository(REPO_URL, STORAGE_DIR, GIT_BRANCH)
                    // Clear cache to ensure data consistency
                    clearFileCache(STORAGE_DIR)
                    logger.info('Git re-cloned successful')
                    return
                }
            } else {
                // Directory doesn't exist, first-time clone
                await fs.mkdir(STORAGE_DIR, { recursive: true })
                await cloneRepository(REPO_URL, STORAGE_DIR, GIT_BRANCH)
                // Clear cache to ensure data consistency
                clearFileCache(STORAGE_DIR)
                logger.info('Git first clone successful')
                return
            }
        } catch (error) {
            lastError =
                error instanceof Error ? error : new Error(String(error))
            logger.warn(
                { attempt, maxRetries, error: lastError },
                'Git sync attempt failed'
            )

            if (attempt < maxRetries) {
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
        `Git sync failed after ${maxRetries} attempts: ${lastError?.message}`
    )
}

/**
 * Clone Git repository to specified directory
 * @param repoUrl - Repository URL (supports HTTP/HTTPS/SSH)
 * @param targetDir - Target directory (must be absolute path)
 * @param branch - Branch name (optional, defaults to repository default branch)
 * @throws {Error} When clone operation fails
 */
async function cloneRepository(
    repoUrl: string,
    targetDir: string,
    branch?: string
): Promise<void> {
    const git = simpleGit()
    const cloneOptions = branch ? ['-b', branch] : []
    await git.clone(repoUrl, targetDir, cloneOptions)
}
