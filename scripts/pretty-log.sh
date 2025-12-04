#!/bin/bash

# 格式化日誌檔案腳本
# 使用 pino-pretty 將 JSON 格式的日誌轉換為易讀的格式

LOG_FILE="${1:-./watch-mode.log}"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ 日誌檔案不存在: $LOG_FILE"
    echo ""
    echo "使用方法:"
    echo "  ./scripts/pretty-log.sh [日誌檔案路徑]"
    echo ""
    echo "範例:"
    echo "  ./scripts/pretty-log.sh ./watch-mode.log"
    echo "  ./scripts/pretty-log.sh /path/to/logs/server.log"
    exit 1
fi

echo "正在格式化日誌檔案: $LOG_FILE"
echo ""

# 使用 pino-pretty 格式化日誌
if command -v pino-pretty &> /dev/null; then
    cat "$LOG_FILE" | pino-pretty --colorize --translateTime 'SYS:standard' --ignore 'pid,hostname'
elif command -v npx &> /dev/null; then
    cat "$LOG_FILE" | npx pino-pretty --colorize --translateTime 'SYS:standard' --ignore 'pid,hostname'
else
    echo "❌ 找不到 pino-pretty，請安裝："
    echo "   npm install -g pino-pretty"
    echo "   或"
    echo "   pnpm add -g pino-pretty"
    exit 1
fi

