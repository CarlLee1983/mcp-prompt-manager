import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    IS_DEFAULT_GROUPS,
    CACHE_CLEANUP_INTERVAL,
    TRANSPORT_TYPE,
    getRepoConfigs,
    getSystemRepoConfig,
} from './config/env.js'
import { logger } from './utils/logger.js'
import {
    loadPartials,
    loadPrompts,
    reloadPrompts,
    getAllPromptRuntimes,
    getPromptStats,
    getPromptRuntime,
} from './services/loaders.js'
import { startCacheCleanup, stopCacheCleanup } from './utils/fileSystem.js'
import { getHealthStatus } from './services/health.js'
import {
    handleReload,
    handlePromptStats,
    handlePromptList,
    handleRepoSwitch,
} from './services/control.js'
import { TransportFactory } from './transports/factory.js'
import type { TransportAdapter } from './transports/adapter.js'
import { RepoManager } from './repositories/repoManager.js'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

/**
 * Get package version from package.json
 * @returns Package version string
 */
function getPackageVersion(): string {
    try {
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = dirname(__filename)
        const packageJsonPath = join(__dirname, '..', 'package.json')
        const packageJson = JSON.parse(
            readFileSync(packageJsonPath, 'utf-8')
        ) as { version: string }
        return packageJson.version
    } catch (error) {
        logger.warn(
            { error },
            'Failed to read version from package.json, using default'
        )
        return '1.0.0'
    }
}

/**
 * Main entry point
 * Initializes and starts the MCP Server with new architecture
 */
async function main() {
    // Record startup time for calculating uptime
    const startTime = Date.now()

    try {
        logger.info('Starting MCP Prompt Manager')

        // 1. Create Transport Adapter
        const packageVersion = getPackageVersion()
        const transport = TransportFactory.createAdapter(TRANSPORT_TYPE, {
            serverName: 'mcp-prompt-manager',
            version: packageVersion,
        })
        logger.info({ type: transport.getType() }, 'Transport adapter created')

        // 2. Create Repo Manager
        const repoConfigs = getRepoConfigs()
        const systemRepoConfig = getSystemRepoConfig()
        const repoManager = new RepoManager(repoConfigs, systemRepoConfig)
        logger.info(
            {
                repoCount: repoConfigs.length,
                hasSystemRepo: systemRepoConfig !== null,
            },
            'Repo manager created'
        )

        // 3. Load Repository
        await repoManager.loadRepository(STORAGE_DIR)
        logger.info('Main repository loaded')

        // 4. Load System Repository (if available)
        let systemStorageDir: string | undefined
        if (systemRepoConfig) {
            await repoManager.loadSystemRepository(STORAGE_DIR)
            systemStorageDir = repoManager.getSystemStorageDir(STORAGE_DIR)
            logger.info('System repository loaded')
        }

        // 5. Load Handlebars Partials
        const partialsCount = await loadPartials(STORAGE_DIR)
        logger.info({ count: partialsCount }, 'Partials loaded')

        // 6. Load and register Prompts
        // Notify user before loading (if using default values)
        if (IS_DEFAULT_GROUPS) {
            logger.info(
                {
                    activeGroups: ACTIVE_GROUPS,
                    hint: 'Set MCP_GROUPS environment variable to load additional groups',
                },
                'No groups specified (common is now optional, use SYSTEM_REPO_URL to provide common group)'
            )
        }

        // Get MCP Server instance (for registering tools)
        const server = transport.getServer()
        if (!server) {
            throw new Error(
                `Transport type "${transport.getType()}" does not support MCP Server. Only stdio transport is currently supported for full MCP functionality.`
            )
        }

        const { loaded, errors } = await loadPrompts(
            server,
            STORAGE_DIR,
            systemStorageDir
        )

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

        // 7. Register tools using transport adapter
        await registerTools(transport, server, startTime)

        // 8. Register resources using transport adapter
        await registerResources(transport, server, startTime)

        // 9. Connect transport
        await transport.connect()
        logger.info('Transport connected')

        // 10. Initialize cache cleanup mechanism
        const cleanupInterval = CACHE_CLEANUP_INTERVAL ?? 10000
        startCacheCleanup(cleanupInterval, (cleaned) => {
            if (cleaned > 0) {
                logger.debug({ cleaned }, 'Cache cleanup completed')
            }
        })
        logger.debug(
            { interval: cleanupInterval },
            'Cache cleanup mechanism started'
        )

        // 11. Register graceful shutdown handlers
        const shutdown = () => {
            logger.info('Shutting down gracefully...')
            stopCacheCleanup()
            transport.disconnect().catch((error) => {
                logger.error({ error }, 'Error disconnecting transport')
            })
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

/**
 * Register all tools
 */
async function registerTools(
    transport: TransportAdapter,
    server: any, // MCP Server instance
    startTime: number
): Promise<void> {
    // Register mcp.reload() tool
    transport.registerTool({
        name: 'mcp.reload',
        title: 'Reload Prompts',
        description:
            'Reload all prompts from Git repository without restarting the server. This will: 1) Pull latest changes from Git, 2) Clear cache, 3) Reload all Handlebars partials, 4) Reload all prompts and tools (zero-downtime).',
        inputSchema: z.object({}),
        handler: async () => {
            try {
                logger.info('mcp.reload tool invoked')
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
        },
    })
    logger.info('mcp.reload tool registered')

    // Register mcp.stats() tool
    transport.registerTool({
        name: 'mcp.stats',
        title: 'Get Prompt Statistics',
        description:
            'Get statistics about all prompts including counts by runtime state (active, legacy, invalid, disabled, warning).',
        inputSchema: z.object({}),
        handler: async () => {
            try {
                logger.info('mcp.stats tool invoked')
                const stats = getPromptStats()

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(stats, null, 2),
                        },
                    ],
                    structuredContent: stats,
                }
            } catch (error) {
                const statsError =
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                logger.error({ error: statsError }, 'Failed to get stats')

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: statsError.message,
                            }),
                        },
                    ],
                    structuredContent: {
                        success: false,
                        error: statsError.message,
                    },
                    isError: true,
                }
            }
        },
    })
    logger.info('mcp.stats tool registered')

    // Register mcp.list() tool
    transport.registerTool({
        name: 'mcp.list',
        title: 'List Prompts',
        description:
            'List all prompts with optional filtering by status, group, or tag. Returns prompt metadata including runtime state, version, tags, and use cases.',
        inputSchema: z.object({
            status: z
                .enum(['draft', 'stable', 'deprecated', 'legacy'])
                .optional()
                .describe('Filter by prompt status'),
            group: z
                .string()
                .optional()
                .describe('Filter by group name'),
            tag: z
                .string()
                .optional()
                .describe('Filter by tag (prompts must have this tag)'),
            runtime_state: z
                .enum(['active', 'legacy', 'invalid', 'disabled', 'warning'])
                .optional()
                .describe('Filter by runtime state'),
        }),
        handler: async (args: Record<string, unknown>) => {
            try {
                    logger.info({ args }, 'mcp.list tool invoked')
                    let runtimes = getAllPromptRuntimes()

                    // Filter by status
                    if (args.status) {
                        runtimes = runtimes.filter(
                            (r) => r.status === args.status
                        )
                    }

                    // Filter by group
                    if (args.group) {
                        runtimes = runtimes.filter(
                            (r) => r.group === args.group
                        )
                    }

                    // Filter by tag
                    if (args.tag) {
                        runtimes = runtimes.filter((r) =>
                            r.tags.includes(args.tag as string)
                        )
                    }

                    // Filter by runtime_state
                    if (args.runtime_state) {
                        runtimes = runtimes.filter(
                            (r) => r.runtime_state === args.runtime_state
                        )
                    }

                    // Convert to output format
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
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                {
                                    total: prompts.length,
                                    prompts,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    structuredContent: {
                        total: prompts.length,
                        prompts,
                    },
                }
            } catch (error) {
                const listError =
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                logger.error({ error: listError }, 'Failed to list prompts')

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: listError.message,
                            }),
                        },
                    ],
                    structuredContent: {
                        success: false,
                        error: listError.message,
                    },
                    isError: true,
                }
            }
        },
    })
    logger.info('mcp.list tool registered')

    // Register mcp.inspect() tool
    transport.registerTool({
        name: 'mcp.inspect',
        title: 'Inspect Prompt',
        description:
            'Get detailed runtime information for a specific prompt by ID. Returns complete runtime metadata including state, source, version, status, tags, and use cases.',
        inputSchema: z.object({
            id: z.string().describe('Prompt ID to inspect'),
        }),
        handler: async (args: Record<string, unknown>) => {
            try {
                const id = args.id as string
                logger.info({ id }, 'mcp.inspect tool invoked')
                const runtime = getPromptRuntime(id)

                if (!runtime) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: `Prompt with ID "${id}" not found`,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: false,
                            error: `Prompt with ID "${id}" not found`,
                        },
                        isError: true,
                    }
                }

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(runtime, null, 2),
                        },
                    ],
                    structuredContent: runtime as unknown as Record<
                        string,
                        unknown
                    >,
                }
            } catch (error) {
                const inspectError =
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                logger.error({ error: inspectError }, 'Failed to inspect prompt')

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: inspectError.message,
                            }),
                        },
                    ],
                    structuredContent: {
                        success: false,
                        error: inspectError.message,
                    },
                    isError: true,
                }
            }
        },
    })
    logger.info('mcp.inspect tool registered')

    // Register MCP Control Tools
    transport.registerTool({
        name: 'mcp.reload_prompts',
        title: 'Reload Prompts',
        description:
            'Reload all prompts from Git repository without restarting the server (hot-reload).',
        inputSchema: z.object({}),
        handler: async () => {
            return await handleReload(server)
        },
    })
    logger.info('mcp.reload_prompts tool registered')

    transport.registerTool({
        name: 'mcp.prompt.stats',
        title: 'Get Prompt Statistics',
        description:
            'Get statistics about all prompts including counts by runtime state.',
        inputSchema: z.object({}),
        handler: async () => {
            return await handlePromptStats()
        },
    })
    logger.info('mcp.prompt.stats tool registered')

    transport.registerTool({
        name: 'mcp.prompt.list',
        title: 'List All Prompts',
        description:
            'List all prompt runtimes with complete metadata information.',
        inputSchema: z.object({}),
        handler: async () => {
            return await handlePromptList()
        },
    })
    logger.info('mcp.prompt.list tool registered')

    transport.registerTool({
        name: 'mcp.repo.switch',
        title: 'Switch Prompt Repository',
        description:
            'Switch to a different prompt repository and reload prompts (zero-downtime).',
        inputSchema: z.object({
            repo_url: z.string().describe('Repository URL'),
            branch: z.string().optional().describe('Branch name'),
        }),
        handler: async (args: Record<string, unknown>) => {
            return await handleRepoSwitch(server, {
                repo_url: args.repo_url as string,
                branch: args.branch as string | undefined,
            })
        },
    })
    logger.info('mcp.repo.switch tool registered')
}

/**
 * Register all resources
 */
async function registerResources(
    transport: TransportAdapter,
    server: any, // MCP Server instance
    startTime: number
): Promise<void> {
    // Register system.health Resource
    transport.registerResource({
        uri: 'system://health',
        name: 'system-health',
        description:
            'System health status including Git info, prompts, cache, and system metrics',
        mimeType: 'application/json',
        handler: async () => {
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
                logger.error(
                    { error: healthError },
                    'Failed to get health status'
                )
                throw healthError
            }
        },
    })
    logger.info('System health resource registered')

    // Register prompts list resource
    transport.registerResource({
        uri: 'prompts://list',
        name: 'prompts-list',
        description:
            'Complete list of all prompts with metadata including runtime state, version, status, tags, and use cases',
        mimeType: 'application/json',
        handler: async () => {
            try {
                const runtimes = getAllPromptRuntimes()
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
        },
    })
    logger.info('Prompts list resource registered')
}

// Start the application
main()
