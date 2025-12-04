import type { RepositoryStrategy } from './strategy.js'
import { RepositoryFactory } from './factory.js'
import type { RepoConfig } from '../config/repoConfig.js'
import { logger } from '../utils/logger.js'
import { GIT_MAX_RETRIES } from '../config/env.js'

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
}

