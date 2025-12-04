#!/bin/bash

# Watch Mode 驗證腳本
# 用於診斷 watch mode 是否正常啟動

echo "=== Watch Mode 診斷工具 ==="
echo ""

# 檢查環境變數
echo "1. 檢查環境變數:"
echo "   WATCH_MODE=${WATCH_MODE:-未設定}"
echo "   PROMPT_REPO_URL=${PROMPT_REPO_URL:-未設定}"
echo "   STORAGE_DIR=${STORAGE_DIR:-未設定}"
echo "   LOG_LEVEL=${LOG_LEVEL:-未設定}"
echo "   LOG_FILE=${LOG_FILE:-未設定}"
echo "   NODE_ENV=${NODE_ENV:-未設定}"
echo ""

# 檢查編譯檔案
if [ ! -f "dist/index.js" ]; then
    echo "❌ 錯誤: dist/index.js 不存在，請先執行 pnpm run build"
    exit 1
fi

# 設定日誌檔案
LOG_FILE="${LOG_FILE:-./watch-mode-verify.log}"
echo "2. 日誌檔案: $LOG_FILE"
echo ""

# 啟動 server（背景執行）
echo "3. 啟動 Server..."
WATCH_MODE=true \
PROMPT_REPO_URL="${PROMPT_REPO_URL:-/Users/carl/Dev/Carl/prompts-repo}" \
STORAGE_DIR="${STORAGE_DIR:-/Users/carl/Dev/Carl/prompts-repo}" \
LOG_LEVEL=debug \
LOG_FILE="$LOG_FILE" \
node dist/index.js > /dev/null 2>&1 &

SERVER_PID=$!
echo "   Server PID: $SERVER_PID"
echo "   等待 5 秒讓 server 啟動..."
sleep 5

# 檢查啟動訊息
echo ""
echo "4. 檢查啟動訊息:"
echo "   --- 日誌內容（最後 50 行）---"
tail -50 "$LOG_FILE" 2>/dev/null | grep -E "Watch mode|file watcher|polling|Starting|started" || echo "   （沒有找到相關訊息）"
echo ""

# 檢查關鍵訊息
echo "5. 驗證關鍵訊息:"
MISSING=0

if grep -q "Watch mode enabled" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ Watch mode enabled 訊息存在"
else
    echo "   ✗ Watch mode enabled 訊息不存在"
    MISSING=$((MISSING + 1))
fi

if grep -q "Watch mode started successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ Watch mode started successfully 訊息存在"
else
    echo "   ✗ Watch mode started successfully 訊息不存在"
    MISSING=$((MISSING + 1))
fi

if grep -q "File watcher started successfully\|Git polling started successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ 檔案監聽器或 Git polling 已啟動"
else
    echo "   ✗ 檔案監聽器或 Git polling 可能沒有啟動"
    MISSING=$((MISSING + 1))
fi

echo ""

# 測試檔案變更
if [ -n "$PROMPT_REPO_URL" ] && [ -d "$PROMPT_REPO_URL" ]; then
    echo "6. 測試檔案變更:"
    TEST_FILE=$(find "$PROMPT_REPO_URL" -name "*.yaml" -type f | head -1)
    if [ -n "$TEST_FILE" ]; then
        echo "   測試檔案: $TEST_FILE"
        echo "   # Test change $(date)" >> "$TEST_FILE"
        sleep 2
        
        if grep -q "File change detected\|Single prompt reloaded successfully" "$LOG_FILE" 2>/dev/null; then
            echo "   ✓ 檔案變更已偵測並處理"
        else
            echo "   ✗ 檔案變更沒有被偵測到"
            MISSING=$((MISSING + 1))
        fi
    else
        echo "   ⚠ 找不到測試檔案"
    fi
else
    echo "6. 跳過檔案變更測試（PROMPT_REPO_URL 未設定或不存在）"
fi

echo ""

# 總結
echo "7. 診斷結果:"
if [ $MISSING -eq 0 ]; then
    echo "   ✅ Watch mode 看起來正常運作"
else
    echo "   ⚠️  發現 $MISSING 個問題，請檢查日誌檔案: $LOG_FILE"
    echo ""
    echo "   建議檢查:"
    echo "   - 是否設定了 LOG_FILE 或 NODE_ENV=development"
    echo "   - WATCH_MODE 環境變數是否正確設定"
    echo "   - PROMPT_REPO_URL 路徑是否正確"
    echo "   - 查看完整日誌: tail -100 $LOG_FILE"
fi

# 清理
echo ""
echo "8. 停止 Server..."
kill $SERVER_PID 2>/dev/null
sleep 1
if ps -p $SERVER_PID > /dev/null 2>&1; then
    kill -9 $SERVER_PID 2>/dev/null
    echo "   Server 已強制停止"
else
    echo "   Server 已正常停止"
fi

echo ""
echo "=== 診斷完成 ==="
echo "完整日誌請查看: $LOG_FILE"

