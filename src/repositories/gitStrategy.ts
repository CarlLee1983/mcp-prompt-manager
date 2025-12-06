import { simpleGit, type SimpleGitOptions } from "simple-git"
import fs from "fs/promises"
import path from "path"
import type { RepositoryStrategy } from "./strategy.js"
import { RepositorySyncError } from "../types/errors.js"
import { logger } from "../utils/logger.js"
import { ensureDirectoryAccess, clearFileCache } from "../utils/fileSystem.js"
import { GIT_MAX_RETRIES, GIT_POLLING_INTERVAL } from "../config/env.js"

/**
 * Git Repository Strategy
 * Handles synchronization operations for Git remote repositories
 */
export class GitRepositoryStrategy implements RepositoryStrategy {
    private readonly repoUrl: string
    private readonly defaultBranch: string
    private readonly maxRetries: number
    private pollingTimer: NodeJS.Timeout | null = null
    private pollingCallback: (() => Promise<void>) | null = null
    private storageDir: string | null = null
    private currentBranch: string | null = null
    private lastCommitHash: string | null = null

    constructor(
        repoUrl: string,
        defaultBranch: string = "main",
        maxRetries: number = GIT_MAX_RETRIES
    ) {
        this.repoUrl = repoUrl
        this.defaultBranch = defaultBranch
        this.maxRetries = maxRetries
    }

    getType(): string {
        return "git"
    }

    getUrl(): string {
        return this.repoUrl
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async validate(): Promise<boolean> {
        try {
            // Simple validation: check if URL format is correct
            const isValidUrl =
                this.repoUrl.startsWith("http://") ||
                this.repoUrl.startsWith("https://") ||
                this.repoUrl.startsWith("git@")
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
            "Git syncing from repository"
        )

        const exists = await fs.stat(storageDir).catch(() => null)
        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: storageDir,
            binary: "git",
            maxConcurrentProcesses: 6,
            timeout: {
                block: 30000, // 30s timeout for git operations
            },
        }

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                if (exists) {
                    const isRepo = await fs
                        .stat(path.join(storageDir, ".git"))
                        .catch(() => null)
                    if (isRepo) {
                        // Ensure directory is accessible
                        await ensureDirectoryAccess(storageDir)

                        const git = simpleGit(gitOptions)

                        // Fetch remote updates first
                        await git.fetch()

                        // Check current branch
                        const currentBranch = await git.revparse([
                            "--abbrev-ref",
                            "HEAD",
                        ])
                        const branchName = currentBranch.trim() || gitBranch

                        // Try pull with rebase (preferred strategy)
                        try {
                            await git.pull(["--rebase"])
                            logger.info(
                                { branch: branchName },
                                "Git pull with rebase successful"
                            )
                        } catch (rebaseError) {
                            // If rebase fails (possibly due to divergence), use reset to force sync to remote
                            logger.warn(
                                { branch: branchName, error: rebaseError },
                                "Git pull with rebase failed, resetting to remote branch"
                            )
                            const remoteBranch = `origin/${branchName}`
                            await git.reset(["--hard", remoteBranch])
                            logger.info(
                                { branch: branchName },
                                "Git reset to remote branch successful"
                            )
                        }

                        // Clear cache to ensure data consistency
                        clearFileCache(storageDir)
                        logger.info("Git sync successful")
                        return
                    } else {
                        // Directory exists but is not a git repo, re-clone
                        logger.warn(
                            "Directory exists but is not a git repository, re-cloning"
                        )
                        await fs.rm(storageDir, {
                            recursive: true,
                            force: true,
                        })
                        await fs.mkdir(storageDir, { recursive: true })
                        await this.cloneRepository(
                            this.repoUrl,
                            storageDir,
                            gitBranch
                        )
                        // Clear cache to ensure data consistency
                        clearFileCache(storageDir)
                        logger.info("Git re-cloned successful")
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
                    logger.info("Git first clone successful")
                    return
                }
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error))
                logger.warn(
                    { attempt, maxRetries: retries, error: lastError },
                    "Git sync attempt failed"
                )

                if (attempt < retries) {
                    const delay = 1000 * attempt // Exponential backoff
                    logger.info(
                        { delay, nextAttempt: attempt + 1 },
                        "Retrying git sync"
                    )
                    await new Promise((resolve) => setTimeout(resolve, delay))
                    // continue - redundant as it's the last statement in the loop
                }
            }
        }

        // All retries failed
        const syncError = new RepositorySyncError(
            this.repoUrl,
            retries,
            lastError || undefined
        )
        logger.error({ error: syncError }, "Git sync failed after all retries")
        throw syncError
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
        const git = simpleGit({
            timeout: {
                block: 60000, // 60s timeout for clone (can be large)
            },
        })
        const cloneOptions = branch ? ["-b", branch] : []
        await git.clone(repoUrl, targetDir, cloneOptions)
    }

    /**
     * Start polling for Git repository updates
     * @param onUpdate - Callback function to call when updates are detected
     * @param storageDir - Storage directory path (where Git repo is cloned)
     * @param branch - Branch name to monitor
     * @param pollingInterval - Polling interval in milliseconds (optional, defaults to GIT_POLLING_INTERVAL)
     */
    startPolling(
        onUpdate: () => Promise<void>,
        storageDir: string,
        branch?: string,
        pollingInterval?: number
    ): void {
        if (this.pollingTimer) {
            logger.debug("Polling already started, stopping existing polling")
            this.stopPolling()
        }

        this.pollingCallback = onUpdate
        this.storageDir = storageDir
        this.currentBranch = branch || this.defaultBranch
        const interval = pollingInterval || GIT_POLLING_INTERVAL

        logger.info(
            { repoUrl: this.repoUrl, branch: this.currentBranch, interval },
            "Starting Git polling"
        )

        // Get initial commit hash
        this.getCurrentCommitHash(storageDir)
            .then((hash) => {
                this.lastCommitHash = hash
                logger.info(
                    { commitHash: hash },
                    "Initial commit hash recorded"
                )
            })
            .catch((error) => {
                logger.warn({ error }, "Failed to get initial commit hash")
            })

        // Start polling
        this.pollingTimer = setInterval(() => {
            void (async () => {
                await this.checkForUpdates()
            })()
        }, interval)

        logger.info({ interval }, "Git polling started successfully")
    }

    /**
     * Stop polling for Git repository updates
     */
    stopPolling(): void {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer)
            this.pollingTimer = null
            this.pollingCallback = null
            this.storageDir = null
            this.currentBranch = null
            this.lastCommitHash = null
            logger.info("Git polling stopped")
        }
    }

    /**
     * Check if polling is active
     * @returns Whether polling is currently active
     */
    isPolling(): boolean {
        return this.pollingTimer !== null
    }

    /**
     * Check for Git repository updates
     * Compares local and remote commit hashes
     */
    private async checkForUpdates(): Promise<void> {
        if (!this.storageDir || !this.currentBranch) {
            logger.warn(
                "Cannot check for updates: storageDir or branch not set"
            )
            return
        }

        try {
            const gitOptions: Partial<SimpleGitOptions> = {
                baseDir: this.storageDir,
                binary: "git",
                maxConcurrentProcesses: 6,
            }

            const git = simpleGit(gitOptions)

            // Fetch remote updates (without merging)
            await git.fetch()

            // Get remote commit hash
            const remoteBranch = `origin/${this.currentBranch}`
            const remoteCommitHash = await git
                .revparse([remoteBranch])
                .catch(() => null)

            if (!remoteCommitHash) {
                logger.warn(
                    { branch: this.currentBranch },
                    "Failed to get remote commit hash"
                )
                return
            }

            // Get local commit hash
            const localCommitHash = await this.getCurrentCommitHash(
                this.storageDir
            )

            // Compare hashes
            if (
                this.lastCommitHash &&
                localCommitHash &&
                remoteCommitHash.trim() !== this.lastCommitHash.trim()
            ) {
                logger.info(
                    {
                        oldHash: this.lastCommitHash,
                        newHash: remoteCommitHash.trim(),
                        branch: this.currentBranch,
                    },
                    "Git repository update detected"
                )

                // Update local repository
                try {
                    await this.sync(this.storageDir, this.currentBranch)
                    this.lastCommitHash = remoteCommitHash.trim()

                    // Trigger callback to reload prompts
                    if (this.pollingCallback) {
                        logger.info(
                            "Triggering prompt reload due to Git update"
                        )
                        await this.pollingCallback()
                    }
                } catch (error) {
                    const syncError =
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    logger.error(
                        { error: syncError },
                        "Failed to sync Git repository during polling"
                    )
                }
            } else if (!this.lastCommitHash) {
                // First time, just record the hash
                this.lastCommitHash = remoteCommitHash.trim()
                logger.debug(
                    { commitHash: this.lastCommitHash },
                    "Initial commit hash set"
                )
            }
        } catch (error) {
            const checkError =
                error instanceof Error ? error : new Error(String(error))
            logger.error(
                { error: checkError },
                "Error checking for Git updates"
            )
        }
    }

    /**
     * Get current commit hash from Git repository
     * @param storageDir - Storage directory path
     * @returns Commit hash or null if not available
     */
    private async getCurrentCommitHash(
        storageDir: string
    ): Promise<string | null> {
        try {
            const gitOptions: Partial<SimpleGitOptions> = {
                baseDir: storageDir,
                binary: "git",
                maxConcurrentProcesses: 6,
            }

            const git = simpleGit(gitOptions)
            const commitHash = await git.revparse(["HEAD"])
            return commitHash.trim() || null
        } catch (error) {
            logger.debug({ error }, "Failed to get commit hash")
            return null
        }
    }
}
