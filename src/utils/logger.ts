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
 * 5. Use PRETTY_LOG=true to enable formatted output (even when LOG_FILE is set)
 */
const logLevel = LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'info' : 'warn')

// Check if pretty log is enabled
const prettyLog = process.env.PRETTY_LOG === 'true' || process.env.PRETTY_LOG === '1'

// stderr log level: only output warn/error/fatal, avoid info being marked as error
const stderrLogLevel = 'warn'

// Create logger instance
const loggerOptions: pino.LoggerOptions = {
    level: logLevel,
}

// Create logger
let logger: pino.Logger

// Pretty print options
// Note: customPrettifiers cannot be used with pino.transport (worker thread limitation)
// Error formatting is handled in errorFormatter.ts instead
const prettyOptions = {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    singleLine: false,
    hideObject: false,
    errorLikeObjectKeys: ['err', 'error'],
    messageFormat: '{msg}',
}

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
    const streams: Array<{ level: string; stream: any }> = []

    // stderr output: only output warn/error/fatal (to avoid info being marked as error)
    if (prettyLog || process.env.NODE_ENV === 'development') {
        // Use pretty format for stderr
        streams.push({
            level: stderrLogLevel,
            stream: pino.transport({
                target: 'pino-pretty',
                options: {
                    ...prettyOptions,
                    destination: 2, // stderr
                },
            }),
        })
    } else {
        streams.push({
            level: stderrLogLevel,
            stream: pino.destination(2),
        })
    }

    // File output: output all level logs
    if (prettyLog) {
        // Use pretty format for file too (if PRETTY_LOG is enabled)
        streams.push({
            level: logLevel,
            stream: pino.transport({
                target: 'pino-pretty',
                options: {
                    ...prettyOptions,
                    destination: fs.createWriteStream(logFilePath, { flags: 'a' }),
                },
            }),
        })
    } else {
        // Raw JSON format (convenient for parsing and searching)
        streams.push({
            level: logLevel,
            stream: fs.createWriteStream(logFilePath, { flags: 'a' }),
        })
    }

    // Use multistream to output to multiple targets simultaneously
    logger = pino(loggerOptions, pino.multistream(streams))
} else {
    // LOG_FILE not set, only output warn/error/fatal to stderr
    // info/debug/trace level logs are not output (to avoid being marked as error)
    loggerOptions.level = stderrLogLevel

    // Use pino-pretty for formatted output in development or when PRETTY_LOG is enabled
    if (prettyLog || process.env.NODE_ENV === 'development') {
        loggerOptions.transport = {
            target: 'pino-pretty',
            options: prettyOptions,
        }
    }

    // Output to stderr (MCP protocol requires stdout for protocol communication)
    logger = pino(loggerOptions, pino.destination(2))
}

export { logger }
