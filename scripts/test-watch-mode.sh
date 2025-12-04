#!/bin/bash

# Watch Mode 功能測試腳本
# 用於驗證 watch mode 是否正常運作

set -e

echo "=== Watch Mode 功能測試 ==="
echo ""

# 設定變數
PROMPTS_REPO="${PROMPTS_REPO:-/Users/carl/Dev/Carl/prompts-repo}"
LOG_FILE="./watch-mode-test.log"
TEST_FILE="$PROMPTS_REPO/laravel/refactor-controller.yaml"

# 檢查測試檔案是否存在
if [ ! -f "$TEST_FILE" ]; then
    echo "❌ 測試檔案不存在: $TEST_FILE"
    echo "   請設定 PROMPTS_REPO 環境變數指向您的 prompts repository"
    exit 1
fi

echo "1. 準備測試環境"
echo "   Prompts Repo: $PROMPTS_REPO"
echo "   測試檔案: $TEST_FILE"
echo "   日誌檔案: $LOG_FILE"
echo ""

# 備份原始檔案
echo "2. 備份測試檔案"
BACKUP_FILE="${TEST_FILE}.backup"
cp "$TEST_FILE" "$BACKUP_FILE"
echo "   ✓ 已備份到: $BACKUP_FILE"
echo ""

# 啟動 server
echo "3. 啟動 MCP Server（背景執行）..."
cd /Users/carl/Dev/Carl/mcp-prompt-manager

WATCH_MODE=true \
PROMPT_REPO_URL="$PROMPTS_REPO" \
STORAGE_DIR="$PROMPTS_REPO" \
LOG_LEVEL=debug \
LOG_FILE="$LOG_FILE" \
node dist/index.js > /dev/null 2>&1 &

SERVER_PID=$!
echo "   Server PID: $SERVER_PID"
echo "   等待 5 秒讓 server 完全啟動..."
sleep 5
echo ""

# 檢查啟動訊息
echo "4. 檢查啟動狀態"
if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "   ❌ Server 已停止，請檢查日誌: $LOG_FILE"
    exit 1
fi

if grep -q "Watch mode started successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ Watch mode 已啟動"
else
    echo "   ✗ Watch mode 可能沒有啟動"
    echo "   請檢查日誌: tail -50 $LOG_FILE"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

if grep -q "File watcher started successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ 檔案監聽器已啟動"
else
    echo "   ⚠ 檔案監聽器可能沒有啟動"
fi
echo ""

# 測試 1: 修改檔案
echo "5. 測試 1: 修改檔案內容"
echo "   在檔案末尾加上測試註解..."
ORIGINAL_LINE_COUNT=$(wc -l < "$TEST_FILE")
echo "" >> "$TEST_FILE"
echo "# Watch mode test - $(date +%s)" >> "$TEST_FILE"
sleep 2

# 檢查日誌
if grep -q "File change detected\|Single prompt reloaded successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ 檔案變更已偵測並處理"
    echo "   日誌訊息:"
    grep "File change detected\|Single prompt reloaded successfully" "$LOG_FILE" | tail -2 | sed 's/^/      /'
else
    echo "   ✗ 檔案變更沒有被偵測到"
    echo "   請檢查日誌: tail -20 $LOG_FILE"
fi
echo ""

# 測試 2: 修改 description（應該會更新 tool）
echo "6. 測試 2: 修改 prompt description（驗證 tool 更新）"
# 讀取原始 description
ORIGINAL_DESC=$(grep -A 1 "^description:" "$TEST_FILE" | tail -1)
# 修改 description
sed -i.bak2 "s/^description:.*/description: |\n  Authority tool for Laravel controller refactoring. [TEST $(date +%s)]/" "$TEST_FILE"
sleep 2

if grep -q "Single prompt reloaded successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ Prompt 已重新載入"
    echo "   現在可以在 MCP Inspector 中檢查 tool 的 description 是否已更新"
else
    echo "   ⚠ 沒有看到 reload 訊息（可能使用 debug 級別）"
fi
echo ""

# 測試 3: 新增檔案
echo "7. 測試 3: 新增 prompt 檔案"
NEW_FILE="$PROMPTS_REPO/common/test-watch-mode.yaml"
cat > "$NEW_FILE" << 'EOF'
id: test-watch-mode
title: Test Watch Mode
version: 1.0.0
status: stable
description: |
  This is a test prompt for watch mode verification.
template: |
  This is a test template.
EOF
sleep 2

if grep -q "File added\|Single prompt reloaded successfully" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ 新檔案已偵測並載入"
else
    echo "   ⚠ 沒有看到新增檔案的訊息"
fi
echo ""

# 測試 4: 刪除檔案
echo "8. 測試 4: 刪除 prompt 檔案"
rm "$NEW_FILE"
sleep 2

if grep -q "File deleted\|Prompt removed" "$LOG_FILE" 2>/dev/null; then
    echo "   ✓ 檔案刪除已偵測並處理"
else
    echo "   ⚠ 沒有看到刪除檔案的訊息"
fi
echo ""

# 恢復原始檔案
echo "9. 恢復原始檔案"
mv "$BACKUP_FILE" "$TEST_FILE"
rm -f "${TEST_FILE}.bak2" 2>/dev/null
echo "   ✓ 已恢復"
echo ""

# 停止 server
echo "10. 停止 Server"
kill $SERVER_PID 2>/dev/null
sleep 1
if ps -p $SERVER_PID > /dev/null 2>&1; then
    kill -9 $SERVER_PID 2>/dev/null
    echo "   Server 已強制停止"
else
    echo "   Server 已正常停止"
fi
echo ""

# 總結
echo "=== 測試完成 ==="
echo ""
echo "測試結果摘要："
echo "- 啟動狀態: $(grep -q 'Watch mode started successfully' "$LOG_FILE" && echo '✓ 正常' || echo '✗ 異常')"
echo "- 檔案變更偵測: $(grep -q 'File change detected\|Single prompt reloaded successfully' "$LOG_FILE" && echo '✓ 正常' || echo '✗ 異常')"
echo ""
echo "完整日誌請查看: $LOG_FILE"
echo ""
echo "💡 提示: 要驗證 tool 是否真的更新，請使用 MCP Inspector："
echo "   1. 啟動 MCP Inspector: pnpm run inspector"
echo "   2. 修改 prompt 檔案的 description"
echo "   3. 在 Inspector 中檢查 tool 列表，確認 description 已更新"

