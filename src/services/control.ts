import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { logger } from '../utils/logger.js'
import {
    reloadPrompts,
    getPromptStats,
    getAllPromptRuntimes,
} from './loaders.js'
import { syncRepo } from './git.js'
import { setActiveRepo, getActiveRepo, STORAGE_DIR } from '../config/env.js'

/**
 * Handle reload prompts request
 * @param server - MCP Server instance
 * @returns MCP Tool response with reload results
 */
export async function handleReload(
    server: McpServer
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
        logger.info('mcp.reload_prompts tool invoked')
        const result = await reloadPrompts(server, STORAGE_DIR)

        const message = `Reload completed. Loaded: ${result.loaded}, Errors: ${result.errors.length}`

        return {
            content: [
                {
                    type: 'text',
                    text: message,
                },
            ],
        }
    } catch (error) {
        const reloadError =
            error instanceof Error ? error : new Error(String(error))
        logger.error({ error: reloadError }, 'Reload prompts failed')

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${reloadError.message}`,
                },
            ],
        }
    }
}

/**
 * Handle prompt statistics request
 * @returns MCP Tool response with prompt statistics
 */
export async function handlePromptStats(): Promise<{
    content: Array<{ type: 'text'; text: string }>
}> {
    try {
        logger.info('mcp.prompt.stats tool invoked')
        const stats = getPromptStats()

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(stats, null, 2),
                },
            ],
        }
    } catch (error) {
        const statsError =
            error instanceof Error ? error : new Error(String(error))
        logger.error({ error: statsError }, 'Failed to get prompt stats')

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${statsError.message}`,
                },
            ],
        }
    }
}

/**
 * Handle prompt list request
 * @returns MCP Tool response with all prompt runtimes
 */
export async function handlePromptList(): Promise<{
    content: Array<{ type: 'text'; text: string }>
}> {
    try {
        logger.info('mcp.prompt.list tool invoked')
        const runtimes = getAllPromptRuntimes()

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(runtimes, null, 2),
                },
            ],
        }
    } catch (error) {
        const listError =
            error instanceof Error ? error : new Error(String(error))
        logger.error({ error: listError }, 'Failed to list prompts')

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${listError.message}`,
                },
            ],
        }
    }
}

/**
 * Handle repository switch request
 * @param server - MCP Server instance
 * @param args - Repository switch arguments
 * @param args.repo_url - Repository URL
 * @param args.branch - Branch name (optional)
 * @returns MCP Tool response with switch results
 */
export async function handleRepoSwitch(
    server: McpServer,
    args: { repo_url: string; branch?: string | undefined }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
        logger.info(
            { repo_url: args.repo_url, branch: args.branch },
            'mcp.repo.switch tool invoked'
        )

        // 驗證 repo_url 為 string
        if (typeof args.repo_url !== 'string' || args.repo_url.length === 0) {
            throw new Error('repo_url must be a non-empty string')
        }

        // 設定動態 repo
        setActiveRepo(args.repo_url, args.branch)

        // 同步 repo
        await syncRepo()

        // 重新載入 prompts
        const result = await reloadPrompts(server, STORAGE_DIR)

        const message = `Repo switched and reloaded successfully. Loaded: ${result.loaded}`

        return {
            content: [
                {
                    type: 'text',
                    text: message,
                },
            ],
        }
    } catch (error) {
        const switchError =
            error instanceof Error ? error : new Error(String(error))
        logger.error({ error: switchError }, 'Failed to switch repository')

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${switchError.message}`,
                },
            ],
        }
    }
}

