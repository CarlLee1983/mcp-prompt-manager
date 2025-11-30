import pino from "pino"

// 建立 logger 實例
const loggerOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || "info",
}

if (process.env.NODE_ENV === "development") {
    loggerOptions.transport = {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
        },
    }
}

export const logger = pino(loggerOptions)
