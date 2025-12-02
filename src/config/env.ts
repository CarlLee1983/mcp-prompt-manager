import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

/**
 * Load environment variables
 * Reads configuration from .env file or system environment variables
 */
// Temporarily suppress stdout output to prevent dotenv from polluting MCP protocol
const originalWrite = process.stdout.write
// @ts-ignore
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
        .min(1, 'PROMPT_REPO_URL is required')
        .refine(
            (url) => {
                // Validate URL format or local path
                // Disallow path traversal attacks
                if (url.includes('..') || url.includes('\0')) {
                    return false
                }
                // Validate that it's a valid URL or absolute path
                try {
                    if (
                        url.startsWith('http://') ||
                        url.startsWith('https://') ||
                        url.startsWith('git@')
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
                    'Invalid REPO_URL: must be a valid URL or absolute path',
            }
        ),
    MCP_LANGUAGE: z.enum(['en', 'zh']).default('en'),
    MCP_GROUPS: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined
            // Validate and clean group names
            const groups = val
                .split(',')
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
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),
    LOG_FILE: z.string().optional(),
    GIT_BRANCH: z.string().optional(),
    GIT_MAX_RETRIES: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 3)),
})

/**
 * Validate group name format
 * Only allows letters, numbers, underscores, and dashes
 * @param group - Group name
 * @returns Whether the format is valid
 * @internal
 */
function validateGroupName(group: string): boolean {
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
                .map((e) => `${e.path.join('.')}: ${e.message}`)
                .join('\n')
            throw new Error(`Configuration validation failed:\n${messages}`)
        }
        throw error
    }
}

// Export configuration
export const config = loadConfig()

// Export computed configuration values
export const REPO_URL = config.PROMPT_REPO_URL
export const STORAGE_DIR = config.STORAGE_DIR
    ? path.resolve(process.cwd(), config.STORAGE_DIR)
    : path.resolve(process.cwd(), '.prompts_cache')
export const LANG_SETTING = config.MCP_LANGUAGE

/**
 * Active prompt groups list
 * When MCP_GROUPS is not set, only the 'common' group is loaded by default
 * Configuration: MCP_GROUPS=laravel,vue,react
 */
export const ACTIVE_GROUPS = config.MCP_GROUPS || ['common']

/**
 * Whether using default groups (when MCP_GROUPS is not set)
 * Used to explicitly indicate in logs whether this is default behavior
 */
export const IS_DEFAULT_GROUPS = !config.MCP_GROUPS

export const LOG_LEVEL = config.LOG_LEVEL
export const LOG_FILE = config.LOG_FILE
export const GIT_BRANCH = config.GIT_BRANCH || 'main'
export const GIT_MAX_RETRIES = config.GIT_MAX_RETRIES

// Language instruction
export const LANG_INSTRUCTION =
    LANG_SETTING === 'zh'
        ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
        : 'Please reply in English.'
