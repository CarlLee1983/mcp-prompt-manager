import fs from "fs/promises"
import path from "path"
import yaml from "js-yaml"
import Handlebars from "handlebars"
import { z } from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
    STORAGE_DIR,
    ACTIVE_GROUPS,
    LANG_INSTRUCTION,
    LANG_SETTING,
} from "../config/env.js"
import { logger } from "../utils/logger.js"
import { getFilesRecursively } from "../utils/fileSystem.js"
import type { PromptDefinition } from "../types/prompt.js"

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
 * @param args - Prompt 參數定義
 * @returns Zod Schema 物件
 */
function buildZodSchema(
    args: Record<
        string,
        { type: "string" | "number" | "boolean"; description?: string }
    >
): Record<string, z.ZodTypeAny> {
    const zodShape: Record<string, z.ZodTypeAny> = {}
    if (args) {
        for (const [key, config] of Object.entries(args)) {
            let schema: z.ZodTypeAny
            if (config.type === "number") schema = z.number()
            else if (config.type === "boolean") schema = z.boolean()
            else schema = z.string()

            if (config.description) schema = schema.describe(config.description)
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
export async function loadPrompts(
    server: McpServer,
    storageDir?: string
): Promise<{ loaded: number; errors: LoadError[] }> {
    const dir = storageDir ?? STORAGE_DIR
    logger.info({ activeGroups: ACTIVE_GROUPS }, "Loading prompts")

    const allFiles = await getFilesRecursively(dir)
    let loadedCount = 0
    const errors: LoadError[] = []

    for (const filePath of allFiles) {
        if (!filePath.endsWith(".yaml") && !filePath.endsWith(".yml")) continue

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
            const zodShape = promptDef.args
                ? buildZodSchema(
                      promptDef.args as Record<
                          string,
                          {
                              type: "string" | "number" | "boolean"
                              description?: string
                          }
                      >
                  )
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

            // 註冊 Prompt
            server.prompt(promptDef.id, zodShape, (args) => {
                try {
                    // 自動注入語言指令與參數
                    const context = {
                        ...args,
                        output_lang_rule: LANG_INSTRUCTION,
                        sys_lang: LANG_SETTING,
                    }
                    const message = templateDelegate(context)
                    return {
                        messages: [
                            {
                                role: "user",
                                content: { type: "text", text: message },
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
            })

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
