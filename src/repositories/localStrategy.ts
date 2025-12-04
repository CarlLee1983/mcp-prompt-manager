import fs from 'fs/promises'
import path from 'path'
import type { RepositoryStrategy } from './strategy.js'
import { logger } from '../utils/logger.js'
import { clearFileCache } from '../utils/fileSystem.js'

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
 * Local Repository Strategy
 * Handles synchronization operations for local path repositories
 */
export class LocalRepositoryStrategy implements RepositoryStrategy {
    private readonly repoPath: string

    constructor(repoPath: string) {
        this.repoPath = repoPath
    }

    getType(): string {
        return 'local'
    }

    getUrl(): string {
        return this.repoPath
    }

    async validate(): Promise<boolean> {
        try {
            const stat = await fs.stat(this.repoPath).catch(() => null)
            return stat !== null && stat.isDirectory()
        } catch {
            return false
        }
    }

    async sync(
        storageDir: string,
        _branch?: string,
        _maxRetries?: number
    ): Promise<void> {
        logger.info(
            { source: this.repoPath, target: storageDir },
            'Copying from local repository (includes uncommitted changes)'
        )

        const sourceStat = await fs.stat(this.repoPath).catch(() => null)
        if (!sourceStat) {
            throw new Error(`Source directory does not exist: ${this.repoPath}`)
        }

        // Ensure target directory exists
        await fs.mkdir(storageDir, { recursive: true })

        // Copy all files (excluding .git)
        await this.copyLocalRepository(this.repoPath, storageDir)

        // Clear cache to ensure data consistency
        clearFileCache(storageDir)
        logger.info('Local repository sync successful')
    }

    /**
     * Copy files from local directory to target directory (excluding unnecessary directories and files)
     * @param sourceDir - Source directory
     * @param targetDir - Target directory
     */
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
}

