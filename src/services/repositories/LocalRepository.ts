import fs from 'fs/promises'
import path from 'path'
import type { Repository, RepositoryConfig } from '../../types/repository.js'
import { logger } from '../../utils/logger.js'
import { clearFileCache } from '../../utils/fileSystem.js'

/**
 * Directories and files to exclude from the copy (case-insensitive)
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

export class LocalRepository implements Repository {
    private config: RepositoryConfig

    constructor(config: RepositoryConfig) {
        this.config = config
    }

    async sync(): Promise<void> {
        const { url: sourceDir, targetDir } = this.config

        try {
            const sourceStat = await fs.stat(sourceDir).catch(() => null)
            if (!sourceStat) {
                throw new Error(`Source directory does not exist: ${sourceDir}`)
            }

            logger.info(
                { source: sourceDir, target: targetDir },
                'Copying from local repository (includes uncommitted changes)'
            )

            // Ensure target directory exists
            await fs.mkdir(targetDir, { recursive: true })

            // Copy all files (excluding ignored ones)
            await this.copyLocalRepository(sourceDir, targetDir)

            // Clear cache to ensure data consistency
            clearFileCache(targetDir)
            logger.info('Local repository sync successful')
        } catch (error) {
            const syncError =
                error instanceof Error ? error : new Error(String(error))
            logger.error({ error: syncError }, 'Failed to sync local repository')
            throw new Error(
                `Local repository sync failed: ${syncError.message}`
            )
        }
    }

    private async copyLocalRepository(
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
                    await this.copyLocalRepository(sourcePath, targetPath)
                } else if (entry.isFile()) {
                    // Only copy regular files
                    await fs.copyFile(sourcePath, targetPath)
                }
            } catch (error) {
                // If copy fails, log warning but continue processing other files
                logger.warn(
                    { sourcePath, targetPath, error },
                    'Failed to copy file, skipping'
                )
            }
        }
    }
}
