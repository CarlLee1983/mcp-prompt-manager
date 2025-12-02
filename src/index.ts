import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    IS_DEFAULT_GROUPS,
    CACHE_CLEANUP_INTERVAL,
} from './config/env.js'
import { logger } from './utils/logger.js'
import { syncRepo } from './services/git.js'
import {
    loadPartials,
    loadPrompts,
    reloadPrompts,
    getAllPromptRuntimes,
} from './services/loaders.js'
import { startCacheCleanup, stopCacheCleanup } from './utils/fileSystem.js'
import { getHealthStatus } from './services/health.js'
import { z } from 'zod'

// Initialize MCP Server
const server = new McpServer({
    name: 'mcp-prompt-manager',
    version: '1.0.0',
})

/**
 * Main entry point
 * Initializes and starts the MCP Server
 */
async function main() {
    // 記錄啟動時間，用於計算 uptime
    const startTime = Date.now()
    
    try {
        logger.info('Starting MCP Prompt Manager')

        // 1. Sync Git repository
        await syncRepo()

        // 2. Load Handlebars Partials
        const partialsCount = await loadPartials(STORAGE_DIR)
        logger.info({ count: partialsCount }, 'Partials loaded')

        // 3. Load and register Prompts
        // Notify user before loading (if using default values)
        if (IS_DEFAULT_GROUPS) {
            logger.info(
                {
                    activeGroups: ACTIVE_GROUPS,
                    hint: 'Set MCP_GROUPS environment variable to load additional groups',
                },
                'Using default prompt groups'
            )
        }

        const { loaded, errors } = await loadPrompts(server, STORAGE_DIR)

        if (errors.length > 0) {
            logger.warn(
                {
                    loaded,
                    failed: errors.length,
                    errors: errors.map((e) => ({
                        file: e.file,
                        message: e.error.message,
                    })),
                },
                'Some prompts failed to load'
            )
        } else {
            logger.info({ loaded }, 'All prompts loaded successfully')
        }

        if (loaded === 0) {
            logger.warn(
                'No prompts were loaded. Check your configuration and repository.'
            )
        }

        // 4. Register reloadPrompts tool
        server.registerTool(
            'reloadPrompts',
            {
                title: 'Reload Prompts',
                description:
                    'Reload all prompts from Git repository without restarting the server. This will: 1) Pull latest changes from Git, 2) Clear cache, 3) Reload all Handlebars partials, 4) Reload all prompts and tools.',
                inputSchema: z.object({}),
            },
            async () => {
                try {
                    logger.info('Reload prompts tool invoked')
                    const result = await reloadPrompts(server, STORAGE_DIR)

                    const message = `Successfully reloaded ${result.loaded} prompts. ${result.errors.length} error(s) occurred.`

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: true,
                                    loaded: result.loaded,
                                    errors: result.errors.length,
                                    message,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: true,
                            loaded: result.loaded,
                            errors: result.errors.length,
                            message,
                            errorDetails:
                                result.errors.length > 0
                                    ? result.errors.map((e) => ({
                                          file: e.file,
                                          message: e.error.message,
                                      }))
                                    : [],
                        },
                    }
                } catch (error) {
                    const reloadError =
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    logger.error({ error: reloadError }, 'Reload prompts failed')

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: reloadError.message,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: false,
                            error: reloadError.message,
                        },
                        isError: true,
                    }
                }
            }
        )
        logger.info('Reload prompts tool registered')

        // 5. Register system.health Resource
        server.registerResource(
            'system-health',
            'system://health',
            {
                title: 'System Health',
                description: 'System health status including Git info, prompts, cache, and system metrics',
                mimeType: 'application/json',
            },
            async () => {
                try {
                    const healthStatus = await getHealthStatus(startTime)
                    return {
                        contents: [
                            {
                                uri: 'system://health',
                                mimeType: 'application/json',
                                text: JSON.stringify(healthStatus, null, 2),
                            },
                        ],
                    }
                } catch (error) {
                    const healthError =
                        error instanceof Error ? error : new Error(String(error))
                    logger.error({ error: healthError }, 'Failed to get health status')
                    throw healthError
                }
            }
        )
        logger.info('System health resource registered')

        // 6. Register prompts list resource (提供完整的 prompt metadata 資訊)
        server.registerResource(
            'prompts-list',
            'prompts://list',
            {
                title: 'Prompts List',
                description:
                    'Complete list of all prompts with metadata including runtime state, version, status, tags, and use cases',
                mimeType: 'application/json',
            },
            async () => {
                try {
                    const runtimes = getAllPromptRuntimes()
                    // 轉換為 listPrompts 格式
                    const prompts = runtimes.map((runtime) => ({
                        id: runtime.id,
                        title: runtime.title,
                        version: runtime.version,
                        status: runtime.status,
                        runtime_state: runtime.runtime_state,
                        source: runtime.source,
                        tags: runtime.tags,
                        use_cases: runtime.use_cases,
                        group: runtime.group,
                        visibility: runtime.visibility,
                    }))
                    return {
                        contents: [
                            {
                                uri: 'prompts://list',
                                mimeType: 'application/json',
                                text: JSON.stringify(prompts, null, 2),
                            },
                        ],
                    }
                } catch (error) {
                    const listError =
                        error instanceof Error ? error : new Error(String(error))
                    logger.error({ error: listError }, 'Failed to get prompts list')
                    throw listError
                }
            }
        )
        logger.info('Prompts list resource registered')

        // 7. Start MCP Server
        const transport = new StdioServerTransport()
        await server.connect(transport)
        logger.info('MCP Server is running!')

        // 8. Initialize cache cleanup mechanism
        const cleanupInterval = CACHE_CLEANUP_INTERVAL ?? 10000 // Default: 10 seconds (CACHE_TTL * 2)
        startCacheCleanup(cleanupInterval, (cleaned) => {
            if (cleaned > 0) {
                logger.debug({ cleaned }, 'Cache cleanup completed')
            }
        })
        logger.debug(
            { interval: cleanupInterval },
            'Cache cleanup mechanism started'
        )

        // Register graceful shutdown handlers
        const shutdown = () => {
            logger.info('Shutting down gracefully...')
            stopCacheCleanup()
            logger.debug('Cache cleanup stopped')
            process.exit(0)
        }

        process.on('SIGINT', shutdown)
        process.on('SIGTERM', shutdown)
    } catch (error) {
        const fatalError =
            error instanceof Error ? error : new Error(String(error))
        logger.fatal({ error: fatalError }, 'Fatal error occurred')
        stopCacheCleanup()
        process.exit(1)
    }
}

// Start the application
main()
