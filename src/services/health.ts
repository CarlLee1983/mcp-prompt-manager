import { execSync } from 'child_process'
import { simpleGit, type SimpleGitOptions } from 'simple-git'
import {
    REPO_URL,
    STORAGE_DIR,
    ACTIVE_GROUPS,
    CACHE_CLEANUP_INTERVAL,
} from '../config/env.js'
import { logger } from '../utils/logger.js'
import { getCacheStats } from '../utils/fileSystem.js'
import { getLoadedPromptCount, getPromptStats } from './loaders.js'
import fs from 'fs/promises'
import path from 'path'

/**
 * 健康狀態資料結構
 */
export interface HealthStatus {
    git: {
        repoUrl: string
        repoPath: string
        headCommit: string | null
    }
    prompts: {
        total: number
        active: number
        legacy: number
        invalid: number
        disabled: number
        loadedCount: number
        groups: string[]
    }
    registry: {
        enabled: boolean
        source: 'registry.yaml' | 'none'
    }
    cache: {
        size: number
        cleanupInterval: number | null
    }
    system: {
        uptime: number // milliseconds
        memory: {
            heapUsed: number // bytes
            heapTotal: number // bytes
            rss: number // bytes
        }
    }
}

/**
 * 取得 Git HEAD commit
 * 優先使用 simple-git，失敗時 fallback 到 exec
 * @param storageDir - Git repository 目錄
 * @returns HEAD commit hash 或 null
 */
async function getGitHeadCommit(
    storageDir: string
): Promise<string | null> {
    try {
        // Prefer simple-git
        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: storageDir,
            binary: 'git',
            maxConcurrentProcesses: 6,
        }
        const git = simpleGit(gitOptions)
        const commit = await git.revparse(['HEAD'])
        return commit.trim() || null
    } catch (error) {
        logger.debug({ error }, 'Failed to get HEAD commit using simple-git, trying exec')
        
        try {
            // Fallback to exec
            const commit = execSync('git rev-parse HEAD', {
                cwd: storageDir,
                encoding: 'utf-8',
            })
            return commit.trim() || null
        } catch (execError) {
            logger.warn(
                { error: execError },
                'Failed to get HEAD commit using exec'
            )
            return null
        }
    }
}

/**
 * Check if registry.yaml exists
 * @param storageDir - Storage directory
 * @returns Whether it exists
 */
async function checkRegistryExists(storageDir: string): Promise<boolean> {
    try {
        const registryPath = path.join(storageDir, 'registry.yaml')
        await fs.access(registryPath)
        return true
    } catch {
        return false
    }
}

/**
 * Get system health status
 * @param startTime - Application startup time (milliseconds)
 * @param storageDir - Storage directory (optional, defaults to STORAGE_DIR)
 * @returns Health status object
 */
export async function getHealthStatus(
    startTime: number,
    storageDir?: string
): Promise<HealthStatus> {
    const dir = storageDir ?? STORAGE_DIR

    // Get Git information
    const headCommit = await getGitHeadCommit(dir)

    // Get Prompt statistics
    const loadedCount = getLoadedPromptCount()
    const promptStats = getPromptStats()

    // Check if registry exists
    const registryExists = await checkRegistryExists(dir)

    // Get Cache statistics
    const cacheStats = getCacheStats()

    // Get system information
    const uptime = Date.now() - startTime
    const memoryUsage = process.memoryUsage()

    return {
        git: {
            repoUrl: REPO_URL || '',
            repoPath: dir,
            headCommit,
        },
        prompts: {
            total: promptStats.total,
            active: promptStats.active,
            legacy: promptStats.legacy,
            invalid: promptStats.invalid,
            disabled: promptStats.disabled,
            loadedCount,
            groups: [...ACTIVE_GROUPS],
        },
        registry: {
            enabled: registryExists,
            source: registryExists ? 'registry.yaml' : 'none',
        },
        cache: {
            size: cacheStats.size,
            cleanupInterval: CACHE_CLEANUP_INTERVAL ?? null,
        },
        system: {
            uptime,
            memory: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                rss: memoryUsage.rss,
            },
        },
    }
}

