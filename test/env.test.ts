import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Mock dotenv 以防止載入 .env 檔案
vi.mock('dotenv', () => ({
    default: {
        config: vi.fn(() => ({})),
    },
}))

// 由於 env.ts 在模組載入時就會執行，我們需要動態 import 來測試不同的配置
// 使用 vi.resetModules() 來清除模組快取

describe('env.ts 配置測試', () => {
    const originalEnv = process.env
    const originalCwd = process.cwd()

    beforeEach(() => {
        // 清除模組快取，讓每個測試都能重新載入模組
        vi.resetModules()
        // 重置環境變數，清除可能從 .env 載入的變數
        process.env = {}
        // 只保留必要的系統環境變數
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

    describe('PROMPT_REPO_URL 驗證', () => {
        it('應該接受有效的 HTTP URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe('https://github.com/user/repo.git')
        })

        it('應該接受有效的 HTTPS URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe('https://github.com/user/repo.git')
        })

        it('應該接受有效的 SSH URL', async () => {
            process.env.PROMPT_REPO_URL = 'git@github.com:user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe('git@github.com:user/repo.git')
        })

        it('應該接受絕對路徑', async () => {
            const absolutePath = os.platform() === 'win32' ? 'C:\\path\\to\\repo' : '/path/to/repo'
            process.env.PROMPT_REPO_URL = absolutePath
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.REPO_URL).toBe(absolutePath)
        })

        it('應該拒絕包含路徑遍歷的 URL', async () => {
            process.env.PROMPT_REPO_URL = '/path/../to/repo'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('應該拒絕包含 null 字元的 URL', async () => {
            process.env.PROMPT_REPO_URL = '/path/to\0/repo'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('應該拒絕相對路徑', async () => {
            process.env.PROMPT_REPO_URL = './path/to/repo'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('應該拒絕空字串', async () => {
            process.env.PROMPT_REPO_URL = ''
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('SYSTEM_REPO_URL 驗證', () => {
        it('應該接受有效的 HTTP URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.SYSTEM_REPO_URL = 'https://github.com/user/system.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.SYSTEM_REPO_URL).toBe('https://github.com/user/system.git')
        })

        it('應該接受絕對路徑', async () => {
            const absolutePath = os.platform() === 'win32' ? 'C:\\path\\to\\system' : '/path/to/system'
            process.env.PROMPT_REPO_URL = os.platform() === 'win32' ? 'C:\\path\\to\\repo' : '/path/to/repo'
            process.env.SYSTEM_REPO_URL = absolutePath
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.SYSTEM_REPO_URL).toBe(absolutePath)
        })

        it('應該拒絕包含路徑遍歷的 URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.SYSTEM_REPO_URL = '/path/../to/system'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })

        it('應該是可選的（undefined）', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.SYSTEM_REPO_URL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.SYSTEM_REPO_URL).toBeUndefined()
        })
    })

    describe('MCP_GROUPS 處理', () => {
        it('應該解析單一群組', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel'])
            expect(env.IS_DEFAULT_GROUPS).toBe(false)
        })

        it('應該解析多個群組', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel,vue,react'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel', 'vue', 'react'])
            expect(env.IS_DEFAULT_GROUPS).toBe(false)
        })

        it('應該處理帶空格的群組名稱', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel, vue , react'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel', 'vue', 'react'])
        })

        it('應該過濾空字串', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel,,vue,'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel', 'vue'])
        })

        it('應該拒絕無效的群組名稱（包含特殊字元）', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel@vue'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow('Invalid group name')
        })

        it('應該接受底線和破折號', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = 'laravel_vue,react-native'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual(['laravel_vue', 'react-native'])
        })

        it('未設定時應該為空陣列', async () => {
            // 明確設定所有必要的環境變數，覆蓋 .env 中的值
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_GROUPS = '' // 空字串會被轉換為 undefined
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.MCP_GROUPS
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.ACTIVE_GROUPS).toEqual([])
            expect(env.IS_DEFAULT_GROUPS).toBe(true)
        })
    })

    describe('TRANSPORT_TYPE', () => {
        it('應該預設為 stdio', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.TRANSPORT_TYPE
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('stdio')
        })

        it('應該接受 stdio', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'stdio'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('stdio')
        })

        it('應該接受 http', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'http'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('http')
        })

        it('應該接受 sse', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'sse'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.TRANSPORT_TYPE).toBe('sse')
        })

        it('應該拒絕無效的 transport type', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.TRANSPORT_TYPE = 'invalid'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('MCP_LANGUAGE', () => {
        it('應該預設為 en', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.MCP_LANGUAGE
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.LANG_SETTING).toBe('en')
            expect(env.LANG_INSTRUCTION).toBe('Please reply in English.')
        })

        it('應該接受 zh', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_LANGUAGE = 'zh'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.LANG_SETTING).toBe('zh')
            expect(env.LANG_INSTRUCTION).toContain('Traditional Chinese')
            expect(env.LANG_INSTRUCTION).toContain('繁體中文')
        })

        it('應該拒絕無效的語言', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.MCP_LANGUAGE = 'ja'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('LOG_LEVEL', () => {
        it('應該預設為 info', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.LOG_LEVEL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.LOG_LEVEL).toBe('info')
        })

        it('應該接受所有有效的 log levels', async () => {
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

        it('應該拒絕無效的 log level', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.LOG_LEVEL = 'invalid'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            await expect(import('../src/config/env.js')).rejects.toThrow()
        })
    })

    describe('數值轉換', () => {
        it('應該轉換 GIT_MAX_RETRIES', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_MAX_RETRIES = '5'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_MAX_RETRIES).toBe(5)
        })

        it('GIT_MAX_RETRIES 應該預設為 3', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_MAX_RETRIES
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_MAX_RETRIES).toBe(3)
        })

        it('應該轉換 CACHE_CLEANUP_INTERVAL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.CACHE_CLEANUP_INTERVAL = '10000'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.CACHE_CLEANUP_INTERVAL).toBe(10000)
        })

        it('CACHE_CLEANUP_INTERVAL 未設定時應該為 undefined', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.CACHE_CLEANUP_INTERVAL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.CACHE_CLEANUP_INTERVAL).toBeUndefined()
        })

        it('應該轉換 GIT_POLLING_INTERVAL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_POLLING_INTERVAL = '600000'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_POLLING_INTERVAL).toBe(600000)
        })

        it('GIT_POLLING_INTERVAL 應該預設為 300000', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_POLLING_INTERVAL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_POLLING_INTERVAL).toBe(300000)
        })
    })

    describe('WATCH_MODE', () => {
        it('應該轉換 "true" 為 true', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.WATCH_MODE = 'true'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(true)
        })

        it('應該轉換 "1" 為 true', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.WATCH_MODE = '1'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(true)
        })

        it('應該轉換其他值為 false', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.WATCH_MODE = 'false'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(false)
        })

        it('未設定時應該為 false', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.WATCH_MODE
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.WATCH_MODE).toBe(false)
        })
    })

    describe('STORAGE_DIR', () => {
        it('應該解析相對路徑為絕對路徑', async () => {
            const testDir = path.join(os.tmpdir(), `test-env-${Date.now()}`)
            // 建立測試目錄
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true })
            }
            // 解析實際路徑（處理 macOS 符號連結）
            const realTestDir = fs.realpathSync(testDir)
            process.chdir(realTestDir)
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.STORAGE_DIR = '.prompts_cache'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            // 解析實際路徑以處理符號連結（路徑可能不存在，所以需要 try-catch）
            const expectedPath = path.resolve(realTestDir, '.prompts_cache')
            let actualPath = env.STORAGE_DIR
            try {
                actualPath = fs.realpathSync(actualPath)
            } catch {
                // 如果路徑不存在，使用原始路徑
            }
            let expectedRealPath = expectedPath
            try {
                expectedRealPath = fs.realpathSync(expectedPath)
            } catch {
                // 如果路徑不存在，使用原始路徑
            }
            // 比較路徑（處理符號連結）
            expect(actualPath).toBe(expectedRealPath)
            
            // 清理
            process.chdir(originalCwd)
            if (fs.existsSync(testDir)) {
                fs.rmdirSync(testDir)
            }
        })

        it('未設定時應該使用預設值', async () => {
            const testDir = path.join(os.tmpdir(), `test-env-${Date.now()}`)
            // 建立測試目錄
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true })
            }
            // 解析實際路徑（處理 macOS 符號連結）
            const realTestDir = fs.realpathSync(testDir)
            process.chdir(realTestDir)
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.STORAGE_DIR
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            // 解析實際路徑以處理符號連結（路徑可能不存在，所以需要 try-catch）
            const expectedPath = path.resolve(realTestDir, '.prompts_cache')
            let actualPath = env.STORAGE_DIR
            try {
                actualPath = fs.realpathSync(actualPath)
            } catch {
                // 如果路徑不存在，使用原始路徑
            }
            let expectedRealPath = expectedPath
            try {
                expectedRealPath = fs.realpathSync(expectedPath)
            } catch {
                // 如果路徑不存在，使用原始路徑
            }
            // 比較路徑（處理符號連結）
            expect(actualPath).toBe(expectedRealPath)
            
            // 清理
            process.chdir(originalCwd)
            if (fs.existsSync(testDir)) {
                fs.rmdirSync(testDir)
            }
        })
    })

    describe('GIT_BRANCH', () => {
        it('應該使用設定的分支', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'develop'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_BRANCH).toBe('develop')
        })

        it('未設定時應該預設為 main', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_BRANCH
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            expect(env.GIT_BRANCH).toBe('main')
        })
    })

    describe('PROMPT_REPO_URLS', () => {
        it('應該接受多個 URL', async () => {
            process.env.PROMPT_REPO_URLS = 'https://github.com/user/repo1.git,https://github.com/user/repo2.git'
            delete process.env.PROMPT_REPO_URL
            // 確保沒有從 .env 載入的 PROMPT_REPO_URL
            if (process.env.PROMPT_REPO_URL) {
                delete process.env.PROMPT_REPO_URL
            }

            const env = await import('../src/config/env.js')
            expect(env.PROMPT_REPO_URLS).toBe('https://github.com/user/repo1.git,https://github.com/user/repo2.git')
        })

        it('PROMPT_REPO_URL 和 PROMPT_REPO_URLS 至少需要一個', async () => {
            delete process.env.PROMPT_REPO_URL
            delete process.env.PROMPT_REPO_URLS
            // 確保沒有從 .env 載入的變數
            if (process.env.PROMPT_REPO_URL) {
                delete process.env.PROMPT_REPO_URL
            }
            if (process.env.PROMPT_REPO_URLS) {
                delete process.env.PROMPT_REPO_URLS
            }

            await expect(import('../src/config/env.js')).rejects.toThrow('Either PROMPT_REPO_URL or PROMPT_REPO_URLS must be provided')
        })
    })

    describe('setActiveRepo 和 getActiveRepo', () => {
        it('應該設定並取得 active repo', async () => {
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

        it('應該使用預設分支當未指定時', async () => {
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

        it('應該拒絕包含路徑遍歷的 URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            expect(() => {
                env.setActiveRepo('/path/../to/repo')
            }).toThrow('Invalid REPO_URL: path traversal detected')
        })

        it('應該拒絕包含 null 字元的 URL', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            expect(() => {
                env.setActiveRepo('/path/to\0/repo')
            }).toThrow('Invalid REPO_URL: path traversal detected')
        })

        it('應該拒絕無效的 URL 格式', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            expect(() => {
                env.setActiveRepo('invalid-url')
            }).toThrow('Invalid REPO_URL: must be a valid URL or absolute path')
        })

        it('未設定時應該返回 null', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            const activeRepo = env.getActiveRepo()
            expect(activeRepo).toBeNull()
        })

        it('應該接受絕對路徑', async () => {
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

    describe('getRepoUrl 和 getGitBranch', () => {
        it('應該優先使用 active repo', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'main'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            env.setActiveRepo('https://github.com/user/active-repo.git', 'develop')
            
            expect(env.getRepoUrl()).toBe('https://github.com/user/active-repo.git')
            expect(env.getGitBranch()).toBe('develop')
        })

        it('未設定 active repo 時應該使用 config', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            process.env.GIT_BRANCH = 'main'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            expect(env.getRepoUrl()).toBe('https://github.com/user/repo.git')
            expect(env.getGitBranch()).toBe('main')
        })

        it('未設定 GIT_BRANCH 時應該預設為 main', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.GIT_BRANCH
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            
            expect(env.getGitBranch()).toBe('main')
        })
    })

    describe('getRepoConfigs', () => {
        it('應該優先使用 PROMPT_REPO_URLS', async () => {
            process.env.PROMPT_REPO_URLS = 'https://github.com/user/repo1.git,https://github.com/user/repo2.git'
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo3.git'
            process.env.GIT_BRANCH = 'main'

            const env = await import('../src/config/env.js')
            const configs = env.getRepoConfigs()
            
            expect(configs.length).toBe(2)
            expect(configs[0].url).toBe('https://github.com/user/repo1.git')
            expect(configs[1].url).toBe('https://github.com/user/repo2.git')
        })

        it('應該回退到 PROMPT_REPO_URL', async () => {
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
        it('應該返回系統倉庫配置', async () => {
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

        it('未設定時應該返回 null', async () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            delete process.env.SYSTEM_REPO_URL
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS

            const env = await import('../src/config/env.js')
            const config = env.getSystemRepoConfig()
            
            expect(config).toBeNull()
        })
    })

    describe('錯誤處理', () => {
        it('應該提供清楚的 Zod 驗證錯誤訊息', async () => {
            process.env.PROMPT_REPO_URL = 'invalid-url'
            process.env.PROMPT_REPO_URLS = undefined
            delete process.env.PROMPT_REPO_URLS
            // 確保沒有從 .env 載入的變數
            if (process.env.PROMPT_REPO_URLS) {
                delete process.env.PROMPT_REPO_URLS
            }

            await expect(import('../src/config/env.js')).rejects.toThrow('Configuration validation failed')
        })

        it('應該處理自訂錯誤', async () => {
            delete process.env.PROMPT_REPO_URL
            delete process.env.PROMPT_REPO_URLS
            // 確保沒有從 .env 載入的變數
            if (process.env.PROMPT_REPO_URL) {
                delete process.env.PROMPT_REPO_URL
            }
            if (process.env.PROMPT_REPO_URLS) {
                delete process.env.PROMPT_REPO_URLS
            }

            await expect(import('../src/config/env.js')).rejects.toThrow('Either PROMPT_REPO_URL or PROMPT_REPO_URLS must be provided')
        })
    })
})

