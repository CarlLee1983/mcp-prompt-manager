import { simpleGit, type SimpleGitOptions } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import {
    getRepoUrl,
    getGitBranch,
    STORAGE_DIR,
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
/**
 * Directory and file names to exclude (case-insensitive)
 */
const EXCLUDED_ITEMS = new Set([
    '.git',
    'node_modules',
    '.DS_Store',
    '.vscode',
    '.idea',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.cache',
    'coverage',
    '.nyc_output',
])

/**
 * Copy files from local directory to target directory (excluding unnecessary directories and files)
 * @param sourceDir - Source directory
 * @param targetDir - Target directory
 */
async function copyLocalRepository(
    sourceDir: string,
    targetDir: string
): Promise<void> {
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true })

    // Read all items from source directory
    const entries = await fs.readdir(sourceDir, { withFileTypes: true })

    for (const entry of entries) {
        // Skip excluded items
        if (EXCLUDED_ITEMS.has(entry.name.toLowerCase())) {
            continue
        }

        const sourcePath = path.join(sourceDir, entry.name)
        const targetPath = path.join(targetDir, entry.name)

        try {
            if (entry.isDirectory()) {
                // Recursively copy subdirectories
                await copyLocalRepository(sourcePath, targetPath)
            } else if (entry.isFile()) {
                // Only copy regular files (skip symlinks and other special files)
                await fs.copyFile(sourcePath, targetPath)
            }
            // Skip symlinks, FIFOs, and other special file types
        } catch (error) {
            // If copy fails, log warning but continue processing other files
            logger.warn(
                { sourcePath, targetPath, error },
                'Failed to copy file, skipping'
            )
        }
    }
}

export async function syncRepo(
    maxRetries: number = GIT_MAX_RETRIES
): Promise<void> {
    const repoUrl = getRepoUrl()
    const gitBranch = getGitBranch()
    
    if (!repoUrl) {
        throw new Error('❌ Error: PROMPT_REPO_URL is missing.')
    }

    logger.info({ repoUrl, branch: gitBranch }, 'Git syncing from repository')

    // Check if it's a local path
    const isLocalPath =
        path.isAbsolute(repoUrl) &&
        !repoUrl.startsWith('http://') &&
        !repoUrl.startsWith('https://') &&
        !repoUrl.startsWith('git@')

    if (isLocalPath) {
        // Local path: directly copy files from source directory (supports uncommitted changes)
        try {
            const sourceStat = await fs.stat(repoUrl).catch(() => null)
            if (!sourceStat) {
                throw new Error(`Source directory does not exist: ${repoUrl}`)
            }

            logger.info(
                { source: repoUrl, target: STORAGE_DIR },
                'Copying from local repository (includes uncommitted changes)'
            )

            // Ensure target directory exists
            await fs.mkdir(STORAGE_DIR, { recursive: true })

            // Copy all files (excluding .git)
            await copyLocalRepository(repoUrl, STORAGE_DIR)

            // Clear cache to ensure data consistency
            clearFileCache(STORAGE_DIR)
            logger.info('Local repository sync successful')
            return
        } catch (error) {
            const syncError =
                error instanceof Error ? error : new Error(String(error))
            logger.error({ error: syncError }, 'Failed to sync local repository')
            throw new Error(
                `Local repository sync failed: ${syncError.message}`
            )
        }
    }

    // Remote repository: use Git operations
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
                    await cloneRepository(repoUrl, STORAGE_DIR, gitBranch)
                    // Clear cache to ensure data consistency
                    clearFileCache(STORAGE_DIR)
                    logger.info('Git re-cloned successful')
                    return
                }
            } else {
                // Directory doesn't exist, first-time clone
                await fs.mkdir(STORAGE_DIR, { recursive: true })
                await cloneRepository(repoUrl, STORAGE_DIR, gitBranch)
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
