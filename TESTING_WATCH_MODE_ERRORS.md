# Watch Mode 錯誤處理測試指南

本指南說明如何測試 watch mode 在遇到各種錯誤情況時的處理機制。

## 📋 測試場景

### 場景 1: 無效的 YAML 語法

**測試步驟：**

1. 修改一個 prompt 檔案，加入無效的 YAML 語法：

```yaml
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
invalid_field: value
  nested_without_proper_indent: wrong  # 錯誤的縮排
```

2. 儲存檔案

3. **預期行為：**
   - Watch mode 應該偵測到檔案變更
   - 應該看到 YAML 解析錯誤
   - 應該 fallback 到 full reload
   - 日誌應該顯示類似：
     ```
     {"level":40,"msg":"File change detected, reloading single prompt"}
     {"level":50,"msg":"Failed to reload single prompt: YAML parse error"}
     {"level":40,"msg":"Falling back to full reload due to error"}
     ```

### 場景 2: 缺少必要欄位

**測試步驟：**

1. 修改 prompt 檔案，移除 `id` 欄位：

```yaml
# id: refactor-controller  # 註解掉
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
```

2. 儲存檔案

3. **預期行為：**
   - Watch mode 應該偵測到檔案變更
   - 應該看到 "Invalid prompt definition" 錯誤
   - 應該 fallback 到 full reload
   - 日誌應該顯示類似：
     ```
     {"level":40,"msg":"File change detected, reloading single prompt"}
     {"level":50,"msg":"Failed to validate prompt definition: id: Required"}
     {"level":40,"msg":"Falling back to full reload due to validation error"}
     ```

### 場景 3: 無效的 Handlebars Template

**測試步驟：**

1. 修改 prompt 檔案的 `template` 欄位，加入無效的 Handlebars 語法：

```yaml
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
```

2. 儲存檔案

3. **預期行為：**
   - Watch mode 應該偵測到檔案變更
   - 應該看到 "Failed to compile Handlebars template" 錯誤
   - 應該 fallback 到 full reload
   - 日誌應該顯示類似：
     ```
     {"level":40,"msg":"File change detected, reloading single prompt"}
     {"level":50,"msg":"Failed to compile Handlebars template: ..."}
     {"level":40,"msg":"Falling back to full reload due to template compilation error"}
     ```

### 場景 4: 無效的 Args 定義

**測試步驟：**

1. 修改 prompt 檔案的 `args` 欄位，使用無效的 `type`：

```yaml
id: refactor-controller
title: Refactor Controller
version: 1.0.0
status: stable
description: |
  Authority tool for Laravel controller refactoring.
args:
  code:
    type: invalid_type  # 無效的 type（應該是 string, number, 或 boolean）
    description: Laravel controller code to refactor
    required: true
```

2. 儲存檔案

3. **預期行為：**
   - Watch mode 應該偵測到檔案變更
   - 應該看到 "Invalid prompt definition" 錯誤（type 驗證失敗）
   - 應該 fallback 到 full reload
   - 日誌應該顯示類似：
     ```
     {"level":40,"msg":"File change detected, reloading single prompt"}
     {"level":50,"msg":"Failed to validate prompt definition: args.code.type: Invalid enum value"}
     {"level":40,"msg":"Falling back to full reload due to validation error"}
     ```

### 場景 5: 檔案刪除

**測試步驟：**

1. 刪除一個 prompt 檔案：

```bash
rm /path/to/your/prompts-repo/laravel/refactor-controller.yaml
```

2. **預期行為：**
   - Watch mode 應該偵測到檔案刪除
   - 應該移除對應的 tool 和 prompt
   - 日誌應該顯示類似：
     ```
     {"level":30,"msg":"File deleted, removing prompt"}
     {"level":30,"msg":"Prompt removed due to file deletion"}
     ```

## 🧪 使用自動化測試腳本

我們提供了一個自動化測試腳本，可以快速測試各種錯誤情況：

```bash
cd /Users/carl/Dev/Carl/mcp-prompt-manager
./scripts/test-watch-mode-errors.sh
```

腳本會提供選單，讓您選擇要測試的錯誤類型。

## ✅ 驗證要點

測試時，請確認以下幾點：

1. **錯誤偵測：**
   - Watch mode 應該能偵測到檔案變更
   - 應該看到 "File change detected" 或 "File changed, triggering reload" 訊息

2. **錯誤處理：**
   - 應該看到具體的錯誤訊息（不是空的 `error: {}`）
   - 錯誤訊息應該包含足夠的資訊來診斷問題

3. **Fallback 機制：**
   - 當單一 prompt reload 失敗時，應該 fallback 到 full reload
   - Full reload 應該能正常執行（即使有些 prompts 失敗）

4. **持續運作：**
   - Watch mode 在錯誤後應該繼續運作
   - 修正錯誤後，再次修改檔案應該能正常 reload

5. **日誌級別：**
   - 關鍵錯誤應該使用 `warn` 或 `error` 級別（即使沒有 `LOG_FILE` 也能看到）
   - 詳細的錯誤資訊應該包含 `errorMessage`、`errorStack` 等欄位

## 🐛 常見問題

### 問題 1: 錯誤訊息是空的 `error: {}`

**原因：** 錯誤物件沒有正確序列化

**解決方法：** 確保錯誤日誌包含 `errorMessage`、`errorStack` 等欄位

### 問題 2: Fallback 到 Full Reload 後出現 "already registered" 錯誤

**原因：** `reloadPrompts` 嘗試重新註冊已存在的 prompts

**解決方法：** 已在 `loadPrompts` 中加入檢查邏輯，如果 prompt 已註冊，先移除 tool 再重新註冊

### 問題 3: Watch Mode 在錯誤後停止運作

**原因：** 錯誤處理中斷了 watch mode 的運作

**解決方法：** 確保所有錯誤都被正確捕獲，不會中斷 watch mode 的運作

## 📝 測試檢查清單

- [ ] 無效的 YAML 語法能正確偵測並處理
- [ ] 缺少必要欄位能正確偵測並處理
- [ ] 無效的 Handlebars template 能正確偵測並處理
- [ ] 無效的 args 定義能正確偵測並處理
- [ ] 檔案刪除能正確處理
- [ ] 錯誤訊息包含足夠的診斷資訊
- [ ] Fallback 機制正常運作
- [ ] Watch mode 在錯誤後繼續運作
- [ ] 修正錯誤後，再次修改檔案能正常 reload

