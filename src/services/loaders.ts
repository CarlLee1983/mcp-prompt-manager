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
import {
    PromptMetadataSchema,
    type PromptMetadata,
} from '../types/promptMetadata.js'
import { RegistrySchema, type Registry } from '../types/registry.js'
import type {
    PromptRuntime,
    PromptRuntimeState,
    PromptSource,
} from '../types/promptRuntime.js'

// Track registered prompts, tools, and partials for reload functionality
const registeredPromptIds = new Set<string>()
const registeredToolRefs = new Map<string, { remove: () => void }>()
const registeredPartials = new Set<string>()

// Track prompt runtime states
const promptRuntimeMap = new Map<string, PromptRuntime>()

// 重入保護鎖：追蹤當前正在執行的 reload Promise
let reloadingPromise: Promise<{ loaded: number; errors: LoadError[] }> | null = null

// 待註冊的 prompt 資訊（用於排序）
interface PendingPromptRegistration {
    promptDef: PromptDefinition
    promptRuntime: PromptRuntime
    zodShape: z.ZodRawShape
    templateDelegate: HandlebarsTemplateDelegate
    filePath: string
    relativePath: string
}

/**
 * 比較版本號（semver）
 * @param version1 - 版本號 1
 * @param version2 - 版本號 2
 * @returns 比較結果：-1 (v1 < v2), 0 (v1 === v2), 1 (v1 > v2)
 */
function compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length)
    for (let i = 0; i < maxLength; i++) {
        const v1Part = v1Parts[i] ?? 0
        const v2Part = v2Parts[i] ?? 0
        if (v1Part < v2Part) return 1 // 較新版本優先，所以返回 1
        if (v1Part > v2Part) return -1
    }
    return 0
}

/**
 * 對 prompts 進行優先權排序
 * 排序規則：
 * 1. status 優先級：stable > draft > deprecated > legacy
 * 2. version（較新版本優先）
 * 3. source 優先級：registry > embedded > legacy
 * 
 * @param prompts - 待排序的 prompts
 * @returns 排序後的 prompts
 */
function sortPromptsByPriority(
    prompts: PendingPromptRegistration[]
): PendingPromptRegistration[] {
    const statusPriority: Record<string, number> = {
        stable: 4,
        draft: 3,
        deprecated: 2,
        legacy: 1,
    }

    const sourcePriority: Record<string, number> = {
        registry: 3,
        embedded: 2,
        legacy: 1,
    }

    return prompts.sort((a, b) => {
        const runtimeA = a.promptRuntime
        const runtimeB = b.promptRuntime

        // 1. status 優先級（較高優先）
        const statusA = statusPriority[runtimeA.status] ?? 0
        const statusB = statusPriority[runtimeB.status] ?? 0
        const statusDiff = statusB - statusA
        if (statusDiff !== 0) return statusDiff

        // 2. version（較新版本優先）
        const versionDiff = compareVersions(runtimeA.version, runtimeB.version)
        if (versionDiff !== 0) return versionDiff

        // 3. source 優先級（較高優先）
        const sourceA = sourcePriority[runtimeA.source] ?? 0
        const sourceB = sourcePriority[runtimeB.source] ?? 0
        const sourceDiff = sourceB - sourceA
        if (sourceDiff !== 0) return sourceDiff

        // 4. 最後按 ID 字母順序（確保穩定性）
        return a.promptDef.id.localeCompare(b.promptDef.id)
    })
}

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
    'registry.yaml',
]

/**
 * 判斷 YAML 資料是否為 Metadata Prompt
 * 只要檢查是否有 version 和 status 欄位即可，格式驗證由 PromptMetadataSchema 負責
 * 這可以讓格式錯誤的 metadata 被標記為 warning，而不是 legacy
 */
function isMetadataPrompt(yamlData: unknown): boolean {
    if (typeof yamlData !== 'object' || yamlData === null) {
        return false
    }
    const data = yamlData as Record<string, unknown>
    
    // 只要檢查是否有 version 和 status 欄位即可
    // 格式驗證由 PromptMetadataSchema 負責
    const hasVersion = typeof data.version === 'string' && data.version.length > 0
    const hasStatus = typeof data.status === 'string' && data.status.length > 0
    
    return hasVersion && hasStatus
}

/**
 * 載入 registry.yaml 檔案
 * @param storageDir - Storage directory
 * @returns Registry 物件或 null（如果檔案不存在或載入失敗）
 */
async function loadRegistry(
    storageDir: string
): Promise<Registry | null> {
    const registryPath = path.join(storageDir, 'registry.yaml')
    try {
        const content = await fs.readFile(registryPath, 'utf-8')
        const yamlData = yaml.load(content)
        const parseResult = RegistrySchema.safeParse(yamlData)
        if (!parseResult.success) {
            logger.warn(
                { error: parseResult.error },
                'Failed to parse registry.yaml, ignoring'
            )
            return null
        }
        logger.debug('Registry loaded successfully')
        return parseResult.data
    } catch (error) {
        // 檔案不存在是正常情況，不記錄錯誤
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            logger.debug('registry.yaml not found, skipping')
            return null
        }
        logger.warn({ error }, 'Failed to load registry.yaml, ignoring')
        return null
    }
}

/**
 * 建立 PromptRuntime 物件
 * @param promptDef - Prompt definition
 * @param metadata - Metadata（如果有的話）
 * @param groupName - Group name
 * @param registry - Registry override（如果有的話）
 * @param runtimeState - Runtime state（如果已經確定）
 * @param source - Source（如果已經確定）
 * @returns PromptRuntime 物件
 */
function createPromptRuntime(
    promptDef: PromptDefinition,
    metadata: PromptMetadata | null,
    groupName: string,
    registry: Registry | null,
    runtimeState?: PromptRuntimeState,
    source?: PromptSource
): PromptRuntime {
    const registryEntry = registry?.prompts.find((p) => p.id === promptDef.id)
    let finalRuntimeState: PromptRuntimeState
    let finalSource: PromptSource
    let version: string
    let status: 'draft' | 'stable' | 'deprecated' | 'legacy'
    let tags: string[]
    let useCases: string[]

    // 決定 version、status、tags、useCases
    if (metadata) {
        version = metadata.version
        status = metadata.status
        tags = metadata.tags ?? []
        useCases = metadata.use_cases ?? []
    } else {
        version = '0.0.0'
        status = 'legacy'
        tags = []
        useCases = []
    }

    // 決定 runtimeState 和 source
    // 優先級：registry > metadata > legacy
    // 先決定基礎狀態（metadata 或 legacy）
    if (runtimeState !== undefined && source !== undefined) {
        // 如果已經提供了 runtimeState 和 source，使用它們作為基礎
        finalRuntimeState = runtimeState
        finalSource = source
    } else if (metadata) {
        // Metadata Prompt
        finalSource = 'embedded'
        finalRuntimeState = 'active'
    } else {
        // Legacy Prompt
        finalSource = 'legacy'
        finalRuntimeState = 'legacy'
    }

    // Registry override（最高優先級，會覆蓋所有狀態）
    if (registryEntry) {
        finalSource = 'registry'
        if (registryEntry.deprecated) {
            finalRuntimeState = 'disabled'
        } else {
            // Registry 存在且未 deprecated，覆蓋為 active（矯正 warning 等狀態）
            finalRuntimeState = 'active'
        }
    }

    const runtime: PromptRuntime = {
        id: promptDef.id,
        title: promptDef.title,
        version,
        status,
        tags,
        use_cases: useCases,
        runtime_state: finalRuntimeState,
        source: finalSource,
        group: registryEntry?.group ?? groupName,
    }

    if (registryEntry?.visibility !== undefined) {
        runtime.visibility = registryEntry.visibility
    }

    return runtime
}

export async function loadPrompts(
    server: McpServer,
    storageDir?: string
): Promise<{ loaded: number; errors: LoadError[]; loadedToolIds?: Set<string> }> {
    const dir = storageDir ?? STORAGE_DIR

    // 追蹤新載入的 tool IDs（用於雙 registry swap）
    const newToolIds = new Set<string>()

    // 清空 runtime cache
    promptRuntimeMap.clear()

    // Explicitly log loaded groups and whether using default values
    const logContext: Record<string, unknown> = {
        activeGroups: ACTIVE_GROUPS,
    }

    if (IS_DEFAULT_GROUPS) {
        logContext.isDefault = true
        logContext.hint = 'Set MCP_GROUPS to load additional groups'
    }

    logger.info(logContext, 'Loading prompts')

    // 載入 registry.yaml（如果存在）
    const registry = await loadRegistry(dir)

    const allFiles = await getFilesRecursively(dir)
    let loadedCount = 0
    const errors: LoadError[] = []
    
    // 收集所有待註冊的 prompts（用於排序）
    const pendingRegistrations: PendingPromptRegistration[] = []

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

            // 先驗證基本 Prompt 結構
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

            // 判斷是否為 Metadata Prompt
            let metadata: PromptMetadata | null = null
            let runtimeState: PromptRuntimeState = 'legacy'
            let source: PromptSource = 'legacy'

            if (isMetadataPrompt(yamlData)) {
                // 嘗試解析 Metadata
                const metadataResult = PromptMetadataSchema.safeParse(yamlData)
                if (metadataResult.success) {
                    metadata = metadataResult.data
                    source = 'embedded'
                    runtimeState = 'active'
                } else {
                    // Metadata 驗證失敗（不是結構解析失敗，所以標記為 warning）
                    logger.warn(
                        {
                            filePath,
                            promptId: promptDef.id,
                            errors: metadataResult.error.issues,
                        },
                        'Metadata validation failed, marking as warning'
                    )
                    runtimeState = 'warning'
                    source = 'embedded'
                }
            }

            // 建立 PromptRuntime
            // 使用型別斷言，因為 parseResult.data 已經通過 Zod 驗證，符合 PromptDefinition
            const promptRuntime = createPromptRuntime(
                promptDef as PromptDefinition,
                metadata,
                groupName,
                registry,
                runtimeState,
                source
            )

            // 儲存 runtime 資訊（無論狀態如何）
            promptRuntimeMap.set(promptDef.id, promptRuntime)

            // 只註冊 runtime_state === 'active' 的 prompts 作為 tools
            // 其他狀態（invalid, disabled, legacy, warning）不註冊為 tools，但仍記錄在 runtime map 中
            if (promptRuntime.runtime_state !== 'active') {
                const stateReason = {
                    invalid: 'Prompt marked as invalid',
                    disabled: 'Prompt disabled by registry',
                    legacy: 'Legacy prompt (not registered as tool)',
                    warning: 'Prompt has metadata validation warnings',
                }[promptRuntime.runtime_state] || 'Unknown state'

                logger.debug(
                    {
                        promptId: promptDef.id,
                        filePath,
                        runtime_state: promptRuntime.runtime_state,
                    },
                    `${stateReason}, skipping tool registration`
                )
                continue
            }

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

            // 收集待註冊的 prompt（稍後排序並註冊）
            pendingRegistrations.push({
                promptDef: promptDef as PromptDefinition,
                promptRuntime,
                zodShape,
                templateDelegate,
                filePath,
                relativePath,
            })
        } catch (error) {
            const loadError =
                error instanceof Error ? error : new Error(String(error))
            errors.push({ file: relativePath, error: loadError })
            logger.warn({ filePath, error: loadError }, 'Failed to load prompt')
        }
    }

    // 對待註冊的 prompts 進行優先權排序
    const sortedRegistrations = sortPromptsByPriority(pendingRegistrations)
    logger.debug(
        { total: sortedRegistrations.length },
        'Prompts sorted by priority (status > version > source)'
    )

    // 按照排序後的順序註冊 prompts 和 tools
    for (const {
        promptDef,
        promptRuntime,
        zodShape,
        templateDelegate,
        filePath,
        relativePath,
    } of sortedRegistrations) {
        try {
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

            // 構建增強的工具描述，包含 tags 和 use_cases 供 Agent 判斷
            let enhancedDescription = description
            if (triggerText) {
                enhancedDescription += `\n\nTRIGGER: ${triggerText}`
            }

            // 加入 tags 資訊（如果有的話）
            if (promptRuntime.tags && promptRuntime.tags.length > 0) {
                enhancedDescription += `\n\nTags: ${promptRuntime.tags.join(', ')}`
            }

            // 加入 use_cases 資訊（如果有的話）
            if (promptRuntime.use_cases && promptRuntime.use_cases.length > 0) {
                enhancedDescription += `\n\nUse Cases: ${promptRuntime.use_cases.join(', ')}`
            }

            // Create tool's inputSchema (same as prompt's args)
            const toolInputSchema = Object.keys(zodShape).length > 0
                ? z.object(zodShape)
                : z.object({})

            // Register Tool (using registerTool, recommended API)
            // 雙 registry swap：先註冊新的 tool（MCP SDK 可能會覆蓋舊的，或暫時並存）
            // 舊的 tool 會在 reloadPrompts 的最後階段移除，確保零空窗期
            // 只註冊 runtime_state === 'active' 的 prompts 作為 tools
            // 按照優先權排序後的順序註冊，讓 Agent 能夠優先選擇高優先權的 tools
            const toolRef = server.registerTool(
                promptDef.id,
                {
                    title: promptDef.title,
                    description: enhancedDescription,
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
            
            // 如果已存在舊的 tool ref，先保存它（稍後在 removeOldPrompts 中移除）
            // 這樣可以確保新舊 tool 同時存在，避免空窗期
            const oldToolRef = registeredToolRefs.get(promptDef.id)
            if (oldToolRef) {
                logger.debug({ promptId: promptDef.id }, 'New tool registered, old tool will be removed later')
            }

            registeredToolRefs.set(promptDef.id, toolRef)
            newToolIds.add(promptDef.id)

            loadedCount++
            logger.debug(
                {
                    promptId: promptDef.id,
                    runtimeState: promptRuntime.runtime_state,
                    source: promptRuntime.source,
                    status: promptRuntime.status,
                },
                'Prompt loaded and registered'
            )
        } catch (error) {
            const loadError =
                error instanceof Error ? error : new Error(String(error))
            errors.push({ file: relativePath, error: loadError })
            logger.warn({ filePath, error: loadError }, 'Failed to register prompt')
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

    return { loaded: loadedCount, errors, loadedToolIds: newToolIds }
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
 * Remove old prompts and tools that are no longer in the new set
 * Only removes tools that are not in the newToolIds set
 * This is used for zero-downtime reload (dual registry swap)
 * 
 * @param newToolIds - Set of tool IDs that should remain registered
 */
function removeOldPrompts(newToolIds: Set<string>): void {
    const toolsToRemove: string[] = []
    
    // 找出需要移除的舊 tools（不在新列表中的）
    for (const toolId of registeredToolRefs.keys()) {
        if (!newToolIds.has(toolId)) {
            toolsToRemove.push(toolId)
        }
    }
    
    // 移除不再需要的 tools
    for (const toolId of toolsToRemove) {
        const toolRef = registeredToolRefs.get(toolId)
        if (toolRef) {
            try {
                toolRef.remove()
                registeredToolRefs.delete(toolId)
                registeredPromptIds.delete(toolId)
                promptRuntimeMap.delete(toolId)
                logger.debug({ toolId }, 'Old tool removed')
            } catch (error) {
                logger.warn({ toolId, error }, 'Failed to remove old tool')
            }
        }
    }
    
    if (toolsToRemove.length > 0) {
        logger.info(
            { removed: toolsToRemove.length },
            'Old prompts and tools removed'
        )
    }
}

/**
 * Clear all registered prompts and tools
 * Removes all tools using their .remove() method
 * Note: Prompts are cleared by re-registering (overwriting) them
 * @deprecated Use removeOldPrompts for zero-downtime reload instead
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
    promptRuntimeMap.clear()
    logger.info('All prompts and tools cleared')
}

/**
 * Reload all prompts from Git repository
 * 
 * This function performs a zero-downtime reload using dual registry swap:
 * 1. Syncs Git repository (pulls latest changes)
 * 2. Clears file cache
 * 3. Clears all Handlebars partials
 * 4. Reloads Handlebars partials
 * 5. Loads and registers all new prompts/tools (overwrites existing, no downtime)
 * 6. Removes old prompts/tools that are no longer needed
 * 
 * The dual registry swap ensures there's no gap where tools are unavailable:
 * - New tools are registered first (overwriting old ones if they exist)
 * - Old tools are only removed after new ones are ready
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
        logger.info('Starting prompts reload (zero-downtime)')
        
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
            
            // 4. Reload Handlebars partials
            const partialsCount = await loadPartials(storageDir)
            logger.info({ count: partialsCount }, 'Partials reloaded')
            
            // 5. Load and register all new prompts/tools (dual registry swap - step 1)
            // This registers new tools, overwriting old ones if they exist
            // Old tools remain available during this process (no downtime)
            const result = await loadPrompts(server, storageDir)
            
            // 6. Remove old prompts/tools that are no longer needed (dual registry swap - step 2)
            // Only removes tools that are not in the new set
            if (result.loadedToolIds) {
                removeOldPrompts(result.loadedToolIds)
            } else {
                // Fallback: if loadedToolIds is not available, use clearAllPrompts
                // This should not happen in normal operation
                logger.warn('loadedToolIds not available, falling back to clearAllPrompts')
                clearAllPrompts()
            }
            
            logger.info(
                { loaded: result.loaded, errors: result.errors.length },
                'Prompts reload completed (zero-downtime)'
            )
            
            return { loaded: result.loaded, errors: result.errors }
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

/**
 * 取得所有 PromptRuntime 物件
 * @returns PromptRuntime 陣列
 */
export function getAllPromptRuntimes(): PromptRuntime[] {
    return Array.from(promptRuntimeMap.values())
}

/**
 * 取得指定 ID 的 PromptRuntime
 * @param id - Prompt ID
 * @returns PromptRuntime 或 undefined
 */
export function getPromptRuntime(id: string): PromptRuntime | undefined {
    return promptRuntimeMap.get(id)
}

/**
 * 取得 Prompt 統計資訊
 * @returns 統計物件
 */
export function getPromptStats(): {
    total: number
    active: number
    legacy: number
    invalid: number
    disabled: number
    warning: number
} {
    const runtimes = Array.from(promptRuntimeMap.values())
    return {
        total: runtimes.length,
        active: runtimes.filter((r) => r.runtime_state === 'active').length,
        legacy: runtimes.filter((r) => r.runtime_state === 'legacy').length,
        invalid: runtimes.filter((r) => r.runtime_state === 'invalid').length,
        disabled: runtimes.filter((r) => r.runtime_state === 'disabled').length,
        warning: runtimes.filter((r) => r.runtime_state === 'warning').length,
    }
}
