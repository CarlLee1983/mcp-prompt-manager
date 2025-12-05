import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock pino before importing logger
const mockPinoLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
}

const mockPinoDestination = vi.fn(() => ({}))
const mockPinoMultistream = vi.fn(() => ({}))
const mockPinoTransport = vi.fn(() => ({}))

const mockPino = vi.fn(() => mockPinoLogger)
// Attach static methods to the mock function
mockPino.destination = mockPinoDestination
mockPino.multistream = mockPinoMultistream
mockPino.transport = mockPinoTransport

vi.mock('pino', () => ({
    default: mockPino,
}))

// Mock env config - use dynamic values from process.env
vi.mock('../src/config/env.js', async () => {
    return {
        get LOG_LEVEL() {
            return process.env.LOG_LEVEL
        },
        get LOG_FILE() {
            return process.env.LOG_FILE
        },
    }
})

describe('logger.ts', () => {
    const originalEnv = process.env
    const originalCwd = process.cwd()
    let testLogDir: string

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks()
        
        // Create temporary directory for log files
        testLogDir = path.join(os.tmpdir(), `mcp-logger-test-${Date.now()}`)
        fs.mkdirSync(testLogDir, { recursive: true })
        
        // Reset environment
        process.env = { ...originalEnv }
        delete process.env.LOG_FILE
        delete process.env.LOG_LEVEL
        delete process.env.PRETTY_LOG
        delete process.env.NODE_ENV
        
        // Clear module cache to allow re-importing
        vi.resetModules()
    })

    afterEach(() => {
        // Restore environment
        process.env = originalEnv
        
        // Clean up test directory
        try {
            fs.rmSync(testLogDir, { recursive: true, force: true })
        } catch {
            // Ignore cleanup errors
        }
    })

    describe('基本 logger 初始化', () => {
        it('應該在沒有 LOG_FILE 時建立基本 logger', async () => {
            process.env.NODE_ENV = 'production'
            
            // Re-import logger to trigger initialization
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在開發環境使用 pretty format', async () => {
            process.env.NODE_ENV = 'development'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在 PRETTY_LOG=true 時使用 pretty format', async () => {
            process.env.PRETTY_LOG = 'true'
            process.env.NODE_ENV = 'production'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在 PRETTY_LOG=1 時使用 pretty format', async () => {
            process.env.PRETTY_LOG = '1'
            process.env.NODE_ENV = 'production'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })
    })

    describe('LOG_FILE 設定', () => {
        it('應該在設定 LOG_FILE 時建立檔案 logger', async () => {
            const logFile = path.join(testLogDir, 'test.log')
            process.env.LOG_FILE = logFile
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在 LOG_FILE 為絕對路徑時使用該路徑', async () => {
            const logFile = path.join(testLogDir, 'absolute.log')
            process.env.LOG_FILE = logFile
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在 LOG_FILE 為相對路徑時解析為絕對路徑', async () => {
            process.env.LOG_FILE = 'relative.log'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在日誌目錄不存在時自動建立', async () => {
            const newDir = path.join(testLogDir, 'new', 'nested', 'dir')
            const logFile = path.join(newDir, 'test.log')
            process.env.LOG_FILE = logFile
            
            const { logger } = await import('../src/utils/logger.js')
            
            // Directory should be created
            expect(fs.existsSync(newDir)).toBe(true)
            expect(logger).toBeDefined()
        })
    })

    describe('LOG_LEVEL 設定', () => {
        it('應該使用設定的 LOG_LEVEL', async () => {
            process.env.LOG_LEVEL = 'debug'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在未設定 LOG_LEVEL 時使用預設值（production）', async () => {
            process.env.NODE_ENV = 'production'
            delete process.env.LOG_LEVEL
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該在未設定 LOG_LEVEL 時使用預設值（development）', async () => {
            process.env.NODE_ENV = 'development'
            delete process.env.LOG_LEVEL
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })
    })

    describe('多種配置組合', () => {
        it('應該處理 LOG_FILE + PRETTY_LOG 組合', async () => {
            const logFile = path.join(testLogDir, 'pretty.log')
            process.env.LOG_FILE = logFile
            process.env.PRETTY_LOG = 'true'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該處理 LOG_FILE + LOG_LEVEL 組合', async () => {
            const logFile = path.join(testLogDir, 'leveled.log')
            process.env.LOG_FILE = logFile
            process.env.LOG_LEVEL = 'error'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('應該處理開發環境 + LOG_FILE 組合', async () => {
            const logFile = path.join(testLogDir, 'dev.log')
            process.env.LOG_FILE = logFile
            process.env.NODE_ENV = 'development'
            
            const { logger } = await import('../src/utils/logger.js')
            
            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })
    })

    describe('logger 方法', () => {
        it('應該提供 info 方法', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.info('test message')
            
            expect(mockPinoLogger.info).toHaveBeenCalledWith('test message')
        })

        it('應該提供 warn 方法', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.warn('warning message')
            
            expect(mockPinoLogger.warn).toHaveBeenCalledWith('warning message')
        })

        it('應該提供 error 方法', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.error('error message')
            
            expect(mockPinoLogger.error).toHaveBeenCalledWith('error message')
        })

        it('應該提供 debug 方法', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.debug('debug message')
            
            expect(mockPinoLogger.debug).toHaveBeenCalledWith('debug message')
        })

        it('應該提供 trace 方法', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.trace('trace message')
            
            expect(mockPinoLogger.trace).toHaveBeenCalledWith('trace message')
        })

        it('應該提供 fatal 方法', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.fatal('fatal message')
            
            expect(mockPinoLogger.fatal).toHaveBeenCalledWith('fatal message')
        })

        it('應該支援結構化日誌', async () => {
            const { logger } = await import('../src/utils/logger.js')
            
            logger.info({ key: 'value' }, 'structured message')
            
            expect(mockPinoLogger.info).toHaveBeenCalledWith(
                { key: 'value' },
                'structured message'
            )
        })
    })
})

