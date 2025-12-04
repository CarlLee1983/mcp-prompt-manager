# 熱重載功能測試指南

本指南說明如何測試熱重載（Watch Mode）功能，包括 LocalSource 檔案監聽和 GitSource polling 機制。

> **重要提示**: Watch mode 的關鍵啟動訊息使用 `warn` 級別，即使沒有設定 `LOG_FILE` 也能在 stderr 看到。如果沒有看到這些訊息，watch mode 可能沒有正常啟動。

## ⚡ 快速驗證（30 秒）

想要快速確認 watch mode 是否有作用？執行以下步驟：

### 步驟 1: 啟動 Server

```bash
cd /Users/carl/Dev/Carl/mcp-prompt-manager
WATCH_MODE=true \
PROMPT_REPO_URL=/Users/carl/Dev/Carl/prompts-repo \
STORAGE_DIR=/Users/carl/Dev/Carl/prompts-repo \
LOG_FILE=./watch-mode.log \
node dist/index.js &
```

### 步驟 2: 確認啟動訊息

應該看到以下 `warn` 級別訊息：
- ✅ `Watch mode enabled, starting file watchers and Git polling`
- ✅ `Watch mode started successfully`
- ✅ `File watcher started successfully`（LocalSource）

### 步驟 3: 實際測試（最重要）

在另一個終端機執行：

```bash
# 修改一個 prompt 檔案
echo " " >> /Users/carl/Dev/Carl/prompts-repo/laravel/refactor-controller.yaml

# 查看日誌（應該看到 reload 訊息）
tail -20 ./watch-mode.log | grep -E "File change|reload|successfully"
```

### 步驟 4: 驗證 Tool 更新（最可靠）

使用 MCP Inspector 驗證：

```bash
# 啟動 Inspector
cd /Users/carl/Dev/Carl/mcp-prompt-manager
pnpm run inspector
```

1. 在 Inspector 中查看 `refactor-controller` tool 的 description
2. 修改 `/Users/carl/Dev/Carl/prompts-repo/laravel/refactor-controller.yaml` 的 `description` 欄位
3. 在 Inspector 中重新查看，確認 description 已更新

**如果 tool 的 description 更新了，watch mode 就正常運作！**

---

或者使用自動化測試腳本：

```bash
cd /Users/carl/Dev/Carl/mcp-prompt-manager
./scripts/test-watch-mode.sh
```

## 📋 前置準備

### 1. 安裝依賴

```bash
cd mcp-prompt-manager
pnpm install
```

### 2. 編譯程式碼

```bash
pnpm run build
```

### 3. 改善日誌可讀性（可選）

**方法 1: 使用 PRETTY_LOG 環境變數（推薦）**

```bash
PRETTY_LOG=true \
WATCH_MODE=true \
PROMPT_REPO_URL=/path/to/your/prompts-repo \
STORAGE_DIR=/path/to/your/prompts-repo \
LOG_FILE=./watch-mode.log \
node dist/index.js
```

這會讓日誌以易讀的格式輸出（即使設定了 LOG_FILE）。

**方法 2: 使用 NODE_ENV=development**

```bash
NODE_ENV=development \
WATCH_MODE=true \
PROMPT_REPO_URL=/path/to/your/prompts-repo \
STORAGE_DIR=/path/to/your/prompts-repo \
node dist/index.js
```

這會自動啟用格式化輸出（但不會輸出到檔案）。

**方法 3: 格式化現有的日誌檔案**

如果已經有 JSON 格式的日誌檔案，可以使用腳本格式化：

```bash
./scripts/pretty-log.sh ./watch-mode.log
```

或使用 pino-pretty 直接查看：

```bash
tail -f ./watch-mode.log | pino-pretty
```

## 🧪 測試場景

### 場景 1: 測試 LocalSource 檔案監聽

#### 步驟 1: 準備測試環境

1. 確保您有一個本地 prompts repository（例如 `~/prompts-repo` 或 `/path/to/your/prompts-repo`）

2. 建立測試用的 `.env` 檔案：

```bash
# .env
PROMPT_REPO_URL=/path/to/your/prompts-repo
STORAGE_DIR=/path/to/your/prompts-repo  # 使用 direct read mode
WATCH_MODE=true
MCP_GROUPS=common
LOG_LEVEL=debug
```

> **注意**: 
> - 將 `/path/to/your/prompts-repo` 替換為您實際的 prompts repository 路徑
> - 設定 `STORAGE_DIR` 與 `PROMPT_REPO_URL` 相同，這樣會啟用 direct read mode，檔案監聽會直接監聽 source 目錄
> - 也可以使用相對路徑，例如 `./prompts-repo`（相對於執行目錄）

#### 步驟 2: 啟動 MCP Server

```bash
pnpm run inspector:dev
```

或直接執行（請替換為您的實際路徑）：

```bash
# 方案 1: 將日誌輸出到檔案（推薦，可以看到所有日誌）
WATCH_MODE=true \
PROMPT_REPO_URL=/path/to/your/prompts-repo \
STORAGE_DIR=/path/to/your/prompts-repo \
LOG_LEVEL=debug \
LOG_FILE=./watch-mode.log \
node dist/index.js

# 在另一個終端機監控日誌
tail -f ./watch-mode.log
```

```bash
# 方案 2: 使用 development 模式（會使用 pino-pretty 格式化輸出）
NODE_ENV=development \
WATCH_MODE=true \
PROMPT_REPO_URL=/path/to/your/prompts-repo \
STORAGE_DIR=/path/to/your/prompts-repo \
LOG_LEVEL=debug \
node dist/index.js
```

> **注意**: MCP Server 使用 stdio transport，stdout 用於協議通訊，所以日誌只輸出到 stderr。如果沒有設定 `LOG_FILE` 或 `NODE_ENV=development`，只有 `warn`/`error`/`fatal` 級別的日誌會顯示，`info`/`debug` 級別的日誌不會顯示。

#### 步驟 3: 驗證監聽已啟動

**重要**: 如果使用 `LOG_FILE`，請在另一個終端機執行 `tail -f ./watch-mode.log` 來查看日誌。

在日誌中應該看到以下關鍵訊息（按順序）：

> **注意**: 這些關鍵訊息使用 `warn` 級別，即使沒有設定 `LOG_FILE` 也能在 stderr 看到。

1. **Watch mode 啟動訊息**：
```
{"level":40,"time":...,"msg":"Watch mode enabled, starting file watchers and Git polling"}
{"level":40,"time":...,"msg":"Starting watch mode for repositories"}
```

2. **檔案監聽器啟動訊息**（LocalSource）：
```
{"level":40,"time":...,"msg":"Starting file watcher for local repository","repoPath":"...","storageDir":"...","watchPath":"..."}
{"level":40,"time":...,"msg":"File watcher ready","path":"..."}
{"level":40,"time":...,"msg":"File watcher started successfully","path":"..."}
```

3. **Git Polling 啟動訊息**（GitSource）：
```
{"level":40,"time":...,"msg":"Starting Git polling","repoUrl":"...","branch":"main","interval":300000}
{"level":40,"time":...,"msg":"Initial commit hash recorded","commitHash":"..."}
{"level":40,"time":...,"msg":"Git polling started successfully","interval":300000}
```

4. **完成訊息**：
```
{"level":40,"time":...,"msg":"Watch mode started for all repositories"}
{"level":40,"time":...,"msg":"Watch mode started successfully"}
```

> **提示**: `level:40` 表示 `warn` 級別，這些訊息會輸出到 stderr，即使沒有設定 `LOG_FILE` 也能看到。

> **驗證要點**：
> - 如果看到 "Watch mode started successfully"，表示 watch mode 已啟動
> - 如果看到 "File watcher started successfully" 或 "Git polling started successfully"，表示對應的監聽機制已啟動
> - 如果**沒有看到這些訊息**，即使沒有錯誤，watch mode 也可能沒有正常啟動

#### 步驟 4: 測試檔案變更

**方法 1: 使用測試腳本（推薦）**

```bash
# 執行自動化測試腳本
cd /Users/carl/Dev/Carl/mcp-prompt-manager
./scripts/test-watch-mode.sh
```

這個腳本會自動：
- 檢查 watch mode 是否啟動
- 測試檔案修改、新增、刪除
- 驗證 reload 是否正常運作

**方法 2: 手動測試**

1. **修改現有 prompt 檔案**：
   ```bash
   # 在另一個終端機執行
   echo "# Test change $(date)" >> /path/to/your/prompts-repo/laravel/refactor-controller.yaml
   ```

2. **觀察日誌**（如果使用 LOG_FILE）：
   ```bash
   tail -f ./watch-mode.log
   ```
   
   應該看到類似以下的日誌：
   ```
   {"level":30,"time":...,"msg":"File change detected, reloading single prompt","filePath":"..."}
   {"level":30,"time":...,"msg":"Single prompt reloaded successfully","promptId":"...","filePath":"..."}
   ```

3. **驗證變更生效（最重要）**：
   - **使用 MCP Inspector**：
     ```bash
     # 在另一個終端機
     cd /Users/carl/Dev/Carl/mcp-prompt-manager
     pnpm run inspector
     ```
     - 在 Inspector 中查看 tool 列表
     - 修改 prompt 檔案的 `description`
     - 再次查看 tool 列表，確認 `description` 已更新
   
   - **或使用 Cursor**：
     - 修改 prompt 檔案
     - 在 Cursor 中檢查 tool 是否更新
     - 嘗試呼叫該 tool，確認變更已生效

#### 步驟 5: 測試新增檔案

1. **新增 prompt 檔案**：
   ```bash
   # 在 prompts repository 中新增檔案
   touch common/test-prompt.yaml
   ```

2. **編輯檔案內容**：
   ```yaml
   id: test-prompt
   title: Test Prompt
   description: This is a test prompt
   template: |
     This is a test template.
   ```

3. **觀察日誌**：
   應該看到檔案新增的日誌和 reload 訊息

#### 步驟 6: 測試刪除檔案

1. **刪除 prompt 檔案**：
   ```bash
   rm common/test-prompt.yaml
   ```

2. **觀察日誌**：
   應該看到檔案刪除的日誌和 prompt 移除的訊息

### 場景 2: 測試 GitSource Polling

#### 步驟 1: 準備測試環境

1. 使用 Git repository URL：

```bash
# .env
PROMPT_REPO_URL=https://github.com/your-username/prompts-repo.git
WATCH_MODE=true
GIT_POLLING_INTERVAL=60000  # 1 分鐘（測試用，生產環境建議 5 分鐘）
MCP_GROUPS=common
LOG_LEVEL=debug
```

> **注意**: 將 `your-username/prompts-repo` 替換為您實際的 GitHub repository

#### 步驟 2: 啟動 MCP Server

```bash
# 使用 LOG_FILE 來查看所有日誌
WATCH_MODE=true \
GIT_POLLING_INTERVAL=60000 \
PROMPT_REPO_URL=https://github.com/your-username/prompts-repo.git \
LOG_LEVEL=debug \
LOG_FILE=./watch-mode.log \
node dist/index.js

# 在另一個終端機監控日誌
tail -f ./watch-mode.log
```

#### 步驟 3: 驗證 Polling 已啟動

在日誌中應該看到（這些訊息使用 `warn` 級別，會輸出到 stderr）：

```
{"level":40,"time":...,"msg":"Starting Git polling","repoUrl":"...","branch":"main","interval":60000}
{"level":40,"time":...,"msg":"Initial commit hash recorded","commitHash":"..."}
{"level":40,"time":...,"msg":"Git polling started successfully","interval":60000}
```

#### 步驟 4: 測試遠端更新

1. **在另一個終端機或 Git 客戶端**：
   - 修改 prompts repository 中的檔案
   - Commit 並 push 到遠端

2. **等待 polling 觸發**（最多等待 `GIT_POLLING_INTERVAL` 時間）

3. **觀察日誌**：
   應該看到類似以下的日誌：

```
{"level":30,"time":...,"msg":"Git repository update detected","oldHash":"...","newHash":"...","branch":"main"}
{"level":30,"time":...,"msg":"Git sync successful"}
{"level":30,"time":...,"msg":"Git update detected, reloading all prompts"}
{"level":30,"time":...,"msg":"Starting prompts reload (zero-downtime)"}
{"level":30,"time":...,"msg":"Prompts reload completed (zero-downtime)","loaded":...,"errors":0}
```

#### 步驟 5: 手動觸發 Polling（可選）

如果需要立即測試，可以修改 `GIT_POLLING_INTERVAL` 為較短時間（例如 10000 = 10 秒），或使用 `mcp_reload_prompts` tool 手動觸發。

### 場景 3: 測試錯誤處理

#### 測試單一 Prompt Reload 失敗時的 Fallback

1. **建立一個無效的 prompt 檔案**：
   ```yaml
   id: invalid-prompt
   # 缺少必要的欄位
   ```

2. **修改該檔案**：
   - 監聽應該會觸發
   - 單一 reload 會失敗
   - 應該自動 fallback 到全部 reload

3. **觀察日誌**：
   應該看到 fallback 的警告訊息：

```
{"level":40,"time":...,"msg":"Failed to validate prompt definition",...}
{"level":30,"time":...,"msg":"Falling back to full reload due to validation error","filePath":"..."}
```

## 🔍 驗證檢查清單

### 啟動驗證（必須檢查）

- [ ] 看到 "Watch mode enabled, starting file watchers and Git polling" 訊息
- [ ] 看到 "Watch mode started successfully" 訊息
- [ ] LocalSource: 看到 "File watcher started successfully" 訊息
- [ ] GitSource: 看到 "Git polling started successfully" 訊息
- [ ] **如果沒有看到上述訊息，即使沒有錯誤，watch mode 也可能沒有啟動**

### LocalSource 檔案監聽

- [ ] 監聽成功啟動（日誌中有 "File watcher started successfully"）
- [ ] 修改檔案時觸發 reload（日誌中有 "File change detected" 或 "Single prompt reloaded successfully"）
- [ ] 新增檔案時觸發 reload（日誌中有 "File added, triggering reload"）
- [ ] 刪除檔案時移除 prompt（日誌中有 "File deleted, triggering reload"）
- [ ] Prompt 變更立即生效（無需重啟 Server，可在 MCP Inspector 中驗證）
- [ ] 錯誤處理正常（失敗時 fallback 到全部 reload）

### GitSource Polling

- [ ] Polling 成功啟動（日誌中有 "Git polling started successfully"）
- [ ] 初始 commit hash 已記錄（日誌中有 "Initial commit hash recorded"）
- [ ] 遠端更新被偵測到（日誌中有 "Git repository update detected"）
- [ ] 自動觸發全部 reload（日誌中有 "Git update detected, reloading all prompts"）
- [ ] Prompts 成功重新載入（日誌中有 "Prompts reload completed"）
- [ ] **定期檢查日誌，確認 polling 正在執行（每 GIT_POLLING_INTERVAL 時間會檢查一次）**

### 通用功能

- [ ] Watch mode 可以正常停止（graceful shutdown）
- [ ] 錯誤不會導致 Server 崩潰
- [ ] 日誌記錄完整且清晰

### 功能驗證（實際測試）

- [ ] **修改 prompt 檔案後，在 MCP Inspector 或 Cursor 中檢查 tool 是否更新**
- [ ] **確認變更立即生效，無需重啟 Server**
- [ ] **如果 tool 沒有更新，即使沒有錯誤，watch mode 也可能沒有正常運作**

## 🐛 疑難排解

### 問題 0: 看不到任何日誌輸出

**可能原因**：
- MCP Server 使用 stdio transport，stdout 用於協議通訊
- 如果沒有設定 `LOG_FILE` 或 `NODE_ENV=development`，只有 `warn`/`error`/`fatal` 級別的日誌會顯示
- `info`/`debug` 級別的日誌不會輸出到 stderr（避免被誤認為錯誤）

**解決方法**：
- **方案 1（推薦）**：設定 `LOG_FILE` 環境變數，將日誌輸出到檔案
  ```bash
  LOG_FILE=./watch-mode.log node dist/index.js
  # 在另一個終端機監控
  tail -f ./watch-mode.log
  ```
- **方案 2**：設定 `NODE_ENV=development` 啟用 pino-pretty 格式化輸出
  ```bash
  NODE_ENV=development LOG_LEVEL=debug node dist/index.js
  ```

### 問題 0.5: 如何確認 Watch Mode 真的在運作？

**沒有異常 log 不代表一切正常！** 請確認以下幾點：

1. **檢查啟動日誌**：
   - 必須看到 "Watch mode started successfully"
   - LocalSource 必須看到 "File watcher started successfully"
   - GitSource 必須看到 "Git polling started successfully"

2. **實際測試檔案變更**：
   - 修改一個 prompt 檔案
   - 應該在日誌中看到 "File change detected" 或 "Single prompt reloaded successfully"
   - 如果沒有看到這些訊息，watch mode 可能沒有正常運作

3. **檢查日誌級別**：
   - 確保使用 `LOG_LEVEL=debug` 或 `LOG_FILE` 來查看所有日誌
   - 某些關鍵訊息可能是 `info` 或 `debug` 級別

4. **使用 MCP Inspector 驗證**：
   - 啟動後，修改 prompt 檔案
   - 在 Inspector 中檢查 tool 列表，確認變更已生效
   - 如果 tool 沒有更新，watch mode 可能沒有正常運作

### 問題 1: 檔案監聽沒有啟動

**可能原因**：
- `WATCH_MODE` 環境變數未設定或為 `false`
- 路徑不存在或無法存取

**解決方法**：
- 確認 `WATCH_MODE=true` 已設定
- 檢查路徑是否正確且可存取
- 查看日誌中的錯誤訊息

### 問題 2: 檔案變更沒有觸發 Reload

**可能原因**：
- 檔案不在監聽範圍內（例如在 excluded 目錄中）
- 檔案不是 `.yaml` 或 `.yml` 格式
- chokidar 的穩定性閾值設定過高

**解決方法**：
- 確認檔案路徑和格式正確
- 檢查日誌中是否有相關錯誤
- 嘗試手動觸發 `mcp_reload_prompts` tool

### 問題 3: Git Polling 沒有偵測到更新

**可能原因**：
- Polling interval 設定過長
- Git fetch 失敗
- 網路連線問題

**解決方法**：
- 暫時降低 `GIT_POLLING_INTERVAL` 進行測試
- 檢查 Git 認證和網路連線
- 查看日誌中的 Git 操作錯誤

### 問題 4: 單一 Prompt Reload 失敗

**可能原因**：
- Prompt 檔案格式錯誤
- 缺少必要的 partials
- 模板編譯失敗

**解決方法**：
- 檢查 prompt 檔案格式
- 確認所有依賴的 partials 都存在
- 查看日誌中的詳細錯誤訊息
- 系統會自動 fallback 到全部 reload

## 📊 效能測試

### 測試大量檔案變更

1. 同時修改多個 prompt 檔案
2. 觀察系統是否能正確處理
3. 檢查是否有效能問題

### 測試 Polling 頻率

1. 調整 `GIT_POLLING_INTERVAL` 到不同值
2. 觀察系統資源使用情況
3. 找到適合的平衡點

## 🎯 最佳實踐

1. **開發環境**：使用 LocalSource + Watch Mode，方便快速迭代
2. **生產環境**：使用 GitSource + Polling，確保版本一致性
3. **Polling Interval**：建議設定為 5 分鐘（300000 毫秒），避免過度頻繁的檢查
4. **日誌級別**：開發時使用 `debug`，生產環境使用 `info`

## 📝 測試腳本範例

建立一個簡單的測試腳本 `test-watch-mode.sh`：

```bash
#!/bin/bash

# 設定您的 prompts repository 路徑
PROMPTS_REPO_PATH="${PROMPTS_REPO_PATH:-./prompts-repo}"

# 測試 LocalSource Watch Mode
echo "Testing LocalSource Watch Mode..."
echo "Using prompts repository: $PROMPTS_REPO_PATH"

WATCH_MODE=true \
PROMPT_REPO_URL="$PROMPTS_REPO_PATH" \
STORAGE_DIR="$PROMPTS_REPO_PATH" \
LOG_LEVEL=debug \
node dist/index.js &

SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# 等待伺服器啟動
sleep 5

# 修改測試檔案
echo "Modifying test file..."
echo "# Test change" >> "$PROMPTS_REPO_PATH/common/test.yaml"

# 等待 reload
sleep 3

# 停止伺服器
kill $SERVER_PID
echo "Test completed"
```

執行測試：

```bash
# 使用預設路徑（./prompts-repo）
chmod +x test-watch-mode.sh
./test-watch-mode.sh

# 或指定自訂路徑
PROMPTS_REPO_PATH=/path/to/your/prompts-repo ./test-watch-mode.sh
```

