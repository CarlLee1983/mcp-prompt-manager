import { execSync } from 'child_process'
import { simpleGit, type SimpleGitOptions } from 'simple-git'
import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    CACHE_CLEANUP_INTERVAL,
    getRepoUrl,
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
        // 優先使用 simple-git
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
            // Fallback 到 exec
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
 * 檢查 registry.yaml 是否存在
 * @param storageDir - Storage directory
 * @returns 是否存在
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
 * 取得系統健康狀態
 * @param startTime - 應用程式啟動時間（毫秒）
 * @param storageDir - Storage directory（可選，預設為 STORAGE_DIR）
 * @returns 健康狀態物件
 */
export async function getHealthStatus(
    startTime: number,
    storageDir?: string
): Promise<HealthStatus> {
    const dir = storageDir ?? STORAGE_DIR

    // 取得 Git 資訊
    const headCommit = await getGitHeadCommit(dir)

    // 取得 Prompt 統計
    const loadedCount = getLoadedPromptCount()
    const promptStats = getPromptStats()

    // 檢查 registry 是否存在
    const registryExists = await checkRegistryExists(dir)

    // 取得 Cache 統計
    const cacheStats = getCacheStats()

    // 取得系統資訊
    const uptime = Date.now() - startTime
    const memoryUsage = process.memoryUsage()

    return {
        git: {
            repoUrl: getRepoUrl() || '',
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

