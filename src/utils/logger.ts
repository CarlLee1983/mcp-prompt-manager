import pino from "pino"

/**
 * MCP 服務器日誌配置
 * 
 * 注意：MCP 協議使用 stdout 進行通信，因此所有日誌都輸出到 stderr。
 * 為了避免客戶端將正常日誌視為錯誤，我們採用以下策略：
 * 1. 在生產環境中，預設只輸出 warn/error/fatal 級別的日誌
 * 2. 在開發環境中，可以通過 LOG_LEVEL 環境變數調整日誌級別
 * 3. 使用 silent 模式來完全禁用日誌（當 LOG_LEVEL=silent 時）
 */
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "development" ? "info" : "warn")

// 建立 logger 實例
const loggerOptions: pino.LoggerOptions = {
    level: logLevel === "silent" ? "silent" : logLevel,
}

// 只在開發環境中使用 pino-pretty 格式化輸出
if (process.env.NODE_ENV === "development" && logLevel !== "silent") {
    loggerOptions.transport = {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
        },
    }
}

// 輸出到 stderr（MCP 協議要求 stdout 用於協議通信）
export const logger = pino(loggerOptions, pino.destination(2))
