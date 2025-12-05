import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    IS_DEFAULT_GROUPS,
    CACHE_CLEANUP_INTERVAL,
    TRANSPORT_TYPE,
    WATCH_MODE,
    LANG_INSTRUCTION,
    LANG_SETTING,
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
    getPrompt,
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

        // 2. Get MCP Server instance EARLY (before connecting)
        const server = transport.getServer()
        if (!server) {
            throw new Error(
                `Transport type "${transport.getType()}" does not support MCP Server. Only stdio transport is currently supported for full MCP functionality.`
            )
        }

        // 3. Load repositories and prompts BEFORE connecting
        // MCP SDK requires all tools to be registered before connection for clients to see them
        // For local paths with STORAGE_DIR set to source, this should be fast (no copying)
        // Create Repo Manager
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

        // 4. Load Repository (optimized for local paths - skips copy if source == target)
        await repoManager.loadRepository(STORAGE_DIR)
        logger.info('Main repository loaded')

        // 5. Load System Repository (if available) - can be parallelized in future
        let systemStorageDir: string | undefined
        if (systemRepoConfig) {
            await repoManager.loadSystemRepository(STORAGE_DIR)
            systemStorageDir = repoManager.getSystemStorageDir(STORAGE_DIR)
            logger.info('System repository loaded')
        }

        // 6. Load Handlebars Partials
        const partialsCount = await loadPartials(STORAGE_DIR)
        logger.info({ count: partialsCount }, 'Partials loaded')

        // 7. Load and register Prompts (this will register tools from prompts)
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

        const { loaded, errors, loadedToolIds } = await loadPrompts(
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

        // 8. Register basic tools AFTER prompts (so all tools are registered together)
        // This ensures all tools (basic + prompts) are available when client connects
        await registerTools(transport, server, startTime)
        logger.info('Basic tools registered')

        // 9. Register basic resources
        await registerResources(transport, server, startTime)
        logger.info('Basic resources registered')

        // 10. Log total tool count before connecting
        // This helps diagnose tool registration issues across different clients
        // Use actual registered tool IDs count instead of loaded prompts count
        // (only active/legacy prompts are registered as tools)
        const promptToolsCount = loadedToolIds?.size ?? 0
        const basicToolsCount = 8 // mcp_reload, mcp_stats, mcp_list, mcp_inspect, mcp_reload_prompts, mcp_prompt_stats, mcp_prompt_list, mcp_repo_switch
        const totalToolsCount = basicToolsCount + promptToolsCount
        logger.info(
            {
                basicTools: basicToolsCount,
                promptTools: promptToolsCount,
                loadedPrompts: loaded, // Total prompts loaded (including non-active ones)
                totalTools: totalToolsCount,
            },
            'All tools registered - ready to connect'
        )

        // 11. Connect transport AFTER all tools are registered
        // This ensures all tools (basic + prompts) are available when client connects
        // For local paths with STORAGE_DIR=source, loading should be fast enough
        await transport.connect()
        logger.info(
            {
                basicTools: basicToolsCount,
                promptTools: promptToolsCount,
                totalTools: totalToolsCount,
            },
            'Transport connected - all tools available'
        )

        // 11. Initialize cache cleanup mechanism
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

        // 12. Start watch mode if enabled
        if (WATCH_MODE) {
            logger.info('Watch mode enabled, starting file watchers and Git polling')
            repoManager.startWatchMode(server, STORAGE_DIR, systemStorageDir)
            logger.info('Watch mode started successfully')
        } else {
            logger.debug('Watch mode disabled (set WATCH_MODE=true to enable)')
        }

        // 13. Register graceful shutdown handlers
        const shutdown = () => {
            logger.info('Shutting down gracefully...')
            
            // Stop watch mode
            if (WATCH_MODE) {
                repoManager.stopWatchMode()
            }
            
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
 * Estimate token count for text
 * Simple estimation: ~4 chars per token for English, ~1.5-2 chars per token for Chinese
 */
function estimateTokens(text: string): number {
    // Count Chinese characters (CJK Unified Ideographs)
    const chineseRegex = /[\u4e00-\u9fff]/g
    const chineseChars = (text.match(chineseRegex) || []).length
    const otherChars = text.length - chineseChars

    // Chinese: ~1.5 chars per token, English/others: ~4 chars per token
    const chineseTokens = Math.ceil(chineseChars / 1.5)
    const otherTokens = Math.ceil(otherChars / 4)

    return chineseTokens + otherTokens
}

/**
 * Highlight variables in rendered text by wrapping variable values with Markdown bold
 */
function highlightVariables(
    template: string,
    renderedText: string,
    context: Record<string, unknown>
): string {
    let highlightedText = renderedText

    // Get all variable values from context (excluding system variables)
    const variableEntries = Object.entries(context)
        .filter(([key]) => key !== 'output_lang_rule' && key !== 'sys_lang')
        .map(([key, value]) => [key, String(value ?? '')])
        .filter(([, value]) => value && value.length > 0) as [string, string][]

    // Sort by length (longest first) to avoid partial matches
    variableEntries.sort((a, b) => b[1].length - a[1].length)

    // Replace each variable value with bolded version
    for (const [, value] of variableEntries) {
        // Skip if value is too short (likely to cause false matches)
        if (value.length < 2) continue

        // Escape special regex characters
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        
        // Try to match the value, but be careful with word boundaries
        // For values with spaces or special chars, use a more flexible approach
        let regex: RegExp
        if (/^[a-zA-Z0-9_]+$/.test(value)) {
            // Simple alphanumeric value - use word boundaries
            regex = new RegExp(`\\b${escapedValue}\\b`, 'g')
        } else {
            // Complex value - match as-is (but escape special chars)
            regex = new RegExp(escapedValue.replace(/\s+/g, '\\s+'), 'g')
        }

        // Only replace if not already highlighted
        highlightedText = highlightedText.replace(regex, (match) => {
            // Skip if already wrapped in markdown bold
            if (match.startsWith('**') && match.endsWith('**')) {
                return match
            }
            return `**${value}**`
        })
    }

    return highlightedText
}

/**
 * Check for missing required fields and generate warnings
 */
function checkSchemaWarnings(
    zodShape: z.ZodRawShape,
    providedArgs: Record<string, unknown>
): string[] {
    const warnings: string[] = []
    const providedKeys = new Set(Object.keys(providedArgs))

    for (const [key, schema] of Object.entries(zodShape)) {
        if (!providedKeys.has(key)) {
            // Check if schema is optional or has default
            const schemaDef = (schema as any)._def
            const isOptional = schemaDef?.typeName === 'ZodOptional' || 
                              schemaDef?.typeName === 'ZodDefault' ||
                              schema instanceof z.ZodOptional ||
                              schema instanceof z.ZodDefault

            if (isOptional) {
                // Optional field - check description for hints about importance
                const description = schemaDef?.description || 
                                   (schema as any).description || 
                                   ''
                if (description.toLowerCase().includes('recommended') || 
                    description.toLowerCase().includes('suggested')) {
                    warnings.push(`Missing recommended field: '${key}'`)
                }
            } else {
                // Required field (validation should have caught this, but warn anyway)
                warnings.push(`Missing required field: '${key}'`)
            }
        }
    }

    return warnings
}

/**
 * Register all tools
 */
async function registerTools(
    transport: TransportAdapter,
    server: any, // MCP Server instance
    startTime: number
): Promise<void> {
    // Register mcp_reload() tool
    transport.registerTool({
        name: 'mcp_reload',
        title: 'Reload Prompts',
        description:
            'Reload all prompts from Git repository without restarting the server. This will: 1) Pull latest changes from Git, 2) Clear cache, 3) Reload all Handlebars partials, 4) Reload all prompts and tools (zero-downtime).',
        inputSchema: z.object({}),
        handler: async () => {
            try {
                logger.info('mcp_reload tool invoked')
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
    logger.info('mcp_reload tool registered')

    // Register mcp_stats() tool
    transport.registerTool({
        name: 'mcp_stats',
        title: 'Get Prompt Statistics',
        description:
            'Get statistics about all prompts including counts by runtime state (active, legacy, invalid, disabled, warning) and tool counts (basic tools, prompt tools, total tools).',
        inputSchema: z.object({}),
        handler: async () => {
            try {
                logger.info('mcp_stats tool invoked')
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
    logger.info('mcp_stats tool registered')

    // Register mcp_list() tool
    transport.registerTool({
        name: 'mcp_list',
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
                    logger.info({ args }, 'mcp_list tool invoked')
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
    logger.info('mcp_list tool registered')

    // Register mcp_inspect() tool
    transport.registerTool({
        name: 'mcp_inspect',
        title: 'Inspect Prompt',
        description:
            'Get detailed runtime information for a specific prompt by ID. Returns complete runtime metadata including state, source, version, status, tags, and use cases.',
        inputSchema: z.object({
            id: z.string().describe('Prompt ID to inspect'),
        }),
        handler: async (args: Record<string, unknown>) => {
            try {
                const id = args.id as string
                logger.info({ id }, 'mcp_inspect tool invoked')
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
    logger.info('mcp_inspect tool registered')

    // Register MCP Control Tools
    transport.registerTool({
        name: 'mcp_reload_prompts',
        title: 'Reload Prompts',
        description:
            'Reload all prompts from Git repository without restarting the server (hot-reload).',
        inputSchema: z.object({}),
        handler: async () => {
            return await handleReload(server)
        },
    })
    logger.info('mcp_reload_prompts tool registered')

    transport.registerTool({
        name: 'mcp_prompt_stats',
        title: 'Get Prompt Statistics',
        description:
            'Get statistics about all prompts including counts by runtime state.',
        inputSchema: z.object({}),
        handler: async () => {
            return await handlePromptStats()
        },
    })
    logger.info('mcp_prompt_stats tool registered')

    transport.registerTool({
        name: 'mcp_prompt_list',
        title: 'List All Prompts',
        description:
            'List all prompt runtimes with complete metadata information.',
        inputSchema: z.object({}),
        handler: async () => {
            return await handlePromptList()
        },
    })
    logger.info('mcp_prompt_list tool registered')

    transport.registerTool({
        name: 'mcp_repo_switch',
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
    logger.info('mcp_repo_switch tool registered')

    // Register preview_prompt tool
    transport.registerTool({
        name: 'preview_prompt',
        title: 'Preview Prompt',
        description:
            'Debug utility: Renders a prompt template with given arguments to show the final text without sending it to an LLM. Use this to verify template logic.',
        inputSchema: z.object({
            promptId: z.string().describe('The ID of the prompt to test (e.g., \'laravel:code-review\')'),
            args: z.record(z.string(), z.unknown()).describe('JSON object containing the arguments/variables for the template'),
        }),
        handler: async (args: Record<string, unknown>) => {
            try {
                const promptId = args.promptId as string
                const inputArgs = args.args as Record<string, unknown>

                logger.info({ promptId }, 'preview_prompt tool invoked')

                // 1. Validate if promptId exists
                const cachedPrompt = getPrompt(promptId)
                if (!cachedPrompt) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: `Prompt not found: ${promptId}`,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: false,
                            error: `Prompt not found: ${promptId}`,
                        },
                        isError: true,
                    }
                }

                // 2. Validate args parameters
                const zodSchema = Object.keys(cachedPrompt.zodShape).length > 0
                    ? z.object(cachedPrompt.zodShape)
                    : z.object({})

                const validationResult = zodSchema.safeParse(inputArgs)
                if (!validationResult.success) {
                    const errorDetails = validationResult.error.issues.map((issue) => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    }))

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: 'Validation failed',
                                    details: errorDetails,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: false,
                            error: 'Validation failed',
                            details: errorDetails,
                        },
                        isError: true,
                    }
                }

                // 2.5. Check Schema warnings (missing required or recommended fields)
                const warnings = checkSchemaWarnings(cachedPrompt.zodShape, inputArgs)

                // 3. Render template
                try {
                    const context = {
                        ...validationResult.data,
                        output_lang_rule: LANG_INSTRUCTION,
                        sys_lang: LANG_SETTING,
                    }

                    const renderedText = cachedPrompt.compiledTemplate(context)

                    // 4. Calculate statistics (Token estimation)
                    const renderedLength = renderedText.length
                    const estimatedTokens = estimateTokens(renderedText)

                    // 5. Generate variable highlighted version
                    const highlightedText = highlightVariables(
                        cachedPrompt.metadata.template,
                        renderedText,
                        context
                    )

                    logger.debug(
                        {
                            promptId,
                            renderedLength,
                            estimatedTokens,
                        },
                        'Template rendered successfully'
                    )

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: true,
                                    renderedText,
                                    highlightedText,
                                    statistics: {
                                        renderedLength,
                                        estimatedTokens,
                                    },
                                    warnings,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: true,
                            renderedText,
                            highlightedText,
                            statistics: {
                                renderedLength,
                                estimatedTokens,
                            },
                            warnings,
                        },
                    }
                } catch (renderError) {
                    const error =
                        renderError instanceof Error
                            ? renderError
                            : new Error(String(renderError))

                    logger.error(
                        { promptId, error },
                        'Template rendering failed'
                    )

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: `Template rendering failed: ${error.message}`,
                                }),
                            },
                        ],
                        structuredContent: {
                            success: false,
                            error: `Template rendering failed: ${error.message}`,
                        },
                        isError: true,
                    }
                }
            } catch (error) {
                const previewError =
                    error instanceof Error ? error : new Error(String(error))
                logger.error({ error: previewError }, 'preview_prompt tool failed')

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: previewError.message,
                            }),
                        },
                    ],
                    structuredContent: {
                        success: false,
                        error: previewError.message,
                    },
                    isError: true,
                }
            }
        },
    })
    logger.info('preview_prompt tool registered')
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
