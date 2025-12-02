import pino from 'pino'
import { LOG_LEVEL, LOG_FILE } from '../config/env.js'
import fs from 'fs'
import path from 'path'

/**
 * MCP server logging configuration
 * 
 * Note: MCP protocol uses stdout for communication, so all logs are output to stderr.
 * To prevent clients from treating normal logs as errors, we adopt the following strategy:
 * 1. stderr only outputs warn/error/fatal level logs (to avoid being marked as error)
 * 2. info/debug/trace level logs only output to file (if LOG_FILE is set)
 * 3. If LOG_FILE is not set, info level logs are not output at all (to avoid confusion)
 * 4. Use silent mode to completely disable logging (when LOG_LEVEL=silent)
 */
const logLevel = LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'info' : 'warn')

// stderr log level: only output warn/error/fatal, avoid info being marked as error
const stderrLogLevel = 'warn'

// Create logger instance
const loggerOptions: pino.LoggerOptions = {
    level: logLevel,
}

// Create logger
let logger: pino.Logger

// If LOG_FILE is set, use multistream to output to stderr and file separately
if (LOG_FILE) {
    const logFilePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE)

    // Ensure log file directory exists
    const logDir = path.dirname(logFilePath)
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
    }

    // Create output stream array
    const streams = [
        // stderr output: only output warn/error/fatal (to avoid info being marked as error)
        {
            level: stderrLogLevel,
            stream: pino.destination(2),
        },
        // File output: output all level logs (raw JSON format, convenient for parsing and searching)
        {
            level: logLevel,
            stream: fs.createWriteStream(logFilePath, { flags: 'a' }),
        },
    ]

    // Use multistream to output to multiple targets simultaneously
    // Note: When using multistream, transport option is ignored
    // If formatted output is needed, use tools (such as pino-pretty) on the client side to view files
    logger = pino(loggerOptions, pino.multistream(streams))
} else {
    // LOG_FILE not set, only output warn/error/fatal to stderr
    // info/debug/trace level logs are not output (to avoid being marked as error)
    loggerOptions.level = stderrLogLevel

    // Only use pino-pretty for formatted output in development environment
    if (process.env.NODE_ENV === 'development') {
        loggerOptions.transport = {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
    }

    // Output to stderr (MCP protocol requires stdout for protocol communication)
    logger = pino(loggerOptions, pino.destination(2))
}

export { logger }
