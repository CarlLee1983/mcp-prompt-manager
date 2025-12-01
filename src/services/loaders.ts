import fs from "fs/promises"
import path from "path"
import yaml from "js-yaml"
import Handlebars from "handlebars"
import { z } from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    IS_DEFAULT_GROUPS,
    LANG_INSTRUCTION,
    LANG_SETTING,
} from "../config/env.js"
import { logger } from "../utils/logger.js"
import { getFilesRecursively } from "../utils/fileSystem.js"
import type { PromptDefinition, PromptArgDefinition } from "../types/prompt.js"

// Prompt 定義驗證 Schema
const PromptDefinitionSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    args: z
        .record(
            z.string(),
            z.object({
                type: z.enum(["string", "number", "boolean"]),
                description: z.string().optional(),
                default: z.union([z.string(), z.number(), z.boolean()]).optional(),
            })
        )
        .optional(),
    template: z.string().min(1),
})

// 錯誤統計
interface LoadError {
    file: string
    error: Error
}

/**
 * 載入 Handlebars Partials
 * @param storageDir - 儲存目錄
 * @returns 載入的 partial 數量
 */
export async function loadPartials(storageDir?: string): Promise<number> {
    const dir = storageDir ?? STORAGE_DIR
    logger.debug("Loading Handlebars partials")
    const allFiles = await getFilesRecursively(dir)
    let count = 0

    for (const filePath of allFiles) {
        if (!filePath.endsWith(".hbs")) continue

        try {
            const content = await fs.readFile(filePath, "utf-8")
            const partialName = path.parse(filePath).name

            Handlebars.registerPartial(partialName, content)
            count++
            logger.debug({ partialName }, "Partial registered")
        } catch (error) {
            logger.warn({ filePath, error }, "Failed to load partial")
        }
    }

    logger.info({ count }, "Partials loaded")
    return count
}

/**
 * 建構 Zod Schema
 * @param args - Prompt 參數定義（來自 Zod 解析後的結果）
 * @returns Zod Schema 物件
 */
function buildZodSchema(
    args: Record<
        string,
        {
            type: "string" | "number" | "boolean"
            description?: string
            default?: string | number | boolean
        }
    >
): z.ZodRawShape {
    const zodShape: Record<string, z.ZodTypeAny> = {}
    if (args) {
        for (const [key, config] of Object.entries(args)) {
            let schema: z.ZodTypeAny

            // 根據類型建立基礎 schema
            if (config.type === "number") {
                schema = z.number()
            } else if (config.type === "boolean") {
                schema = z.boolean()
            } else {
                schema = z.string()
            }

            // 判斷參數是否為可選
            // 1. 如果有 default 值，參數是可選的
            // 2. 如果 description 中包含 "optional"，參數是可選的
            // 3. 如果 description 中明確說 "required"，參數是必需的
            const hasDefault = config.default !== undefined
            const isOptionalInDesc =
                config.description?.toLowerCase().includes("optional") ?? false
            const isRequiredInDesc =
                config.description?.toLowerCase().includes("(required)") ?? false

            // 如果沒有明確標記為 required，且有 default 或標記為 optional，則設為可選
            if (!isRequiredInDesc && (hasDefault || isOptionalInDesc)) {
                schema = schema.optional()
                // 如果有 default 值，設定預設值
                if (hasDefault) {
                    schema = schema.default(config.default as never)
                }
            }

            // 設定描述
            if (config.description) {
                schema = schema.describe(config.description)
            }

            zodShape[key] = schema
        }
    }
    return zodShape
}

/**
 * 判斷是否應該載入該 prompt
 * 根據檔案路徑和活躍群組列表決定
 * @param relativePath - 相對於儲存目錄的路徑
 * @param activeGroups - 活躍群組列表
 * @returns 包含是否載入和群組名稱的物件
 * @remarks
 * - 根目錄的檔案永遠載入
 * - common 群組的檔案永遠載入
 * - 其他群組只有在 activeGroups 中時才載入
 */
function shouldLoadPrompt(
    relativePath: string,
    activeGroups: string[]
): {
    shouldLoad: boolean
    groupName: string
} {
    const pathParts = relativePath.split(path.sep)
    const groupName = pathParts.length > 1 ? (pathParts[0] ?? "root") : "root"
    const isAlwaysActive = groupName === "root" || groupName === "common"
    const isSelected = activeGroups.includes(groupName)

    return {
        shouldLoad: isAlwaysActive || isSelected,
        groupName,
    }
}

/**
 * 載入並註冊 Prompts 到 MCP Server
 *
 * 此函數會：
 * 1. 掃描儲存目錄中的所有 YAML/YML 檔案
 * 2. 根據群組過濾規則決定是否載入
 * 3. 使用 Zod 驗證 prompt 定義結構
 * 4. 編譯 Handlebars 模板
 * 5. 註冊到 MCP Server
 *
 * @param server - MCP Server 實例，用於註冊 prompts
 * @param storageDir - 儲存目錄路徑（可選，預設使用配置中的 STORAGE_DIR）
 * @returns 包含載入成功數量和錯誤列表的物件
 * @throws {Error} 當目錄無法訪問時
 *
 * @example
 * ```typescript
 * const { loaded, errors } = await loadPrompts(server)
 * if (errors.length > 0) {
 *   console.warn(`Failed to load ${errors.length} prompts`)
 * }
 * ```
 */
// 排除的非 prompt 檔案名稱（不區分大小寫）
const EXCLUDED_FILES = [
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
    "package.json",
    "composer.lock",
    "go.sum",
    "requirements.txt",
    "poetry.lock",
    "pom.xml",
    "build.gradle",
]

export async function loadPrompts(
    server: McpServer,
    storageDir?: string
): Promise<{ loaded: number; errors: LoadError[] }> {
    const dir = storageDir ?? STORAGE_DIR
    
    // 明確記錄載入的群組和是否為預設值
    const logContext: Record<string, unknown> = {
        activeGroups: ACTIVE_GROUPS,
    }
    
    if (IS_DEFAULT_GROUPS) {
        logContext.isDefault = true
        logContext.hint = "Set MCP_GROUPS to load additional groups"
    }
    
    logger.info(logContext, "Loading prompts")

    const allFiles = await getFilesRecursively(dir)
    let loadedCount = 0
    const errors: LoadError[] = []

    for (const filePath of allFiles) {
        if (!filePath.endsWith(".yaml") && !filePath.endsWith(".yml")) continue

        // 排除非 prompt 檔案
        const fileName = path.basename(filePath).toLowerCase()
        if (EXCLUDED_FILES.some((excluded) => fileName === excluded.toLowerCase())) {
            logger.debug({ filePath }, "Skipping excluded file")
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
                "Skipping prompt (not in active groups)"
            )
            continue
        }

        try {
            const content = await fs.readFile(filePath, "utf-8")
            const yamlData = yaml.load(content)

            // 使用 Zod 驗證結構
            const parseResult = PromptDefinitionSchema.safeParse(yamlData)
            if (!parseResult.success) {
                const error = new Error(
                    `Invalid prompt definition: ${parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
                )
                errors.push({ file: relativePath, error })
                logger.warn(
                    { filePath, error: parseResult.error },
                    "Failed to validate prompt definition"
                )
                continue
            }

            const promptDef = parseResult.data

            // 建構 Zod Schema
            const zodShape: z.ZodRawShape = promptDef.args
                ? buildZodSchema(promptDef.args as Record<
                      string,
                      {
                          type: "string" | "number" | "boolean"
                          description?: string
                          default?: string | number | boolean
                      }
                  >)
                : {}

            // 編譯 Handlebars 模板
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
                    "Failed to compile Handlebars template"
                )
                continue
            }

            // 建立 prompt 處理函數（可重用於 prompt 和 tool）
            const promptHandler = (args: Record<string, unknown>) => {
                try {
                    // 記錄 prompt 被調用
                    logger.info(
                        {
                            promptId: promptDef.id,
                            promptTitle: promptDef.title,
                            args: Object.keys(args),
                        },
                        "Prompt invoked"
                    )

                    // 自動注入語言指令與參數
                    const context = {
                        ...args,
                        output_lang_rule: LANG_INSTRUCTION,
                        sys_lang: LANG_SETTING,
                    }
                    const message = templateDelegate(context)
                    
                    // 記錄模板渲染成功
                    logger.debug(
                        {
                            promptId: promptDef.id,
                            messageLength: message.length,
                        },
                        "Template rendered successfully"
                    )
                    
                    return {
                        messages: [
                            {
                                role: "user" as const,
                                content: { type: "text" as const, text: message },
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
                        "Template execution failed"
                    )
                    throw execError
                }
            }

            // 註冊 Prompt
            server.prompt(promptDef.id, zodShape, promptHandler)

            // 同時註冊為 Tool，讓 AI 可以自動調用
            // 從 description 中提取 TRIGGER 資訊用於 tool 描述
            const description = promptDef.description || ""
            const triggerMatch = description.match(/TRIGGER:\s*(.+?)(?:\n|$)/i)
            const triggerText = triggerMatch && triggerMatch[1]
                ? triggerMatch[1].trim()
                : `When user needs ${promptDef.title.toLowerCase()}`

            // 建立 tool 的 inputSchema（與 prompt 的 args 相同）
            const toolInputSchema = Object.keys(zodShape).length > 0
                ? z.object(zodShape)
                : z.object({})

            // 註冊 Tool（使用 registerTool，推薦的 API）
            server.registerTool(
                promptDef.id,
                {
                    title: promptDef.title,
                    description: `${description}\n\n${triggerText}`,
                    inputSchema: toolInputSchema,
                },
                async (args: Record<string, unknown>) => {
                    // 記錄 tool 被調用（使用 info 級別，更容易看到）
                    logger.info(
                        {
                            toolId: promptDef.id,
                            toolTitle: promptDef.title,
                            args: Object.keys(args),
                            argsValues: Object.fromEntries(
                                Object.entries(args).map(([key, value]) => [
                                    key,
                                    typeof value === "string" && value.length > 100
                                        ? `${value.substring(0, 100)}...`
                                        : value,
                                ])
                            ),
                        },
                        "🔧 Tool invoked (calling prompt)"
                    )

                    // 調用 prompt handler 並返回結果
                    const result = promptHandler(args)
                    
                    // 記錄 tool 執行成功
                    const firstMessage = result.messages[0]
                    const messageText =
                        firstMessage?.content && "text" in firstMessage.content
                            ? firstMessage.content.text
                            : ""
                    
                    logger.info(
                        {
                            toolId: promptDef.id,
                            messageLength: messageText.length,
                        },
                        "✅ Tool execution completed"
                    )
                    
                    // Tool 需要返回 content 格式
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: messageText,
                            },
                        ],
                    }
                }
            )

            loadedCount++
            logger.debug({ groupName, promptId: promptDef.id }, "Prompt loaded")
        } catch (error) {
            const loadError =
                error instanceof Error ? error : new Error(String(error))
            errors.push({ file: relativePath, error: loadError })
            logger.warn({ filePath, error: loadError }, "Failed to load prompt")
        }
    }

    logger.info(
        { loaded: loadedCount, errors: errors.length },
        "Prompts loading completed"
    )

    if (errors.length > 0) {
        logger.warn(
            {
                errors: errors.map((e) => ({
                    file: e.file,
                    message: e.error.message,
                })),
            },
            "Some prompts failed to load"
        )
    }

    return { loaded: loadedCount, errors }
}
