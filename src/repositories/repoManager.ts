import type { RepositoryStrategy } from './strategy.js'
import { RepositoryFactory } from './factory.js'
import type { RepoConfig } from '../config/repoConfig.js'
import { logger } from '../utils/logger.js'
import { GIT_MAX_RETRIES } from '../config/env.js'
import { LocalRepositoryStrategy } from './localStrategy.js'
import { GitRepositoryStrategy } from './gitStrategy.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { reloadSinglePrompt, reloadPrompts } from '../services/loaders.js'
import path from 'path'

/**
 * Repo Manager
 * Manages multiple repositories, loading them in priority order
 */
export class RepoManager {
    private readonly repoConfigs: RepoConfig[]
    private readonly systemRepoConfig: RepoConfig | null
    private activeStrategy: RepositoryStrategy | null = null
    private systemStrategy: RepositoryStrategy | null = null

    constructor(
        repoConfigs: RepoConfig[],
        systemRepoConfig: RepoConfig | null = null
    ) {
        this.repoConfigs = repoConfigs
        this.systemRepoConfig = systemRepoConfig
    }

    /**
     * Get current active repository strategy
     * @returns Repository Strategy or null
     */
    getActiveStrategy(): RepositoryStrategy | null {
        return this.activeStrategy
    }

    /**
     * Get system repository strategy
     * @returns Repository Strategy or null
     */
    getSystemStrategy(): RepositoryStrategy | null {
        return this.systemStrategy
    }

    /**
     * Attempt to load repository in priority order
     * Stops after finding the first available repository
     * @param storageDir - Target storage directory
     * @returns Successfully loaded repository strategy
     * @throws {Error} When all repositories fail to load
     */
    async loadRepository(storageDir: string): Promise<RepositoryStrategy> {
        if (this.repoConfigs.length === 0) {
            throw new Error('No repository configurations provided')
        }

        const errors: Error[] = []

        for (const repoConfig of this.repoConfigs) {
            try {
                logger.info(
                    {
                        url: repoConfig.url,
                        branch: repoConfig.branch,
                        priority: repoConfig.priority,
                    },
                    'Attempting to load repository'
                )

                // Create strategy
                const strategy = RepositoryFactory.createStrategy(
                    repoConfig.url,
                    repoConfig.branch || 'main',
                    GIT_MAX_RETRIES
                )

                // Validate repository
                const isValid = await strategy.validate()
                if (!isValid) {
                    throw new Error(`Repository validation failed: ${repoConfig.url}`)
                }

                // Attempt to sync
                await strategy.sync(storageDir, repoConfig.branch)

                // Successfully loaded
                this.activeStrategy = strategy
                logger.info(
                    { url: repoConfig.url },
                    'Repository loaded successfully'
                )
                return strategy
            } catch (error) {
                const loadError =
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                errors.push(loadError)
                logger.warn(
                    {
                        url: repoConfig.url,
                        error: loadError.message,
                    },
                    'Failed to load repository, trying next'
                )
                // Continue to next
            }
        }

        // All repositories failed
        const errorMessages = errors
            .map((e, i) => `Repo ${i + 1}: ${e.message}`)
            .join('; ')
        throw new Error(
            `Failed to load any repository. Errors: ${errorMessages}`
        )
    }

    /**
     * Load system repository (used to provide common group)
     * @param storageDir - Target storage directory (system repo will use subdirectory)
     * @returns System repository strategy or null
     */
    async loadSystemRepository(
        storageDir: string
    ): Promise<RepositoryStrategy | null> {
        if (!this.systemRepoConfig) {
            logger.debug('No system repository configured')
            return null
        }

        try {
            logger.info(
                {
                    url: this.systemRepoConfig.url,
                    branch: this.systemRepoConfig.branch,
                },
                'Loading system repository'
            )

            // System repo uses independent storage directory
            const systemStorageDir = `${storageDir}_system`

            // Create strategy
            const strategy = RepositoryFactory.createStrategy(
                this.systemRepoConfig.url,
                this.systemRepoConfig.branch || 'main',
                GIT_MAX_RETRIES
            )

            // Validate repository
            const isValid = await strategy.validate()
            if (!isValid) {
                throw new Error(
                    `System repository validation failed: ${this.systemRepoConfig.url}`
                )
            }

            // Sync system repo
            await strategy.sync(systemStorageDir, this.systemRepoConfig.branch)

            // Successfully loaded
            this.systemStrategy = strategy
            logger.info(
                { url: this.systemRepoConfig.url },
                'System repository loaded successfully'
            )
            return strategy
        } catch (error) {
            const loadError =
                error instanceof Error ? error : new Error(String(error))
            logger.error(
                {
                    url: this.systemRepoConfig.url,
                    error: loadError.message,
                },
                'Failed to load system repository'
            )
            // System repo load failure should not block main flow
            return null
        }
    }

    /**
     * Get system repository storage directory
     * @param baseStorageDir - Base storage directory
     * @returns System repository storage directory
     */
    getSystemStorageDir(baseStorageDir: string): string {
        return `${baseStorageDir}_system`
    }

    /**
     * Start watch mode for loaded repositories
     * @param server - MCP Server instance for reloading prompts
     * @param storageDir - Storage directory path
     * @param systemStorageDir - System storage directory path (optional)
     */
    startWatchMode(
        server: McpServer,
        storageDir: string,
        systemStorageDir?: string
    ): void {
        logger.info('Starting watch mode for repositories')

        // Start watching active repository
        if (this.activeStrategy) {
            this.startStrategyWatchMode(
                this.activeStrategy,
                server,
                storageDir,
                systemStorageDir,
                this.repoConfigs.find((c) => c.url === this.activeStrategy?.getUrl())?.branch
            )
        }

        // Start watching system repository
        if (this.systemStrategy && systemStorageDir) {
            this.startStrategyWatchMode(
                this.systemStrategy,
                server,
                systemStorageDir,
                undefined, // No nested system repo
                this.systemRepoConfig?.branch
            )
        }

        logger.info('Watch mode started for all repositories')
    }

    /**
     * Stop watch mode for all repositories
     */
    stopWatchMode(): void {
        logger.info('Stopping watch mode for repositories')

        // Stop watching active repository
        if (this.activeStrategy) {
            this.stopStrategyWatchMode(this.activeStrategy)
        }

        // Stop watching system repository
        if (this.systemStrategy) {
            this.stopStrategyWatchMode(this.systemStrategy)
        }

        logger.info('Watch mode stopped for all repositories')
    }

    /**
     * Start watch mode for a specific strategy
     * @param strategy - Repository strategy
     * @param server - MCP Server instance
     * @param storageDir - Storage directory path
     * @param systemStorageDir - System storage directory path (optional, for main repo only)
     * @param branch - Branch name (for Git repositories)
     */
    private startStrategyWatchMode(
        strategy: RepositoryStrategy,
        server: McpServer,
        storageDir: string,
        systemStorageDir: string | undefined,
        branch?: string
    ): void {
        try {
            if (strategy instanceof LocalRepositoryStrategy) {
                // Determine watch path: if source and target are same, watch source; otherwise watch target
                const repoPath = strategy.getUrl()
                const resolvedSource = path.resolve(repoPath)
                const resolvedTarget = path.resolve(storageDir)
                const watchPath = resolvedSource === resolvedTarget ? repoPath : storageDir

                logger.info(
                    { repoPath, storageDir, watchPath },
                    'Starting file watcher for local repository'
                )

                strategy.startWatching(async (filePath: string) => {
                    try {
                        logger.info({ filePath }, 'File change detected, reloading single prompt')
                        const result = await reloadSinglePrompt(server, filePath, storageDir)
                        if (result.success) {
                            logger.info({ filePath }, 'Single prompt reloaded successfully')
                        } else if (result.error) {
                            logger.info(
                                { 
                                    filePath, 
                                    errorMessage: result.error.message,
                                    errorStack: result.error.stack,
                                    errorName: result.error.name
                                },
                                `Single prompt reload failed: ${result.error.message}. Full reload may have been triggered.`
                            )
                        } else {
                            logger.info(
                                { filePath },
                                'Single prompt reload failed (no error details), full reload may have been triggered'
                            )
                        }
                    } catch (error) {
                        const reloadError = error instanceof Error ? error : new Error(String(error))
                        logger.error(
                            { 
                                filePath, 
                                errorMessage: reloadError.message,
                                errorStack: reloadError.stack,
                                errorName: reloadError.name
                            }, 
                            `Failed to reload single prompt: ${reloadError.message}`
                        )
                    }
                }, watchPath)
            } else if (strategy instanceof GitRepositoryStrategy) {
                logger.info(
                    { repoUrl: strategy.getUrl(), branch, storageDir },
                    'Starting Git polling'
                )

                strategy.startPolling(
                    async () => {
                        try {
                            logger.info('Git update detected, reloading all prompts')
                            await reloadPrompts(server, storageDir, systemStorageDir)
                        } catch (error) {
                            const reloadError = error instanceof Error ? error : new Error(String(error))
                            logger.error({ error: reloadError }, 'Failed to reload prompts after Git update')
                        }
                    },
                    storageDir,
                    branch
                )
            } else {
                logger.warn(
                    { strategyType: strategy.getType() },
                    'Watch mode not supported for this strategy type'
                )
            }
        } catch (error) {
            const watchError = error instanceof Error ? error : new Error(String(error))
            logger.error(
                { strategyType: strategy.getType(), error: watchError },
                'Failed to start watch mode for strategy'
            )
        }
    }

    /**
     * Stop watch mode for a specific strategy
     * @param strategy - Repository strategy
     */
    private stopStrategyWatchMode(strategy: RepositoryStrategy): void {
        try {
            if (strategy instanceof LocalRepositoryStrategy) {
                if (strategy.isWatching()) {
                    strategy.stopWatching()
                    logger.info('File watcher stopped for local repository')
                }
            } else if (strategy instanceof GitRepositoryStrategy) {
                if (strategy.isPolling()) {
                    strategy.stopPolling()
                    logger.info('Git polling stopped')
                }
            }
        } catch (error) {
            const stopError = error instanceof Error ? error : new Error(String(error))
            logger.warn({ strategyType: strategy.getType(), error: stopError }, 'Error stopping watch mode')
        }
    }
}

