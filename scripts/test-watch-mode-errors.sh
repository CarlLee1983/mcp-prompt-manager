#!/bin/bash

# Watch Mode 錯誤處理測試腳本
# 用於測試 watch mode 在遇到各種錯誤情況時的處理

set -e

echo "=== Watch Mode 錯誤處理測試 ==="
echo ""

# 設定變數
PROMPTS_REPO="${PROMPTS_REPO:-/Users/carl/Dev/Carl/prompts-repo}"
TEST_FILE="$PROMPTS_REPO/laravel/refactor-controller.yaml"
BACKUP_FILE="${TEST_FILE}.backup"

# 檢查測試檔案是否存在
if [ ! -f "$TEST_FILE" ]; then
    echo "❌ 測試檔案不存在: $TEST_FILE"
    exit 1
fi

echo "測試檔案: $TEST_FILE"
echo ""

# 備份原始檔案
echo "1. 備份原始檔案"
cp "$TEST_FILE" "$BACKUP_FILE"
echo "   ✓ 已備份到: $BACKUP_FILE"
echo ""

# 測試案例選單
echo "請選擇要測試的錯誤類型："
echo ""
echo "1. 無效的 YAML 語法（缺少縮排）"
echo "2. 缺少必要欄位（缺少 id）"
echo "3. 無效的 template（Handlebars 語法錯誤）"
echo "4. 無效的 args 定義（type 錯誤）"
echo "5. 恢復原始檔案"
echo "6. 全部測試（依序執行 1-4）"
echo ""
read -p "請輸入選項 (1-6): " choice

case $choice in
    1)
        echo ""
        echo "=== 測試 1: 無效的 YAML 語法 ==="
        echo "在 description 欄位中加入無效的縮排..."
        cat > "$TEST_FILE" << 'EOF'
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
  [INVALID YAML - 缺少縮排]
invalid_field: value
  nested_without_proper_indent: wrong
EOF
        echo "   ✓ 已建立無效的 YAML"
        echo ""
        echo "   預期行為："
        echo "   - Watch mode 應該偵測到檔案變更"
        echo "   - 應該看到 YAML 解析錯誤或驗證錯誤"
        echo "   - 應該 fallback 到 full reload"
        echo ""
        echo "   請觀察日誌輸出，然後按 Enter 繼續..."
        read
        ;;
    2)
        echo ""
        echo "=== 測試 2: 缺少必要欄位 ==="
        echo "移除 id 欄位..."
        cat > "$TEST_FILE" << 'EOF'
# id: refactor-controller  # 註解掉 id
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
EOF
        echo "   ✓ 已移除 id 欄位"
        echo ""
        echo "   預期行為："
        echo "   - Watch mode 應該偵測到檔案變更"
        echo "   - 應該看到 'Invalid prompt definition' 錯誤"
        echo "   - 應該 fallback 到 full reload"
        echo ""
        echo "   請觀察日誌輸出，然後按 Enter 繼續..."
        read
        ;;
    3)
        echo ""
        echo "=== 測試 3: 無效的 Handlebars template ==="
        echo "在 template 中加入無效的 Handlebars 語法..."
        # 讀取原始檔案，只修改 template 部分
        sed -i.bak3 '/^template:/,/^[a-z]/ {
            /^template:/a\
  {{#if invalid_syntax
            /^[a-z]/i\
}}  # 缺少結束標籤
        }' "$TEST_FILE" 2>/dev/null || {
            # 如果 sed 失敗，手動建立
            cat > "$TEST_FILE" << 'EOF'
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
template: |
  {{#if invalid_syntax
  This is an invalid Handlebars template
  # 缺少結束標籤 }}
EOF
        }
        rm -f "${TEST_FILE}.bak3" 2>/dev/null || true
        echo "   ✓ 已建立無效的 Handlebars template"
        echo ""
        echo "   預期行為："
        echo "   - Watch mode 應該偵測到檔案變更"
        echo "   - 應該看到 'Failed to compile Handlebars template' 錯誤"
        echo "   - 應該 fallback 到 full reload"
        echo ""
        echo "   請觀察日誌輸出，然後按 Enter 繼續..."
        read
        ;;
    4)
        echo ""
        echo "=== 測試 4: 無效的 args 定義 ==="
        echo "在 args 中加入無效的 type..."
        cat > "$TEST_FILE" << 'EOF'
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
args:
  code:
    type: invalid_type  # 無效的 type
    description: Laravel controller code to refactor
    required: true
EOF
        echo "   ✓ 已建立無效的 args 定義"
        echo ""
        echo "   預期行為："
        echo "   - Watch mode 應該偵測到檔案變更"
        echo "   - 應該看到 'Invalid prompt definition' 錯誤（type 驗證失敗）"
        echo "   - 應該 fallback 到 full reload"
        echo ""
        echo "   請觀察日誌輸出，然後按 Enter 繼續..."
        read
        ;;
    5)
        echo ""
        echo "=== 恢復原始檔案 ==="
        mv "$BACKUP_FILE" "$TEST_FILE"
        echo "   ✓ 已恢復原始檔案"
        exit 0
        ;;
    6)
        echo ""
        echo "=== 執行全部測試 ==="
        echo ""
        
        # 測試 1
        echo ">>> 測試 1: 無效的 YAML 語法"
        cat > "$TEST_FILE" << 'EOF'
id: refactor-controller
title: Refactor Controller
invalid_yaml: 
  nested_without_proper_indent: wrong
EOF
        echo "   已建立無效的 YAML，等待 3 秒..."
        sleep 3
        echo ""
        
        # 測試 2
        echo ">>> 測試 2: 缺少必要欄位"
        cat > "$TEST_FILE" << 'EOF'
# id: refactor-controller
title: Refactor Controller
description: Test
EOF
        echo "   已移除 id 欄位，等待 3 秒..."
        sleep 3
        echo ""
        
        # 測試 3
        echo ">>> 測試 3: 無效的 Handlebars template"
        cat > "$TEST_FILE" << 'EOF'
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: Test
template: |
  {{#if invalid
  Missing closing tag
EOF
        echo "   已建立無效的 template，等待 3 秒..."
        sleep 3
        echo ""
        
        # 測試 4
        echo ">>> 測試 4: 無效的 args 定義"
        cat > "$TEST_FILE" << 'EOF'
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: Test
args:
  code:
    type: invalid_type
    description: Test
EOF
        echo "   已建立無效的 args，等待 3 秒..."
        sleep 3
        echo ""
        
        echo ">>> 所有測試完成，恢復原始檔案"
        ;;
    *)
        echo "無效的選項"
        exit 1
        ;;
esac

# 恢復原始檔案
echo ""
echo "恢復原始檔案？(y/n)"
read -p "> " restore
if [ "$restore" = "y" ] || [ "$restore" = "Y" ]; then
    mv "$BACKUP_FILE" "$TEST_FILE"
    echo "   ✓ 已恢復原始檔案"
else
    echo "   保留測試檔案，備份在: $BACKUP_FILE"
fi

echo ""
echo "=== 測試完成 ==="
echo ""
echo "💡 提示："
echo "   - 檢查 Server 日誌，確認錯誤處理是否正確"
echo "   - 確認 watch mode 在錯誤後仍能繼續運作"
echo "   - 確認 fallback 到 full reload 的機制正常"

