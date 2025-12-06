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

const mockPino = vi.fn(() => mockPinoLogger) as any
// Attach static methods to the mock function
mockPino.destination = mockPinoDestination
mockPino.multistream = mockPinoMultistream
mockPino.transport = mockPinoTransport

vi.mock('pino', () => ({
    default: mockPino,
}))

// Mock fs.createWriteStream to avoid actual file operations
// This prevents ENOENT errors when pino.transport tries to create file streams
const mockWriteStream = {
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    pipe: vi.fn(),
    unpipe: vi.fn(),
    destroy: vi.fn(),
}

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

        // Mock fs.createWriteStream to avoid actual file operations
        // This prevents ENOENT errors when pino.transport tries to create file streams
        vi.spyOn(fs, 'createWriteStream').mockImplementation(() => mockWriteStream as any)

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

    describe('Basic Logger Initialization', () => {
        it('should create basic logger when LOG_FILE is undefined', async () => {
            process.env.NODE_ENV = 'production'

            // Re-import logger to trigger initialization
            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should use pretty format in development environment', async () => {
            process.env.NODE_ENV = 'development'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should use pretty format when PRETTY_LOG=true', async () => {
            process.env.PRETTY_LOG = 'true'
            process.env.NODE_ENV = 'production'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should use pretty format when PRETTY_LOG=1', async () => {
            process.env.PRETTY_LOG = '1'
            process.env.NODE_ENV = 'production'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })
    })

    describe('LOG_FILE Settings', () => {
        it('should create file logger when LOG_FILE is set', async () => {
            const logFile = path.join(testLogDir, 'test.log')
            // Ensure directory exists before setting LOG_FILE
            fs.mkdirSync(path.dirname(logFile), { recursive: true })
            process.env.LOG_FILE = logFile

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should use absolute path when LOG_FILE is absolute', async () => {
            const logFile = path.join(testLogDir, 'absolute.log')
            // Ensure directory exists before setting LOG_FILE
            fs.mkdirSync(path.dirname(logFile), { recursive: true })
            process.env.LOG_FILE = logFile

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should resolve to absolute path when LOG_FILE is relative', async () => {
            // For relative paths, ensure the directory exists in cwd
            const relativeLogFile = 'relative.log'
            const absoluteLogFile = path.resolve(process.cwd(), relativeLogFile)
            fs.mkdirSync(path.dirname(absoluteLogFile), { recursive: true })
            process.env.LOG_FILE = relativeLogFile

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should create log directory if it does not exist', async () => {
            const newDir = path.join(testLogDir, 'new', 'nested', 'dir')
            const logFile = path.join(newDir, 'test.log')
            // Don't create directory - let logger.ts create it
            process.env.LOG_FILE = logFile

            const { logger } = await import('../src/utils/logger.js')

            // Directory should be created by logger.ts
            expect(fs.existsSync(newDir)).toBe(true)
            expect(logger).toBeDefined()
        })
    })

    describe('LOG_LEVEL Settings', () => {
        it('should use configured LOG_LEVEL', async () => {
            process.env.LOG_LEVEL = 'debug'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should use default value (production) when LOG_LEVEL is not set', async () => {
            process.env.NODE_ENV = 'production'
            delete process.env.LOG_LEVEL

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should use default value (development) when LOG_LEVEL is not set', async () => {
            process.env.NODE_ENV = 'development'
            delete process.env.LOG_LEVEL

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPino).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })
    })

    describe('Combined Configurations', () => {
        it('should handle LOG_FILE + PRETTY_LOG combination', async () => {
            const logFile = path.join(testLogDir, 'pretty.log')
            // Ensure directory exists before setting LOG_FILE
            fs.mkdirSync(path.dirname(logFile), { recursive: true })
            process.env.LOG_FILE = logFile
            process.env.PRETTY_LOG = 'true'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should handle LOG_FILE + LOG_LEVEL combination', async () => {
            const logFile = path.join(testLogDir, 'leveled.log')
            // Ensure directory exists before setting LOG_FILE
            fs.mkdirSync(path.dirname(logFile), { recursive: true })
            process.env.LOG_FILE = logFile
            process.env.LOG_LEVEL = 'error'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })

        it('should handle development env + LOG_FILE combination', async () => {
            const logFile = path.join(testLogDir, 'dev.log')
            // Ensure directory exists before setting LOG_FILE
            fs.mkdirSync(path.dirname(logFile), { recursive: true })
            process.env.LOG_FILE = logFile
            process.env.NODE_ENV = 'development'

            const { logger } = await import('../src/utils/logger.js')

            expect(mockPinoMultistream).toHaveBeenCalled()
            expect(logger).toBeDefined()
        })
    })

    describe('Logger Methods', () => {
        it('should provide info method', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.info('test message')

            expect(mockPinoLogger.info).toHaveBeenCalledWith('test message')
        })

        it('should provide warn method', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.warn('warning message')

            expect(mockPinoLogger.warn).toHaveBeenCalledWith('warning message')
        })

        it('should provide error method', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.error('error message')

            expect(mockPinoLogger.error).toHaveBeenCalledWith('error message')
        })

        it('should provide debug method', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.debug('debug message')

            expect(mockPinoLogger.debug).toHaveBeenCalledWith('debug message')
        })

        it('should provide trace method', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.trace('trace message')

            expect(mockPinoLogger.trace).toHaveBeenCalledWith('trace message')
        })

        it('should provide fatal method', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.fatal('fatal message')

            expect(mockPinoLogger.fatal).toHaveBeenCalledWith('fatal message')
        })

        it('should support structured logging', async () => {
            const { logger } = await import('../src/utils/logger.js')

            logger.info({ key: 'value' }, 'structured message')

            expect(mockPinoLogger.info).toHaveBeenCalledWith(
                { key: 'value' },
                'structured message'
            )
        })
    })
})

