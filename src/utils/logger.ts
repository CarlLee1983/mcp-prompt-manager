import pino from 'pino'
import { LOG_LEVEL, LOG_FILE } from '../config/env.js'
import fs from 'fs'
import path from 'path'

/**
 * MCP 服務器日誌配置
 * 
 * 注意：MCP 協議使用 stdout 進行通信，因此所有日誌都輸出到 stderr。
 * 為了避免客戶端將正常日誌視為錯誤，我們採用以下策略：
 * 1. stderr 只輸出 warn/error/fatal 級別的日誌（避免被標記為 error）
 * 2. info/debug/trace 級別的日誌只輸出到檔案（如果設定了 LOG_FILE）
 * 3. 如果沒有設定 LOG_FILE，info 級別的日誌完全不輸出（避免誤會）
 * 4. 使用 silent 模式來完全禁用日誌（當 LOG_LEVEL=silent 時）
 */
const logLevel = LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'info' : 'warn')

// stderr 的日誌級別：只輸出 warn/error/fatal，避免 info 被標記為 error
const stderrLogLevel = 'warn'

// 建立 logger 實例
const loggerOptions: pino.LoggerOptions = {
    level: logLevel,
}

// 建立 logger
let logger: pino.Logger

// 如果設定了 LOG_FILE，使用 multistream 分別輸出到 stderr 和檔案
if (LOG_FILE) {
    const logFilePath = path.isAbsolute(LOG_FILE)
        ? LOG_FILE
        : path.resolve(process.cwd(), LOG_FILE)

    // 確保日誌檔案的目錄存在
    const logDir = path.dirname(logFilePath)
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
    }

    // 建立輸出流陣列
    const streams = [
        // stderr 輸出：只輸出 warn/error/fatal（避免 info 被標記為 error）
        {
            level: stderrLogLevel,
            stream: pino.destination(2),
        },
        // 檔案輸出：輸出所有級別的日誌（原始 JSON 格式，方便解析和搜尋）
        {
            level: logLevel,
            stream: fs.createWriteStream(logFilePath, { flags: 'a' }),
        },
    ]

    // 使用 multistream 同時輸出到多個目標
    // 注意：當使用 multistream 時，transport 選項會被忽略
    // 如果需要格式化輸出，可以在客戶端使用工具（如 pino-pretty）來查看檔案
    logger = pino(loggerOptions, pino.multistream(streams))
} else {
    // 沒有設定 LOG_FILE，只輸出 warn/error/fatal 到 stderr
    // info/debug/trace 級別的日誌不輸出（避免被標記為 error）
    loggerOptions.level = stderrLogLevel

    // 只在開發環境中使用 pino-pretty 格式化輸出
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

    // 輸出到 stderr（MCP 協議要求 stdout 用於協議通信）
    logger = pino(loggerOptions, pino.destination(2))
}

export { logger }
