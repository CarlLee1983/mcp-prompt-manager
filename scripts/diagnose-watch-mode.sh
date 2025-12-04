#!/bin/bash

# Watch Mode 診斷腳本
# 用於診斷 watch mode 是否正常運作

set -e

echo "=== Watch Mode 診斷工具 ==="
echo ""

# 設定變數
PROMPTS_REPO="${PROMPTS_REPO:-/Users/carl/Dev/Carl/prompts-repo}"
TEST_FILE="$PROMPTS_REPO/laravel/refactor-controller.yaml"

echo "1. 檢查檔案是否存在"
if [ ! -f "$TEST_FILE" ]; then
    echo "   ❌ 測試檔案不存在: $TEST_FILE"
    exit 1
fi
echo "   ✓ 測試檔案存在: $TEST_FILE"
echo ""

echo "2. 檢查檔案權限"
if [ ! -r "$TEST_FILE" ]; then
    echo "   ❌ 檔案不可讀取"
    exit 1
fi
if [ ! -w "$TEST_FILE" ]; then
    echo "   ❌ 檔案不可寫入"
    exit 1
fi
echo "   ✓ 檔案權限正常"
echo ""

echo "3. 檢查檔案格式"
if ! grep -q "^description:" "$TEST_FILE"; then
    echo "   ❌ 檔案中沒有找到 description 欄位"
    exit 1
fi
echo "   ✓ 檔案格式正常"
echo ""

echo "4. 讀取當前 description"
CURRENT_DESC=$(grep -A 5 "^description:" "$TEST_FILE" | head -6 | tail -5 | sed 's/^  //' | head -1)
echo "   當前 description 開頭: ${CURRENT_DESC:0:50}..."
echo ""

echo "5. 測試檔案修改"
echo "   在檔案末尾加上測試標記..."
echo "" >> "$TEST_FILE"
echo "# Watch mode test - $(date +%s)" >> "$TEST_FILE"
sleep 1
echo "   ✓ 檔案已修改"
echo ""

echo "6. 檢查檔案是否真的被修改"
if ! tail -1 "$TEST_FILE" | grep -q "Watch mode test"; then
    echo "   ❌ 檔案修改失敗"
    exit 1
fi
echo "   ✓ 檔案修改確認"
echo ""

echo "7. 診斷建議"
echo ""
echo "   如果 watch mode 沒有作用，請檢查："
echo ""
echo "   a) Server 是否以 WATCH_MODE=true 啟動？"
echo "      WATCH_MODE=true node dist/index.js"
echo ""
echo "   b) 是否看到啟動訊息？"
echo "      - 'Watch mode enabled, starting file watchers and Git polling'"
echo "      - 'File watcher started successfully'"
echo ""
echo "   c) 修改檔案後是否看到以下訊息？"
echo "      - 'File changed, triggering reload'"
echo "      - 'File change detected, reloading single prompt'"
echo "      - 'Single prompt reloaded successfully - tool updated'"
echo ""
echo "   d) 如果沒有看到訊息，請："
echo "      - 設定 LOG_FILE=./watch-mode.log 查看完整日誌"
echo "      - 或設定 NODE_ENV=development 啟用格式化輸出"
echo ""
echo "   e) 即使看到 'reload successfully'，MCP 客戶端可能需要："
echo "      - 重新連線到 MCP Server"
echo "      - 或重新查詢 tool 列表（在 MCP Inspector 中重新整理）"
echo ""

# 清理測試標記
echo "8. 清理測試標記"
sed -i.bak '/^# Watch mode test/d' "$TEST_FILE" 2>/dev/null || true
sed -i.bak '/^$/N;/^\n$/d' "$TEST_FILE" 2>/dev/null || true
rm -f "${TEST_FILE}.bak" 2>/dev/null || true
echo "   ✓ 已清理"
echo ""

echo "=== 診斷完成 ==="

