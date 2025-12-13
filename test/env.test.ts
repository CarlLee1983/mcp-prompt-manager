import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Mock dotenv to prevent loading .env file
vi.mock('dotenv', () => ({
    default: {
        config: vi.fn(() => ({})),
    },
}))

// Since env.ts executes upon module load, we need dynamic import to test different configurations
// Use vi.resetModules() to clear module cache

describe('env.ts Configuration Tests', () => {
    const originalEnv = process.env
    const originalCwd = process.cwd()

    beforeEach(() => {
        // Clear module cache to allow reloading modules in each test
        vi.resetModules()
        // Reset process.env, clear variables loaded from .env
        process.env = {}
        // Only keep necessary system environment variables
        for (const key in originalEnv) {
            if (!key.startsWith('PROMPT_') &&
                !key.startsWith('SYSTEM_') &&
                !key.startsWith('MCP_') &&
                !key.startsWith('GIT_') &&
                !key.startsWith('LOG_') &&
                !key.startsWith('TRANSPORT_') &&
                !key.startsWith('STORAGE_') &&
                !key.startsWith('CACHE_') &&
                !key.startsWith('WATCH_')) {
                process.env[key] = originalEnv[key]
            }
        }
    })

    afterEach(() => {
        process.env = originalEnv
        process.chdir(originalCwd)
    })

    describe('PROMPT_REPO_URL Validation', () => {
        it('should accept valid HTTP URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe('https://github.com/user/repo.git')
        })

        it('should accept valid HTTPS URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe('https://github.com/user/repo.git')
        })

        it('should accept valid SSH URL', async () => {
            process.env.PROMPT_REPO_URL = 'git@github.com:user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe('git@github.com:user/repo.git')
        })

        it('should accept absolute path', async () => {
            const absolutePath = os.platform() === 'win32' ? 'C:\\path\\to\\repo' : '/path/to/repo'
            process.env.PROMPT_REPO_URL = absolutePath
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe(absolutePath)
        })

        it('should reject URL with path traversal', async () => {
            process.env.PROMPT_REPO_URL = '/path/../to/repo'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('should reject URL with null character', async () => {
            process.env.PROMPT_REPO_URL = '/path/to\0/repo'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('should reject relative path', async () => {
            process.env.PROMPT_REPO_URL = './path/to/repo'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('should reject empty string', async () => {
            process.env.PROMPT_REPO_URL = ''
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('SYSTEM_REPO_URL Validation', () => {
        it('should accept valid HTTP URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.SYSTEM_REPO_URL = 'https://github.com/user/system.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.SYSTEM_REPO_URL).toBe('https://github.com/user/system.git')
        })

        it('should accept absolute path', async () => {
            const absolutePath = os.platform() === 'win32' ? 'C:\\path\\to\\system' : '/path/to/system'
            process.env.PROMPT_REPO_URL = os.platform() === 'win32' ? 'C:\\path\\to\\repo' : '/path/to/repo'
            process.env.SYSTEM_REPO_URL = absolutePath
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.SYSTEM_REPO_URL).toBe(absolutePath)
        })

        it('should reject URL with path traversal', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.SYSTEM_REPO_URL = '/path/../to/system'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('should be optional (undefined)', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.SYSTEM_REPO_URL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.SYSTEM_REPO_URL).toBeUndefined()
        })
    })

    describe('MCP_GROUPS Handling', () => {
        it('should parse single group', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel'])
            expect(env.IS_DEFAULT_GROUPS).toBe(false)
        })

        it('should parse multiple groups', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel,vue,react'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel', 'vue', 'react'])
            expect(env.IS_DEFAULT_GROUPS).toBe(false)
        })

        it('should handle group names with whitespace', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel, vue , react'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel', 'vue', 'react'])
        })

        it('should filter empty strings', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel,,vue,'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel', 'vue'])
        })

        it('should reject invalid group names (containing special characters)', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel@vue'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow('Invalid group name')
        })

        it('should accept underscores and dashes', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel_vue,react-native'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel_vue', 'react-native'])
        })

        it('should be empty array when not set', async () => {
            // Explicitly set all necessary environment variables, overriding values from .env
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = '' // Empty string will be converted to undefined
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.MCP_GROUPS
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual([])
            expect(env.IS_DEFAULT_GROUPS).toBe(true)
        })
    })

    describe('TRANSPORT_TYPE', () => {
        it('should default to stdio', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.TRANSPORT_TYPE
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('stdio')
        })

        it('should accept stdio', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'stdio'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('stdio')
        })

        it('should accept http', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'http'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('http')
        })

        it('should accept sse', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'sse'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('sse')
        })

        it('should reject invalid transport type', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'invalid'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('MCP_LANGUAGE', () => {
        it('should default to en', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.MCP_LANGUAGE
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.LANG_SETTING).toBe('en')
            expect(env.LANG_INSTRUCTION).toBe('Please reply in English.')
        })

        it('should accept zh', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_LANGUAGE = 'zh'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.LANG_SETTING).toBe('zh')
            expect(env.LANG_INSTRUCTION).toContain('Traditional Chinese')
            expect(env.LANG_INSTRUCTION).toContain('繁體中文')
        })

        it('should reject invalid language', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_LANGUAGE = 'ja'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('LOG_LEVEL', () => {
        it('should default to info', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.LOG_LEVEL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.LOG_LEVEL).toBe('info')
        })

        it('should accept all valid log levels', async () => {
            const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            for (const level of levels) {
                vi.resetModules()
                process.env.LOG_LEVEL = level
                const env = await import('../src/config/env.js')
                expect(env.LOG_LEVEL).toBe(level)
            }
        })

        it('should reject invalid log level', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.LOG_LEVEL = 'invalid'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('Numeric Conversion', () => {
        it('should convert GIT_MAX_RETRIES', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_MAX_RETRIES = '5'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_MAX_RETRIES).toBe(5)
        })

        it('GIT_MAX_RETRIES should default to 3', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_MAX_RETRIES
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_MAX_RETRIES).toBe(3)
        })

        it('should convert CACHE_CLEANUP_INTERVAL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.CACHE_CLEANUP_INTERVAL = '10000'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.CACHE_CLEANUP_INTERVAL).toBe(10000)
        })

        it('CACHE_CLEANUP_INTERVAL should be undefined when not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.CACHE_CLEANUP_INTERVAL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.CACHE_CLEANUP_INTERVAL).toBeUndefined()
        })

        it('should convert GIT_POLLING_INTERVAL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_POLLING_INTERVAL = '600000'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_POLLING_INTERVAL).toBe(600000)
        })

        it('GIT_POLLING_INTERVAL should default to 300000', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_POLLING_INTERVAL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_POLLING_INTERVAL).toBe(300000)
        })
    })

    describe('WATCH_MODE', () => {
        it('should convert "true" to true', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.WATCH_MODE = 'true'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(true)
        })

        it('should convert "1" to true', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.WATCH_MODE = '1'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(true)
        })

        it('should convert other values to false', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.WATCH_MODE = 'false'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(false)
        })

        it('should be false when not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.WATCH_MODE
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(false)
        })
    })

    describe('STORAGE_DIR', () => {
        it('should resolve relative path to absolute path', async () => {
            const testDir = path.join(os.tmpdir(), `test-env-${Date.now()}`)
            // Create test directory
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true })
            }
            // Resolve real path (handle macOS symbolic links)
            const realTestDir = fs.realpathSync(testDir)
            process.chdir(realTestDir)
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.STORAGE_DIR = '.prompts_cache'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            // Resolve real path to handle symbolic links (path might not exist, so try-catch needed)
            const expectedPath = path.resolve(realTestDir, '.prompts_cache')
            let actualPath = env.STORAGE_DIR
            try {
                actualPath = fs.realpathSync(actualPath)
            } catch {
                // If path doesn't exist, use original path
            }
            let expectedRealPath = expectedPath
            try {
                expectedRealPath = fs.realpathSync(expectedPath)
            } catch {
                // If path doesn't exist, use original path
            }
            // Compare paths (handle symbolic links)
            expect(actualPath).toBe(expectedRealPath)

            // Cleanup
            process.chdir(originalCwd)
            if (fs.existsSync(testDir)) {
                fs.rmdirSync(testDir)
            }
        })

        it('should use default value when not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.STORAGE_DIR
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            // Default should be ~/.cache/mcp-prompt-manager
            const expectedPath = path.join(os.homedir(), '.cache', 'mcp-prompt-manager')
            expect(env.STORAGE_DIR).toBe(expectedPath)
        })

        it('should fallback to default when cwd is root directory (common in MCP clients)', async () => {
            // This test simulates the scenario where MCP clients like Claude Desktop
            // launch the server with cwd as root directory '/'
            // We can't actually chdir to '/' in tests, so we test the logic indirectly

            // When STORAGE_DIR is not set, default should be used regardless of cwd
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.STORAGE_DIR
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            const expectedPath = path.join(os.homedir(), '.cache', 'mcp-prompt-manager')
            expect(env.STORAGE_DIR).toBe(expectedPath)

            // The path should never be under root directory
            expect(env.STORAGE_DIR.startsWith('/.prompts_cache')).toBe(false)
            expect(env.STORAGE_DIR.startsWith('/.cache')).toBe(false)
        })

        it('should keep absolute STORAGE_DIR path as-is', async () => {
            const absolutePath = os.platform() === 'win32' ? 'C:\\\\custom\\\\cache' : '/custom/cache'
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.STORAGE_DIR = absolutePath
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.STORAGE_DIR).toBe(absolutePath)
        })
    })

    describe('GIT_BRANCH', () => {
        it('should use configured branch', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'develop'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_BRANCH).toBe('develop')
        })

        it('should default to main when not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_BRANCH
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_BRANCH).toBe('main')
        })
    })

    describe('PROMPT_REPO_URLS', () => {
        it('should accept multiple URLs', async () => {
            process.env.PROMPT_REPO_URLS = 'https://github.com/user/repo1.git,https://github.com/user/repo2.git'
            delete process.env.PROMPT_REPO_URL
            // Ensure no PROMPT_REPO_URL loaded from .env
            if (process.env.PROMPT_REPO_URL) {
                delete process.env.PROMPT_REPO_URL
            }

            const env = await import('../src/config/env.js')
            expect(env.PROMPT_REPO_URLS).toBe('https://github.com/user/repo1.git,https://github.com/user/repo2.git')
        })

        it('At least one of PROMPT_REPO_URL and PROMPT_REPO_URLS is required', async () => {
            delete process.env.PROMPT_REPO_URL
            delete process.env.PROMPT_REPO_URLS
            // Ensure no variables loaded from .env
            if (process.env.PROMPT_REPO_URL) {
                delete process.env.PROMPT_REPO_URL
            }
            if (process.env.PROMPT_REPO_URLS) {
                delete process.env.PROMPT_REPO_URLS
            }

            // Module can load without error, but getRepoConfigs() should throw
            const env = await import('../src/config/env.js')
            expect(() => env.getRepoConfigs()).toThrow('Either PROMPT_REPO_URL or PROMPT_REPO_URLS must be provided')
        })
    })

    describe('setActiveRepo and getActiveRepo', () => {
        it('should set and get active repo', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            env.setActiveRepo('https://github.com/user/new-repo.git', 'develop')
            const activeRepo = env.getActiveRepo()

            expect(activeRepo).not.toBeNull()
            expect(activeRepo?.url).toBe('https://github.com/user/new-repo.git')
            expect(activeRepo?.branch).toBe('develop')
        })

        it('should use default branch when not specified', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'main'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            env.setActiveRepo('https://github.com/user/new-repo.git')
            const activeRepo = env.getActiveRepo()

            expect(activeRepo).not.toBeNull()
            expect(activeRepo?.url).toBe('https://github.com/user/new-repo.git')
            expect(activeRepo?.branch).toBe('main')
        })

        it('should reject URL with path traversal', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            expect(() => {
                env.setActiveRepo('/path/../to/repo')
            }).toThrow('Invalid REPO_URL: path traversal detected')
        })

        it('should reject URL with null character', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            expect(() => {
                env.setActiveRepo('/path/to\0/repo')
            }).toThrow('Invalid REPO_URL: path traversal detected')
        })

        it('should reject invalid URL format', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            expect(() => {
                env.setActiveRepo('invalid-url')
            }).toThrow('Invalid REPO_URL: must be a valid URL or absolute path')
        })

        it('should return null when not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            const activeRepo = env.getActiveRepo()
            expect(activeRepo).toBeNull()
        })

        it('should accept absolute path', async () => {
            const absolutePath = os.platform() === 'win32' ? 'C:\\path\\to\\repo' : '/path/to/repo'
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            env.setActiveRepo(absolutePath, 'develop')
            const activeRepo = env.getActiveRepo()

            expect(activeRepo).not.toBeNull()
            expect(activeRepo?.url).toBe(absolutePath)
        })
    })

    describe('getRepoUrl and getGitBranch', () => {
        it('should prioritize active repo', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'main'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            env.setActiveRepo('https://github.com/user/active-repo.git', 'develop')

            expect(env.getRepoUrl()).toBe('https://github.com/user/active-repo.git')
            expect(env.getGitBranch()).toBe('develop')
        })

        it('should use config when active repo not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'main'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            expect(env.getRepoUrl()).toBe('https://github.com/user/repo.git')
            expect(env.getGitBranch()).toBe('main')
        })

        it('should default to main when GIT_BRANCH not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_BRANCH
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')

            expect(env.getGitBranch()).toBe('main')
        })
    })

    describe('getRepoConfigs', () => {
        it('should prioritize PROMPT_REPO_URLS', async () => {
            process.env.PROMPT_REPO_URLS = 'https://github.com/user/repo1.git,https://github.com/user/repo2.git'
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo3.git'
            process.env.GIT_BRANCH = 'main'

            const env = await import('../src/config/env.js')
            const configs = env.getRepoConfigs()

            expect(configs.length).toBe(2)
            expect(configs[0].url).toBe('https://github.com/user/repo1.git')
            expect(configs[1].url).toBe('https://github.com/user/repo2.git')
        })

        it('should fallback to PROMPT_REPO_URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.PROMPT_REPO_URLS
            process.env.GIT_BRANCH = 'main'

            const env = await import('../src/config/env.js')
            const configs = env.getRepoConfigs()

            expect(configs.length).toBe(1)
            expect(configs[0].url).toBe('https://github.com/user/repo.git')
        })
    })

    describe('getSystemRepoConfig', () => {
        it('should return system repo config', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.SYSTEM_REPO_URL = 'https://github.com/user/system.git'
            process.env.GIT_BRANCH = 'main'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            const config = env.getSystemRepoConfig()

            expect(config).not.toBeNull()
            expect(config?.url).toBe('https://github.com/user/system.git')
        })

        it('should return null when not set', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.SYSTEM_REPO_URL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            const config = env.getSystemRepoConfig()

            expect(config).toBeNull()
        })
    })

    describe('Error Handling', () => {
        it('should provide clear Zod validation error message', async () => {
            process.env.PROMPT_REPO_URL = 'invalid-url'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS
            // Ensure no variables loaded from .env
            if (process.env.PROMPT_REPO_URLS) {
                delete process.env.PROMPT_REPO_URLS
            }

            await expect(import('../src/config/env.js')).rejects.toThrow('Configuration validation failed')
        })

        it('should handle custom errors', async () => {
            delete process.env.PROMPT_REPO_URL
            delete process.env.PROMPT_REPO_URLS
            // Ensure no variables loaded from .env
            if (process.env.PROMPT_REPO_URL) {
                delete process.env.PROMPT_REPO_URL
            }
            if (process.env.PROMPT_REPO_URLS) {
                delete process.env.PROMPT_REPO_URLS
            }

            // Module can load without error, but getRepoConfigs() should throw
            const env = await import('../src/config/env.js')
            expect(() => env.getRepoConfigs()).toThrow('Either PROMPT_REPO_URL or PROMPT_REPO_URLS must be provided')
        })
    })
})

