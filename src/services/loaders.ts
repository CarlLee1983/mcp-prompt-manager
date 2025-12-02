import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import Handlebars from 'handlebars'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    IS_DEFAULT_GROUPS,
    LANG_INSTRUCTION,
    LANG_SETTING,
} from '../config/env.js'
import { logger } from '../utils/logger.js'
import { getFilesRecursively, clearFileCache } from '../utils/fileSystem.js'
import { syncRepo } from './git.js'
import type { PromptDefinition, PromptArgDefinition } from '../types/prompt.js'

// Track registered prompts, tools, and partials for reload functionality
const registeredPromptIds = new Set<string>()
const registeredToolRefs = new Map<string, { remove: () => void }>()
const registeredPartials = new Set<string>()

// 重入保護鎖：追蹤當前正在執行的 reload Promise
let reloadingPromise: Promise<{ loaded: number; errors: LoadError[] }> | null = null

// Prompt definition validation schema
const PromptDefinitionSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    args: z
        .record(
            z.string(),
            z.object({
                type: z.enum(['string', 'number', 'boolean']),
                description: z.string().optional(),
                default: z.union([z.string(), z.number(), z.boolean()]).optional(),
                required: z.boolean().optional(),
            })
        )
        .optional(),
    template: z.string().min(1),
})

// Error statistics
interface LoadError {
    file: string
    error: Error
}

/**
 * Load Handlebars Partials
 * @param storageDir - Storage directory
 * @returns Number of partials loaded
 */
export async function loadPartials(storageDir?: string): Promise<number> {
    const dir = storageDir ?? STORAGE_DIR
    logger.debug('Loading Handlebars partials')
    const allFiles = await getFilesRecursively(dir)
    let count = 0

    for (const filePath of allFiles) {
        if (!filePath.endsWith('.hbs')) continue

        try {
            const content = await fs.readFile(filePath, 'utf-8')
            const partialName = path.parse(filePath).name

            Handlebars.registerPartial(partialName, content)
            registeredPartials.add(partialName)
            count++
            logger.debug({ partialName }, 'Partial registered')
        } catch (error) {
            logger.warn({ filePath, error }, 'Failed to load partial')
        }
    }

    logger.info({ count }, 'Partials loaded')
    return count
}

/**
 * Build Zod Schema
 * @param args - Prompt argument definitions (from Zod parsed result)
 * @returns Zod Schema object
 */
function buildZodSchema(
    args: Record<
        string,
        {
            type: 'string' | 'number' | 'boolean'
            description?: string
            default?: string | number | boolean
            required?: boolean
        }
    >
): z.ZodRawShape {
    const zodShape: Record<string, z.ZodTypeAny> = {}
    if (args) {
        for (const [key, config] of Object.entries(args)) {
            let schema: z.ZodTypeAny

            // Create base schema based on type with coercion support
            // Use z.coerce to automatically convert string 'true'/'false' to boolean
            // and string numbers to numbers (for MCP clients that send strings)
            if (config.type === 'number') {
                schema = z.coerce.number()
            } else if (config.type === 'boolean') {
                schema = z.coerce.boolean()
            } else {
                schema = z.string()
            }

            const hasDefault = config.default !== undefined

            // Priority 1: Use explicit required field if present
            if (config.required !== undefined) {
                if (config.required === true) {
                    // Parameter is required - don't make it optional
                    // (schema remains as-is, which means required)
                } else {
                    // Parameter is explicitly optional
                    schema = schema.optional()
                    // If there's a default value, set the default
                    if (hasDefault) {
                        schema = schema.default(config.default as never)
                    }
                }
            } else {
                // Priority 2: Fallback to existing logic for backward compatibility
                // 1. If there's a default value, parameter is optional
                // 2. If description contains 'optional', parameter is optional
                // 3. If description explicitly says 'required', parameter is required
                const isOptionalInDesc =
                    config.description?.toLowerCase().includes('optional') ?? false
                const isRequiredInDesc =
                    config.description?.toLowerCase().includes('(required)') ?? false

                // If not explicitly marked as required, and has default or marked as optional, set as optional
                if (!isRequiredInDesc && (hasDefault || isOptionalInDesc)) {
                    schema = schema.optional()
                    // If there's a default value, set the default
                    if (hasDefault) {
                        schema = schema.default(config.default as never)
                    }
                }
                // If isRequiredInDesc is true, schema remains required (no change needed)
            }

            // Set description
            if (config.description) {
                schema = schema.describe(config.description)
            }

            zodShape[key] = schema
        }
    }
    return zodShape
}

/**
 * Determine whether a prompt should be loaded
 * Based on file path and active groups list
 * @param relativePath - Path relative to storage directory
 * @param activeGroups - Active groups list
 * @returns Object containing whether to load and group name
 * @remarks
 * - Files in root directory are always loaded
 * - Files in 'common' group are always loaded
 * - Other groups are only loaded when in activeGroups
 */
function shouldLoadPrompt(
    relativePath: string,
    activeGroups: string[]
): {
    shouldLoad: boolean
    groupName: string
} {
    const pathParts = relativePath.split(path.sep)
    const groupName = pathParts.length > 1 ? (pathParts[0] ?? 'root') : 'root'
    const isAlwaysActive = groupName === 'root' || groupName === 'common'
    const isSelected = activeGroups.includes(groupName)

    return {
        shouldLoad: isAlwaysActive || isSelected,
        groupName,
    }
}

/**
 * Load and register Prompts to MCP Server
 *
 * This function will:
 * 1. Scan all YAML/YML files in the storage directory
 * 2. Determine whether to load based on group filtering rules
 * 3. Validate prompt definition structure using Zod
 * 4. Compile Handlebars templates
 * 5. Register to MCP Server
 *
 * @param server - MCP Server instance for registering prompts
 * @param storageDir - Storage directory path (optional, defaults to STORAGE_DIR from config)
 * @returns Object containing number of successfully loaded prompts and error list
 * @throws {Error} When directory cannot be accessed
 *
 * @example
 * ```typescript
 * const { loaded, errors } = await loadPrompts(server)
 * if (errors.length > 0) {
 *   console.warn(`Failed to load ${errors.length} prompts`)
 * }
 * ```
 */
// Excluded non-prompt file names (case-insensitive)
const EXCLUDED_FILES = [
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
    'package.json',
    'composer.lock',
    'go.sum',
    'requirements.txt',
    'poetry.lock',
    'pom.xml',
    'build.gradle',
]

export async function loadPrompts(
    server: McpServer,
    storageDir?: string
): Promise<{ loaded: number; errors: LoadError[] }> {
    const dir = storageDir ?? STORAGE_DIR
    
    // Explicitly log loaded groups and whether using default values
    const logContext: Record<string, unknown> = {
        activeGroups: ACTIVE_GROUPS,
    }
    
    if (IS_DEFAULT_GROUPS) {
        logContext.isDefault = true
        logContext.hint = 'Set MCP_GROUPS to load additional groups'
    }
    
    logger.info(logContext, 'Loading prompts')

    const allFiles = await getFilesRecursively(dir)
    let loadedCount = 0
    const errors: LoadError[] = []

    for (const filePath of allFiles) {
        if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) continue

        // Exclude non-prompt files
        const fileName = path.basename(filePath).toLowerCase()
        if (EXCLUDED_FILES.some((excluded) => fileName === excluded.toLowerCase())) {
            logger.debug({ filePath }, 'Skipping excluded file')
            continue
        }

        const relativePath = path.relative(dir, filePath)
        const { shouldLoad, groupName } = shouldLoadPrompt(
            relativePath,
            ACTIVE_GROUPS
        )

        if (!shouldLoad) {
            logger.debug(
                { filePath, groupName },
                'Skipping prompt (not in active groups)'
            )
            continue
        }

        try {
            const content = await fs.readFile(filePath, 'utf-8')
            const yamlData = yaml.load(content)

            // Validate structure using Zod
            const parseResult = PromptDefinitionSchema.safeParse(yamlData)
            if (!parseResult.success) {
                const error = new Error(
                    `Invalid prompt definition: ${parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                )
                errors.push({ file: relativePath, error })
                logger.warn(
                    { filePath, error: parseResult.error },
                    'Failed to validate prompt definition'
                )
                continue
            }

            const promptDef = parseResult.data

            // Build Zod Schema
            const zodShape: z.ZodRawShape = promptDef.args
                ? buildZodSchema(promptDef.args as Record<
                      string,
                      {
                          type: 'string' | 'number' | 'boolean'
                          description?: string
                          default?: string | number | boolean
                          required?: boolean
                      }
                  >)
                : {}

            // Compile Handlebars template
            let templateDelegate: HandlebarsTemplateDelegate
            try {
                templateDelegate = Handlebars.compile(promptDef.template, {
                    noEscape: true,
                })
            } catch (error) {
                const compileError =
                    error instanceof Error ? error : new Error(String(error))
                errors.push({
                    file: relativePath,
                    error: new Error(
                        `Failed to compile template: ${compileError.message}`
                    ),
                })
                logger.warn(
                    { filePath, error: compileError },
                    'Failed to compile Handlebars template'
                )
                continue
            }

            // Create prompt handler function (reusable for both prompt and tool)
            const promptHandler = (args: Record<string, unknown>) => {
                try {
                    // Log prompt invocation
                    logger.info(
                        {
                            promptId: promptDef.id,
                            promptTitle: promptDef.title,
                            args: Object.keys(args),
                        },
                        'Prompt invoked'
                    )

                    // Automatically inject language instruction and parameters
                    const context = {
                        ...args,
                        output_lang_rule: LANG_INSTRUCTION,
                        sys_lang: LANG_SETTING,
                    }
                    const message = templateDelegate(context)
                    
                    // Log successful template rendering
                    logger.debug(
                        {
                            promptId: promptDef.id,
                            messageLength: message.length,
                        },
                        'Template rendered successfully'
                    )
                    
                    return {
                        messages: [
                            {
                                role: 'user' as const,
                                content: { type: 'text' as const, text: message },
                            },
                        ],
                    }
                } catch (error) {
                    const execError =
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    logger.error(
                        { promptId: promptDef.id, error: execError },
                        'Template execution failed'
                    )
                    throw execError
                }
            }

            // Register Prompt
            server.prompt(promptDef.id, zodShape, promptHandler)
            registeredPromptIds.add(promptDef.id)

            // Also register as Tool so AI can automatically invoke it
            // Extract TRIGGER information from description for tool description
            const description = promptDef.description || ''
            const triggerMatch = description.match(/TRIGGER:\s*(.+?)(?:\n|$)/i)
            const triggerText = triggerMatch && triggerMatch[1]
                ? triggerMatch[1].trim()
                : `When user needs ${promptDef.title.toLowerCase()}`

            // Create tool's inputSchema (same as prompt's args)
            const toolInputSchema = Object.keys(zodShape).length > 0
                ? z.object(zodShape)
                : z.object({})

            // Register Tool (using registerTool, recommended API)
            const toolRef = server.registerTool(
                promptDef.id,
                {
                    title: promptDef.title,
                    description: `${description}\n\n${triggerText}`,
                    inputSchema: toolInputSchema,
                },
                async (args: Record<string, unknown>) => {
                    // Log tool invocation (using info level for better visibility)
                    logger.info(
                        {
                            toolId: promptDef.id,
                            toolTitle: promptDef.title,
                            args: Object.keys(args),
                            argsValues: Object.fromEntries(
                                Object.entries(args).map(([key, value]) => [
                                    key,
                                    typeof value === 'string' && value.length > 100
                                        ? `${value.substring(0, 100)}...`
                                        : value,
                                ])
                            ),
                        },
                        '🔧 Tool invoked (calling prompt)'
                    )

                    // Call prompt handler and return result
                    const result = promptHandler(args)
                    
                    // Log successful tool execution
                    const firstMessage = result.messages[0]
                    const messageText =
                        firstMessage?.content && 'text' in firstMessage.content
                            ? firstMessage.content.text
                            : ''
                    
                    logger.info(
                        {
                            toolId: promptDef.id,
                            messageLength: messageText.length,
                        },
                        '✅ Tool execution completed'
                    )
                    
                    // Tool needs to return content format
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: messageText,
                            },
                        ],
                    }
                }
            )
            registeredToolRefs.set(promptDef.id, toolRef)

            loadedCount++
            logger.debug({ groupName, promptId: promptDef.id }, 'Prompt loaded')
        } catch (error) {
            const loadError =
                error instanceof Error ? error : new Error(String(error))
            errors.push({ file: relativePath, error: loadError })
            logger.warn({ filePath, error: loadError }, 'Failed to load prompt')
        }
    }

    logger.info(
        { loaded: loadedCount, errors: errors.length },
        'Prompts loading completed'
    )

    if (errors.length > 0) {
        logger.warn(
            {
                errors: errors.map((e) => ({
                    file: e.file,
                    message: e.error.message,
                })),
            },
            'Some prompts failed to load'
        )
    }

    return { loaded: loadedCount, errors }
}

/**
 * Clear all registered Handlebars partials
 * Unregisters all partials that were registered during loadPartials()
 */
function clearAllPartials(): void {
    for (const partialName of registeredPartials) {
        try {
            Handlebars.unregisterPartial(partialName)
            logger.debug({ partialName }, 'Partial unregistered')
        } catch (error) {
            logger.warn({ partialName, error }, 'Failed to unregister partial')
        }
    }
    registeredPartials.clear()
    logger.info('All partials cleared')
}

/**
 * Clear all registered prompts and tools
 * Removes all tools using their .remove() method
 * Note: Prompts are cleared by re-registering (overwriting) them
 */
function clearAllPrompts(): void {
    // Remove all registered tools
    for (const [toolId, toolRef] of registeredToolRefs.entries()) {
        try {
            toolRef.remove()
            logger.debug({ toolId }, 'Tool removed')
        } catch (error) {
            logger.warn({ toolId, error }, 'Failed to remove tool')
        }
    }
    
    // Clear tracking sets
    registeredToolRefs.clear()
    registeredPromptIds.clear()
    logger.info('All prompts and tools cleared')
}

/**
 * Reload all prompts from Git repository
 * 
 * This function performs a complete reload of prompts:
 * 1. Syncs Git repository (pulls latest changes)
 * 2. Clears file cache
 * 3. Clears all Handlebars partials
 * 4. Clears all registered prompts/tools
 * 5. Reloads Handlebars partials
 * 6. Reloads all prompts and tools
 * 
 * @param server - MCP Server instance for registering prompts
 * @param storageDir - Storage directory path (optional, defaults to STORAGE_DIR from config)
 * @returns Object containing number of successfully loaded prompts and error list
 * @throws {Error} When Git sync fails or directory cannot be accessed
 * 
 * @example
 * ```typescript
 * const result = await reloadPrompts(server)
 * console.log(`Reloaded ${result.loaded} prompts`)
 * ```
 */
export async function reloadPrompts(
    server: McpServer,
    storageDir?: string
): Promise<{ loaded: number; errors: LoadError[] }> {
    // 重入保護：如果已經有正在執行的 reload，直接返回該 Promise
    if (reloadingPromise !== null) {
        logger.warn('Reload already in progress, returning existing promise')
        return reloadingPromise
    }
    
    // 建立新的 reload Promise
    reloadingPromise = (async () => {
        logger.info('Starting prompts reload')
        
        try {
            // 1. Sync Git repository
            await syncRepo()
            logger.info('Git repository synced')
            
            // 2. Clear file cache
            const dir = storageDir ?? STORAGE_DIR
            clearFileCache(dir)
            logger.debug('File cache cleared')
            
            // 3. Clear all partials
            clearAllPartials()
            
            // 4. Clear all registered prompts/tools
            clearAllPrompts()
            
            // 5. Reload Handlebars partials
            const partialsCount = await loadPartials(storageDir)
            logger.info({ count: partialsCount }, 'Partials reloaded')
            
            // 6. Reload all prompts
            const result = await loadPrompts(server, storageDir)
            
            logger.info(
                { loaded: result.loaded, errors: result.errors.length },
                'Prompts reload completed'
            )
            
            return result
        } catch (error) {
            const reloadError =
                error instanceof Error ? error : new Error(String(error))
            logger.error({ error: reloadError }, 'Failed to reload prompts')
            throw reloadError
        } finally {
            // 清除重入保護鎖，確保即使發生錯誤也能清除
            reloadingPromise = null
        }
    })()
    
    return reloadingPromise
}

/**
 * 取得已載入的 prompt 數量
 * @returns 已載入的 prompt 數量
 */
export function getLoadedPromptCount(): number {
    return registeredPromptIds.size
}

/**
 * 取得已註冊的 prompt ID 清單
 * @returns 已註冊的 prompt ID 陣列
 */
export function getRegisteredPromptIds(): string[] {
    return Array.from(registeredPromptIds)
}
