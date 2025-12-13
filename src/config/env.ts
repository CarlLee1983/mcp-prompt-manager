import { z } from "zod"
import dotenv from "dotenv"
import path from "path"
import os from "os"
import {
    type RepoConfig,
    parseRepoUrls,
    parseSingleRepoUrl,
    sortReposByPriority,
} from "./repoConfig.js"

/**
 * Load environment variables
 * Reads configuration from .env file or system environment variables
 */
// Temporarily suppress stdout output to prevent dotenv from polluting MCP protocol
const originalWrite = process.stdout.write.bind(process.stdout)

process.stdout.write = () => true
dotenv.config()
process.stdout.write = originalWrite

/**
 * Configuration validation schema
 * Uses Zod to validate all environment variables, ensuring type safety and correct format
 */
const ConfigSchema = z.object({
    PROMPT_REPO_URL: z
        .string()
        .min(1, "PROMPT_REPO_URL is required")
        .refine(
            (url) => {
                // Validate URL format or local path
                // Disallow path traversal attacks
                if (url.includes("..") || url.includes("\0")) {
                    return false
                }
                // Validate that it's a valid URL or absolute path
                try {
                    if (
                        url.startsWith("http://") ||
                        url.startsWith("https://") ||
                        url.startsWith("git@")
                    ) {
                        return true
                    }
                    // Local paths must be absolute paths
                    return path.isAbsolute(url)
                } catch {
                    return false
                }
            },
            {
                message:
                    "Invalid REPO_URL: must be a valid URL or absolute path",
            }
        )
        .optional(), // Made optional because PROMPT_REPO_URLS can be used
    PROMPT_REPO_URLS: z
        .string()
        .optional()
        .describe("Multiple repo URLs separated by commas"),
    SYSTEM_REPO_URL: z
        .string()
        .optional()
        .refine(
            (url) => {
                if (!url) return true // Optional
                if (url.includes("..") || url.includes("\0")) {
                    return false
                }
                try {
                    if (
                        url.startsWith("http://") ||
                        url.startsWith("https://") ||
                        url.startsWith("git@")
                    ) {
                        return true
                    }
                    return path.isAbsolute(url)
                } catch {
                    return false
                }
            },
            {
                message:
                    "Invalid SYSTEM_REPO_URL: must be a valid URL or absolute path",
            }
        ),
    TRANSPORT_TYPE: z
        .enum(["stdio", "http", "sse"])
        .default("stdio")
        .describe("Transport type: stdio, http, or sse"),
    MCP_LANGUAGE: z.enum(["en", "zh"]).default("en"),
    MCP_GROUPS: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined
            // Validate and clean group names
            const groups = val
                .split(",")
                .map((g) => g.trim())
                .filter(Boolean)
            // Validate each group name format
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
    LOG_FILE: z.string().optional(),
    GIT_BRANCH: z.string().optional(),
    GIT_MAX_RETRIES: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 3)),
    CACHE_CLEANUP_INTERVAL: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined)),
    CACHE_PROVIDER: z
        .enum(["local", "redis"])
        .default("local")
        .describe("Cache provider: local or redis"),
    CACHE_MAX_SIZE: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1000)),
    CACHE_TTL: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined)),
    WATCH_MODE: z
        .string()
        .optional()
        .transform((val) => val === "true" || val === "1"),
    GIT_POLLING_INTERVAL: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 300000)),
})

/**
 * Validate group name format
 * Only allows letters, numbers, underscores, and dashes
 * @param group - Group name
 * @returns Whether the format is valid
 * @internal
 */
function _validateGroupName(group: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(group)
}

/**
 * Load and validate configuration
 * Reads configuration from environment variables and validates using Zod schema
 * @returns Validated configuration object
 * @throws {Error} When configuration validation fails, includes detailed error message
 */
function loadConfig() {
    try {
        const rawConfig = {
            PROMPT_REPO_URL: process.env.PROMPT_REPO_URL,
            PROMPT_REPO_URLS: process.env.PROMPT_REPO_URLS,
            SYSTEM_REPO_URL: process.env.SYSTEM_REPO_URL,
            TRANSPORT_TYPE: process.env.TRANSPORT_TYPE,
            MCP_LANGUAGE: process.env.MCP_LANGUAGE,
            MCP_GROUPS: process.env.MCP_GROUPS,
            STORAGE_DIR: process.env.STORAGE_DIR,
            LOG_LEVEL: process.env.LOG_LEVEL,
            GIT_BRANCH: process.env.GIT_BRANCH,
            GIT_MAX_RETRIES: process.env.GIT_MAX_RETRIES,
            CACHE_CLEANUP_INTERVAL: process.env.CACHE_CLEANUP_INTERVAL,
            CACHE_PROVIDER: process.env.CACHE_PROVIDER,
            CACHE_MAX_SIZE: process.env.CACHE_MAX_SIZE,
            CACHE_TTL: process.env.CACHE_TTL,
            WATCH_MODE: process.env.WATCH_MODE,
            GIT_POLLING_INTERVAL: process.env.GIT_POLLING_INTERVAL,
        }

        const parsed = ConfigSchema.parse(rawConfig)

        // Note: Validation of PROMPT_REPO_URL/PROMPT_REPO_URLS is deferred to getRepoConfigs()
        // to allow module loading in test environments or when using dynamic repo switching

        return parsed
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

// Export configuration
export const config = loadConfig()

// Dynamic Repo settings (in-memory variables)
let ACTIVE_REPO_URL: string | null = null
let ACTIVE_REPO_BRANCH: string | null = null

/**
 * Set dynamic Repo URL and Branch
 * @param url - Repository URL
 * @param branch - Branch name (optional)
 */
export function setActiveRepo(url: string, branch?: string): void {
    // Validate URL format
    if (url.includes("..") || url.includes("\0")) {
        throw new Error("Invalid REPO_URL: path traversal detected")
    }

    // Validate URL format or absolute path
    const isValidUrl =
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("git@") ||
        path.isAbsolute(url)

    if (!isValidUrl) {
        throw new Error(
            "Invalid REPO_URL: must be a valid URL or absolute path"
        )
    }

    ACTIVE_REPO_URL = url
    ACTIVE_REPO_BRANCH = branch ?? null
}

/**
 * Get current active Repo settings
 * @returns Object containing url and branch, or null if not set
 */
export function getActiveRepo(): { url: string; branch: string } | null {
    if (ACTIVE_REPO_URL === null) {
        return null
    }

    return {
        url: ACTIVE_REPO_URL,
        branch: ACTIVE_REPO_BRANCH || config.GIT_BRANCH || "main",
    }
}

// Export computed configuration values
// REPO_URL and GIT_BRANCH now prioritize dynamic settings
export function getRepoUrl(): string {
    const activeRepo = getActiveRepo()
    return activeRepo?.url ?? config.PROMPT_REPO_URL ?? ""
}

export function getGitBranch(): string {
    const activeRepo = getActiveRepo()
    return activeRepo?.branch ?? config.GIT_BRANCH ?? "main"
}

// For backward compatibility, keep REPO_URL and GIT_BRANCH as getters
// Note: These values are calculated at module load time and won't update dynamically
// Please use getRepoUrl() and getGitBranch() to get the latest values
export const REPO_URL = config.PROMPT_REPO_URL
// STORAGE_DIR: Use ~/.cache/mcp-prompt-manager by default to avoid polluting project directories
// Can be overridden via STORAGE_DIR environment variable
export const STORAGE_DIR = config.STORAGE_DIR
    ? path.isAbsolute(config.STORAGE_DIR)
        ? config.STORAGE_DIR
        : path.resolve(process.cwd(), config.STORAGE_DIR)
    : path.join(os.homedir(), ".cache", "mcp-prompt-manager")
export const LANG_SETTING = config.MCP_LANGUAGE

/**
 * Active prompt groups list
 * When MCP_GROUPS is not set, no groups are loaded by default (common is now optional)
 * Configuration: MCP_GROUPS=laravel,vue,react
 * Note: common group is no longer automatically loaded. Use SYSTEM_REPO_URL to provide common group.
 */
export const ACTIVE_GROUPS = config.MCP_GROUPS || []

/**
 * Whether using default groups (when MCP_GROUPS is not set)
 * Used to explicitly indicate in logs whether this is default behavior
 */
export const IS_DEFAULT_GROUPS = !config.MCP_GROUPS

export const LOG_LEVEL = config.LOG_LEVEL
export const LOG_FILE = config.LOG_FILE
export const GIT_BRANCH = config.GIT_BRANCH || "main"
export const GIT_MAX_RETRIES = config.GIT_MAX_RETRIES
export const TRANSPORT_TYPE: "stdio" | "http" | "sse" = config.TRANSPORT_TYPE
export const SYSTEM_REPO_URL = config.SYSTEM_REPO_URL || undefined
export const PROMPT_REPO_URLS = config.PROMPT_REPO_URLS || undefined
export const WATCH_MODE = config.WATCH_MODE || false
export const GIT_POLLING_INTERVAL = config.GIT_POLLING_INTERVAL || 300000

/**
 * Cache cleanup interval in milliseconds
 * Defaults to CACHE_TTL * 2 (10 seconds) if not specified
 * This ensures expired cache entries are cleaned up regularly
 */
export const CACHE_CLEANUP_INTERVAL = config.CACHE_CLEANUP_INTERVAL

// Language instruction
export const LANG_INSTRUCTION =
    LANG_SETTING === "zh"
        ? "Please reply in Traditional Chinese (繁體中文). Keep technical terms in English."
        : "Please reply in English."

/**
 * Get all configured repo URLs (including backward compatibility)
 * @returns Array of Repo configurations, sorted by priority
 */
export function getRepoConfigs(): RepoConfig[] {
    const configs: RepoConfig[] = []

    // Prefer PROMPT_REPO_URLS (multiple repos)
    if (PROMPT_REPO_URLS) {
        const parsed = parseRepoUrls(PROMPT_REPO_URLS)
        configs.push(...parsed)
    }

    // Backward compatibility: if no PROMPT_REPO_URLS, use PROMPT_REPO_URL
    if (configs.length === 0 && config.PROMPT_REPO_URL) {
        configs.push(parseSingleRepoUrl(config.PROMPT_REPO_URL, GIT_BRANCH))
    }

    // Validation: at least one of PROMPT_REPO_URL or PROMPT_REPO_URLS must be provided
    // This is checked when actually using the config, not at module load time
    if (configs.length === 0) {
        throw new Error(
            "Either PROMPT_REPO_URL or PROMPT_REPO_URLS must be provided"
        )
    }

    return sortReposByPriority(configs)
}

/**
 * Get System Repo configuration (if available)
 * @returns System Repo configuration or null
 */
export function getSystemRepoConfig(): RepoConfig | null {
    if (!SYSTEM_REPO_URL) {
        return null
    }

    return parseSingleRepoUrl(SYSTEM_REPO_URL, GIT_BRANCH)
}
