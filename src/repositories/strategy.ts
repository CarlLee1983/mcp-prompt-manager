/**
 * Repository Strategy Interface
 * Defines operations strategy for different types of repositories
 */

export interface RepositoryStrategy {
    /**
     * Sync repository to specified directory
     * @param storageDir - Target storage directory
     * @param branch - Branch name (optional)
     * @param maxRetries - Maximum number of retries (optional)
     * @throws {Error} When sync operation fails
     */
    sync(
        storageDir: string,
        branch?: string,
        maxRetries?: number
    ): Promise<void>

    /**
     * Get repository type
     * @returns Repository type string (e.g., 'git', 'local')
     */
    getType(): string

    /**
     * Validate if repository is available
     * @returns Whether the repository is available
     */
    validate(): Promise<boolean>

    /**
     * Get repository URL
     * @returns Repository URL
     */
    getUrl(): string
}
