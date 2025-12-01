import { z } from "zod"
import dotenv from "dotenv"
import path from "path"

/**
 * 載入環境變數
 * 從 .env 檔案或系統環境變數中讀取配置
 */
// 暫時抑制 stdout 輸出以防止 dotenv 污染 MCP 協議
const originalWrite = process.stdout.write
// @ts-ignore
process.stdout.write = () => true
dotenv.config()
process.stdout.write = originalWrite

/**
 * 配置驗證 Schema
 * 使用 Zod 驗證所有環境變數，確保類型安全和格式正確
 */
const ConfigSchema = z.object({
    PROMPT_REPO_URL: z
        .string()
        .min(1, "PROMPT_REPO_URL is required")
        .refine(
            (url) => {
                // 驗證 URL 格式或本地路徑
                // 不允許路徑遍歷攻擊
                if (url.includes("..") || url.includes("\0")) {
                    return false
                }
                // 驗證是有效的 URL 或絕對路徑
                try {
                    if (
                        url.startsWith("http://") ||
                        url.startsWith("https://") ||
                        url.startsWith("git@")
                    ) {
                        return true
                    }
                    // 本地路徑必須是絕對路徑
                    return path.isAbsolute(url)
                } catch {
                    return false
                }
            },
            {
                message:
                    "Invalid REPO_URL: must be a valid URL or absolute path",
            }
        ),
    MCP_LANGUAGE: z.enum(["en", "zh"]).default("en"),
    MCP_GROUPS: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined
            // 驗證並清理群組名稱
            const groups = val
                .split(",")
                .map((g) => g.trim())
                .filter(Boolean)
            // 驗證每個群組名稱格式
            const groupNamePattern = /^[a-zA-Z0-9_-]+$/
            for (const group of groups) {
                if (!groupNamePattern.test(group)) {
                    throw new Error(
                        `Invalid group name: ${group}. Only alphanumeric, underscore, and dash are allowed.`
                    )
                }
            }
            return groups
        }),
    STORAGE_DIR: z.string().optional(),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace"])
        .default("info"),
    GIT_BRANCH: z.string().optional(),
    GIT_MAX_RETRIES: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 3)),
})

/**
 * 驗證群組名稱格式
 * 只允許字母、數字、下劃線和破折號
 * @param group - 群組名稱
 * @returns 是否為有效格式
 * @internal
 */
function validateGroupName(group: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(group)
}

/**
 * 載入並驗證配置
 * 從環境變數讀取配置並使用 Zod Schema 驗證
 * @returns 驗證後的配置物件
 * @throws {Error} 當配置驗證失敗時，包含詳細的錯誤訊息
 */
function loadConfig() {
    try {
        const rawConfig = {
            PROMPT_REPO_URL: process.env.PROMPT_REPO_URL,
            MCP_LANGUAGE: process.env.MCP_LANGUAGE,
            MCP_GROUPS: process.env.MCP_GROUPS,
            STORAGE_DIR: process.env.STORAGE_DIR,
            LOG_LEVEL: process.env.LOG_LEVEL,
            GIT_BRANCH: process.env.GIT_BRANCH,
            GIT_MAX_RETRIES: process.env.GIT_MAX_RETRIES,
        }

        return ConfigSchema.parse(rawConfig)
    } catch (error) {
        if (error instanceof z.ZodError) {
            const messages = error.issues
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join("\n")
            throw new Error(`Configuration validation failed:\n${messages}`)
        }
        throw error
    }
}

// 導出配置
export const config = loadConfig()

// 導出計算後的配置值
export const REPO_URL = config.PROMPT_REPO_URL
export const STORAGE_DIR = config.STORAGE_DIR
    ? path.resolve(process.cwd(), config.STORAGE_DIR)
    : path.resolve(process.cwd(), ".prompts_cache")
export const LANG_SETTING = config.MCP_LANGUAGE

/**
 * 活躍的 prompt 群組列表
 * 當 MCP_GROUPS 未設定時，預設只載入 common 群組
 * 設定方式：MCP_GROUPS=laravel,vue,react
 */
export const ACTIVE_GROUPS = config.MCP_GROUPS || ["common"]

/**
 * 是否使用預設群組（MCP_GROUPS 未設定時）
 * 用於在日誌中明確標示是否為預設行為
 */
export const IS_DEFAULT_GROUPS = !config.MCP_GROUPS

export const LOG_LEVEL = config.LOG_LEVEL
export const GIT_BRANCH = config.GIT_BRANCH || "main"
export const GIT_MAX_RETRIES = config.GIT_MAX_RETRIES

// 語言指令
export const LANG_INSTRUCTION =
    LANG_SETTING === "zh"
        ? "Please reply in Traditional Chinese (繁體中文). Keep technical terms in English."
        : "Please reply in English."
