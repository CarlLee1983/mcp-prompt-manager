# MCP Prompt Manager (Multi-Storage Support)

這是一個支援多種儲存方式的 Model Context Protocol (MCP) Server，專門用於管理和提供 Prompt 模板。它允許你將 Prompts 存儲在不同的位置（GitHub、本地 Git、記憶體、S3），並透過 MCP 協議讓 Cursor、Claude Desktop 等 AI 編輯器直接使用。

## ✨ 特色

- **多種儲存方式**: 支援 GitHub、Local Git、Memory、S3 四種儲存驅動器，可透過 `PROMPT_STORAGE` 環境變數輕鬆切換
- **Git 同步**: Prompts 可直接從指定的 Git Repository 同步（GitHub 模式），確保團隊使用統一的 Prompt 版本
- **S3 支援**: 支援從 AWS S3 讀取 prompts，可選擇 URL 模式（公開 bucket）或 SDK 模式（私有 bucket）
- **Handlebars 模板**: 支援強大的 Handlebars 語法，可以建立動態、可重用的 Prompt 模板
- **Partials 支援**: 支援 Handlebars Partials，方便拆分和重用 Prompt 片段（例如角色設定、輸出格式）
- **本地緩存**: 自動將 Git Repo 內容緩存到本地目錄，提高讀取速度
- **群組過濾**: 支援按群組過濾載入 prompts，只載入需要的部分
- **錯誤處理**: 完整的錯誤統計和報告，確保問題可追蹤
- **重試機制**: Git 操作自動重試，提高可靠性
- **類型安全**: 使用 Zod 驗證配置和 prompt 定義，確保類型安全
- **專業日誌**: 使用 pino 日誌系統，支援結構化日誌和多種日誌級別

## 🚀 快速開始

### 1. 安裝

首先，Clone 本專案並安裝依賴：

```bash
git clone <本專案的 URL>
cd mcp-prompt-manager
npm installLICENSE
# 或使用 pnpm (推薦)
pnpm install
```

### 2. 設定環境變數

複製範例設定檔並建立 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，根據你選擇的儲存方式進行設定：

#### 儲存方式設定

```bash
# 儲存驅動器類型（可選，預設 local）
# 支援: github, local, memory, s3
PROMPT_STORAGE=local
```

#### Local Git Storage (預設)

```bash
PROMPT_STORAGE=local

# 本地 Git repository 路徑（必填）
# 可以是絕對路徑或相對路徑（相對於當前工作目錄）
STORAGE_DIR=/path/to/your/local/git/repo
# 或使用相對路徑
# STORAGE_DIR=./my-prompts

# 如果不設定 STORAGE_DIR，預設使用 .prompts_cache
```

#### GitHub Storage

```bash
PROMPT_STORAGE=github

# Git Repository URL（必填）
# 本地路徑範例
# PROMPT_REPO_URL=/Users/yourname/Desktop/my-local-prompts

# 或遠端 Git URL 範例
PROMPT_REPO_URL=https://github.com/yourusername/my-prompts.git
# PROMPT_REPO_URL=git@github.com:yourusername/my-prompts.git

# 儲存目錄（可選，預設 .prompts_cache）
STORAGE_DIR=.prompts_cache

# Git 分支（可選，預設 main）
GIT_BRANCH=main

# Git 重試次數（可選，預設 3）
GIT_MAX_RETRIES=3
```

#### Memory Storage

```bash
PROMPT_STORAGE=memory

# 不需要額外設定，用於測試或動態載入
```

#### S3 Storage

```bash
PROMPT_STORAGE=s3

# S3 bucket 名稱（必填）
S3_BUCKET_NAME=my-prompts-bucket

# S3 region（可選，預設 us-east-1）
S3_REGION=us-west-2

# 方式一：使用 SDK 模式（支援私有 bucket）
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key

# 方式二：使用 URL 模式（公開 bucket）
# 如果不提供 credentials，會自動使用 URL 模式
# S3_BASE_URL=https://my-prompts-bucket.s3.amazonaws.com

# S3 物件前綴（可選，用於限制掃描範圍）
# S3_PREFIX=prompts/common
```

#### 通用設定

```bash
# 輸出語言設定（可選，預設 en）
MCP_LANGUAGE=en  # 或 zh

# 群組過濾設定（可選，未設定時預設只載入 common 群組）
# 設定範例: MCP_GROUPS="laravel,vue,react"
# 注意：未設定時，系統會在日誌中明確提示使用預設群組
MCP_GROUPS=laravel,vue

# 日誌級別（可選）
# 可選值: fatal, error, warn, info, debug, trace, silent
# 注意：
# - stderr 只輸出 warn/error/fatal 級別的日誌（避免被標記為 error）
# - info/debug/trace 級別的日誌只輸出到檔案（如果設定了 LOG_FILE）
# - 如果沒有設定 LOG_FILE，info 級別的日誌完全不輸出（避免誤會）
# - 生產環境預設為 warn（只輸出警告和錯誤），開發環境預設為 info
# - 設定 silent 可完全禁用日誌輸出
LOG_LEVEL=info

# 日誌檔案路徑（可選，強烈建議設定）
# 設定此變數後，所有級別的日誌都會寫入檔案（JSON 格式）
# stderr 仍然只輸出 warn/error/fatal（避免被標記為 error）
# 可以是絕對路徑或相對路徑（相對於專案根目錄）
# 範例：
# LOG_FILE=/tmp/mcp-prompt-manager.log
# LOG_FILE=logs/mcp.log
# 注意：檔案會以 append 模式寫入，不會覆蓋現有內容
# 建議：設定此變數以便查看完整的日誌（包括 info 級別）
LOG_FILE=logs/mcp.log
```

### 3. 編譯

```bash
npm run build
# 或
pnpm run build
```

## 🛠️ 使用方法

### 使用 Inspector 測試

我們提供了一個方便的指令來啟動 MCP Inspector 進行測試：

#### 基本使用

**重要**: Inspector 執行的是編譯後的 `dist/index.js`，所以如果修改了源碼，需要先編譯：

```bash
# 1. 先編譯（如果修改了源碼）
pnpm run build

# 2. 啟動 Inspector
pnpm run inspector
```

#### 快速開發模式

如果你在開發中，可以使用組合指令，它會自動先編譯再啟動 Inspector：

```bash
pnpm run inspector:dev
```

這會自動執行 `build` 然後啟動 Inspector，確保你測試的是最新編譯的程式碼。

#### Inspector 功能

Inspector 會啟動一個網頁介面，你可以在其中：

- 查看所有已載入的 prompts
- 測試 prompt 的輸出
- 檢查錯誤訊息
- 驗證環境變數設定

### 在 Cursor 中使用

#### 設定檔位置

**macOS:**

```
~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json
```

**Windows:**

```
%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json
```

**Linux:**

```
~/.config/Cursor/User/globalStorage/cursor.mcp/mcp.json
```

#### 設定步驟

1. **找到設定檔**：
    - 方法一：在 Cursor 中按 `Cmd/Ctrl + Shift + P`，搜尋 "MCP: Add server"
    - 方法二：直接編輯上述路徑的 `mcp.json` 檔案

2. **編輯設定檔**：

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "local",
                "STORAGE_DIR": "/Users/yourname/Desktop/my-local-prompts",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

3. **重要設定說明**：
    - `command`: 使用 `node` 執行編譯後的 JavaScript 檔案
    - `args`: 必須是**絕對路徑**指向 `dist/index.js`
    - `env`: 環境變數（可選，如果已在 `.env` 中設定）

4. **驗證設定**：
    - 重啟 Cursor
    - 在 Cursor 中按 `Cmd/Ctrl + Shift + P`，搜尋 "MCP: Show servers"
    - 確認 `mcp-prompt-manager` 顯示為已連接狀態

> **注意**:
>
> - 請將 `/path/to/mcp-prompt-manager` 替換為本專案的實際絕對路徑
> - 如果在 `.env` 中已經設定了環境變數，則 `env` 區塊可以省略，但直接在 JSON 中指定通常更穩健
> - 如果設定檔不存在，需要先建立 `mcp.json` 檔案

### 在 Claude Desktop 中使用

#### 設定檔位置

**macOS:**

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**

```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**

```
~/.config/Claude/claude_desktop_config.json
```

#### 設定步驟

1. **建立或編輯設定檔**：

如果檔案不存在，需要先建立：

```bash
# macOS/Linux
mkdir -p ~/Library/Application\ Support/Claude
touch ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. **編輯設定檔**：

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "github",
                "PROMPT_REPO_URL": "https://github.com/yourusername/my-prompts.git",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

3. **驗證設定**：
    - 完全關閉 Claude Desktop（確保所有視窗都關閉）
    - 重新啟動 Claude Desktop
    - 在對話中，Claude 應該能夠使用你定義的 prompts

> **注意**:
>
> - 設定檔必須是有效的 JSON 格式
> - 路徑必須使用絕對路徑
> - 修改設定檔後必須完全重啟 Claude Desktop

### 在 VS Code 中使用（透過擴充功能）

VS Code 可以透過 MCP 擴充功能來使用 MCP Server。

#### 設定步驟

1. **安裝 MCP 擴充功能**：
    - 在 VS Code 擴充功能市場搜尋 "MCP" 或 "Model Context Protocol"
    - 安裝對應的擴充功能

2. **設定 MCP Server**：
    - 開啟 VS Code 設定（`Cmd/Ctrl + ,`）
    - 搜尋 "MCP" 相關設定
    - 或編輯 `settings.json`：

```json
{
    "mcp.servers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "local",
                "STORAGE_DIR": "/path/to/your/repo",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

### 在 Continue 中使用

Continue 是一個開源的 AI 程式碼助手，支援 MCP。

#### 設定檔位置

**macOS:**

```
~/.continue/config.json
```

**Windows:**

```
%APPDATA%\Continue\config.json
```

**Linux:**

```
~/.config/Continue/config.json
```

#### 設定步驟

編輯 `config.json`：

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "local",
                "STORAGE_DIR": "/path/to/your/repo",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

### 在 Aider 中使用

Aider 是一個 AI 程式碼編輯器，支援 MCP。

#### 設定方式

在 Aider 的設定檔中（通常是 `~/.aider/config.json` 或透過環境變數）：

```json
{
    "mcp_servers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "local",
                "STORAGE_DIR": "/path/to/your/repo"
            }
        }
    }
}
```

### 在自訂應用程式中使用（程式化）

如果你正在開發自己的應用程式並想要整合 MCP Server，可以使用 MCP SDK：

#### TypeScript/JavaScript 範例

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { spawn } from "child_process"

// 建立 MCP Client
const client = new Client(
    {
        name: "my-app",
        version: "1.0.0",
    },
    {
        capabilities: {},
    }
)

// 建立 transport（使用 stdio）
const transport = new StdioClientTransport({
    command: "node",
    args: ["/path/to/mcp-prompt-manager/dist/index.js"],
    env: {
        PROMPT_STORAGE: "local",
        STORAGE_DIR: "/path/to/repo",
        MCP_LANGUAGE: "zh",
    },
})

// 連接
await client.connect(transport)

// 列出可用的 prompts
const prompts = await client.listPrompts()
console.log("Available prompts:", prompts)

// 取得特定 prompt
const prompt = await client.getPrompt({
    name: "code-review",
    arguments: {
        code: "const x = 1",
        language: "TypeScript",
    },
})
```

#### Python 範例

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # 設定 server 參數
    server_params = StdioServerParameters(
        command="node",
        args=["/path/to/mcp-prompt-manager/dist/index.js"],
        env={
        "PROMPT_STORAGE": "local",
        "STORAGE_DIR": "/path/to/repo",
        "MCP_LANGUAGE": "zh"
        }
    )

    # 建立 session
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # 初始化
            await session.initialize()

            # 列出 prompts
            prompts = await session.list_prompts()
            print(f"Available prompts: {prompts}")

            # 取得 prompt
            prompt = await session.get_prompt(
                name="code-review",
                arguments={
                    "code": "const x = 1",
                    "language": "TypeScript"
                }
            )
            print(f"Prompt result: {prompt}")
```

### MCP Client 快速參考

| Client             | 設定檔位置                                                                            | 設定檔格式    | 備註                |
| ------------------ | ------------------------------------------------------------------------------------- | ------------- | ------------------- |
| **Cursor**         | `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json` (macOS) | `mcpServers`  | 支援 UI 設定        |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)             | `mcpServers`  | 需完全重啟          |
| **VS Code**        | `settings.json`                                                                       | `mcp.servers` | 需安裝 MCP 擴充功能 |
| **Continue**       | `~/.continue/config.json`                                                             | `mcpServers`  | 開源 AI 助手        |
| **Aider**          | `~/.aider/config.json`                                                                | `mcp_servers` | AI 程式碼編輯器     |

> **注意**: 路徑中的 `~` 代表使用者主目錄，在不同作業系統中會自動展開為：
>
> - macOS/Linux: `/Users/username` 或 `/home/username`
> - Windows: `C:\Users\username`

### 通用設定格式

所有支援 MCP 的客戶端都遵循相同的設定格式：

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "local",
                "STORAGE_DIR": "/path/to/your/repo",
                "MCP_LANGUAGE": "en",
                "MCP_GROUPS": "common",
                "LOG_LEVEL": "info"
            }
        }
    }
}
```

#### 設定欄位說明

- **`command`**: 執行命令（通常是 `node`）
- **`args`**: 命令參數陣列，必須包含編譯後的 `dist/index.js` 的絕對路徑
- **`env`**: Environment variables object (optional)
    - `PROMPT_STORAGE`: Storage driver type, `github`, `local`, `memory`, `s3` (optional, default `local`)
    - `STORAGE_DIR`: Local storage directory (optional, default `.prompts_cache`, used by local/github types)
    - `PROMPT_REPO_URL`: Git repository URL or local path (required for github storage type)
    - `MCP_LANGUAGE`: Output language, `en` or `zh` (optional, default `en`)
    - `MCP_GROUPS`: Groups to load, comma-separated (optional, defaults to `common` when not set, system will log a hint)
    - `GIT_BRANCH`: Git branch (optional, default `main`, used by github type)
    - `GIT_MAX_RETRIES`: Git retry count (optional, default `3`, used by github type)
    - `S3_BUCKET_NAME`: S3 bucket name (required for s3 storage type)
    - `S3_REGION`: AWS region (optional, default `us-east-1`, used by s3 type)
    - `S3_ACCESS_KEY_ID`: AWS Access Key (optional, used by s3 type SDK mode)
    - `S3_SECRET_ACCESS_KEY`: AWS Secret Key (optional, used by s3 type SDK mode)
    - `S3_BASE_URL`: S3 public URL (optional, used by s3 type URL mode)
    - `S3_PREFIX`: S3 object prefix (optional, used by s3 type)
    - `LOG_LEVEL`: Log level (optional, default `info`)

#### 重要注意事項

1. **絕對路徑**：`args` 中的路徑必須是絕對路徑，不能使用相對路徑
2. **JSON 格式**：確保 JSON 格式正確，最後一個項目後不能有逗號
3. **環境變數優先級**：JSON 中的 `env` 會覆蓋 `.env` 檔案中的設定
4. **重啟應用**：修改設定後需要完全重啟應用程式才能生效

### 驗證 MCP Server 是否正常運作

#### 方法一：使用 MCP Inspector

```bash
cd /path/to/mcp-prompt-manager

# 如果修改了源碼，先編譯
pnpm run build

# 啟動 Inspector（或使用 inspector:dev 自動編譯）
pnpm run inspector
# 或
pnpm run inspector:dev
```

這會啟動一個網頁介面，你可以在其中：

- 查看所有已載入的 prompts
- 測試 prompt 的輸出
- 檢查錯誤訊息

> **注意**: Inspector 執行的是 `dist/index.js`，修改源碼後必須先執行 `build` 才能看到最新變更。

#### 方法二：檢查日誌

在設定檔中添加環境變數來查看詳細日誌：

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_STORAGE": "local",
                "STORAGE_DIR": "/path/to/repo",
                "LOG_LEVEL": "debug"
            }
        }
    }
}
```

然後查看客戶端的日誌輸出（Cursor 的輸出面板或 Claude Desktop 的日誌）。

#### 方法三：檢查檔案系統

確認 Git 倉庫已成功同步：

```bash
ls -la /path/to/mcp-prompt-manager/.prompts_cache
```

應該能看到從 Git 倉庫 clone 下來的檔案。

### 常見設定問題

#### 問題 1: 找不到設定檔

**解決方案**:

- 確認應用程式已經啟動過至少一次（會自動建立設定目錄）
- 手動建立設定檔和目錄
- 檢查路徑是否正確（注意大小寫和空格）

#### 問題 2: JSON 格式錯誤

**解決方案**:

- 使用 JSON 驗證工具檢查格式（如 [JSONLint](https://jsonlint.com/)）
- 確保所有字串都用雙引號
- 確保最後一個項目後沒有逗號

#### 問題 3: Server 無法啟動

**解決方案**:

1. 確認 `dist/index.js` 檔案存在
2. 確認路徑是絕對路徑
3. 確認 Node.js 已安裝且版本 >= 18
4. 檢查環境變數是否正確
5. 查看客戶端的錯誤日誌

#### 問題 4: 找不到 Prompts

**解決方案**:

1. 確認 `PROMPT_STORAGE` 和對應的設定正確
   - `local`: 檢查 `STORAGE_DIR` 是否正確且目錄可訪問
   - `github`: 檢查 `PROMPT_REPO_URL` 是否正確
   - `s3`: 檢查 `S3_BUCKET_NAME` 和相關設定是否正確
2. 檢查 `MCP_GROUPS` 設定是否包含你想要的群組
   - **注意**：如果 `MCP_GROUPS` 未設定，系統預設只載入 `common` 群組
   - 查看日誌中的提示訊息，確認是否使用了預設群組
   - 設定 `MCP_GROUPS=laravel,vue` 等來載入其他群組
3. 確認儲存位置中有 `.yaml` 或 `.yml` 檔案
4. 使用 `LOG_LEVEL=debug` 查看詳細日誌，確認哪些群組被載入

## 📂 Prompt Repository 結構

你的 Prompt Repository (即 `PROMPT_REPO_URL` 指向的地方) 應該具有以下結構：

```text
my-prompts/
├── partials/              # 存放 Handlebars partials (.hbs)
│   ├── role-expert.hbs
│   └── output-format.hbs
├── common/                # common 群組（永遠載入）
│   ├── common-prompt.yaml
│   └── partials/
│       └── common-partial.hbs
├── laravel/               # laravel 群組（需在 MCP_GROUPS 中指定）
│   └── laravel-prompt.yaml
├── vue/                   # vue 群組（需在 MCP_GROUPS 中指定）
│   └── vue-prompt.yaml
├── root-prompt.yaml       # 根目錄（永遠載入）
└── another-prompt.yml
```

### 群組過濾規則

- **根目錄** (`/`): 永遠載入
- **common 群組** (`common/`): 永遠載入
- **其他群組**: 只有在 `MCP_GROUPS` 環境變數中指定時才載入

#### 預設行為

當 `MCP_GROUPS` **未設定**時：
- 系統會自動載入 `common` 群組（以及根目錄的 prompts）
- 啟動時會在日誌中明確提示使用預設群組
- 日誌會包含提示訊息，建議設定 `MCP_GROUPS` 以載入更多群組

#### 範例

- `MCP_GROUPS=laravel,vue` → 載入根目錄、common、laravel、vue
- `MCP_GROUPS=` 或未設定 → 只載入根目錄和 common（系統會提示使用預設值）

### Prompt 定義檔範例 (`.yaml`)

```yaml
id: "code-review"
title: "代碼審查"
description: "幫我進行代碼審查"
args:
    code:
        type: "string"
        description: "要審查的代碼"
    language:
        type: "string"
        description: "程式語言"
template: |
    {{> role-expert }}

    你是一位資深的 {{language}} 工程師。
    請幫我審查以下代碼：
```

{{ code }}

```

```

### 參數類型

Prompt 支援三種參數類型：

- `string`: 字串類型（預設）
- `number`: 數字類型
- `boolean`: 布林類型

## 💻 開發指南

### 專案結構

```
mcp-prompt-manager/
├── src/
│   ├── index.ts              # 主程式入口
│   ├── config/
│   │   └── env.ts            # 環境變數配置和驗證
│   ├── storage/              # 儲存驅動器
│   │   ├── StorageDriver.ts           # 儲存驅動器介面
│   │   ├── StorageDriverFactory.ts   # 驅動器工廠
│   │   └── drivers/
│   │       ├── LocalGitStorageDriver.ts   # 本地 Git 驅動器
│   │       ├── GitHubStorageDriver.ts     # GitHub 驅動器
│   │       ├── MemoryStorageDriver.ts     # 記憶體驅動器
│   │       └── S3StorageDriver.ts         # S3 驅動器
│   ├── services/
│   │   ├── git.ts            # Git 同步服務
│   │   └── loaders.ts        # Prompt 和 Partials 載入器
│   ├── types/
│   │   └── prompt.ts         # 類型定義
│   └── utils/
│       ├── fileSystem.ts     # 檔案系統工具（含緩存）
│       └── logger.ts         # 日誌工具
├── test/                      # 測試文件
│   ├── config.test.ts
│   ├── loaders.test.ts
│   ├── utils.test.ts
│   └── integration.test.ts  # 整合測試
├── dist/                      # 編譯輸出
├── .env.example              # 環境變數範例檔
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 常用指令

```bash
# 編譯 TypeScript
npm run build
# 或
pnpm run build

# 啟動 MCP Inspector 進行除錯
# 注意：需先執行 build，或使用 inspector:dev 自動編譯
pnpm run build && pnpm run inspector
# 或使用開發模式（自動編譯）
pnpm run inspector:dev

# 運行測試
npm run test
# 或
pnpm test

# 運行測試（單次）
npm run test:run
# 或
pnpm test:run

# 開啟測試 UI
npm run test:ui
# 或
pnpm test:ui

# 格式化代碼
npm run format
# 或
pnpm format

# 檢查代碼格式
npm run format:check
# 或
pnpm format:check
```

### 開發流程

1. 修改 `src/` 目錄中的代碼。
2. 執行 `pnpm run build` 重新編譯（或使用 `pnpm run inspector:dev` 自動編譯並測試）。
3. 執行 `pnpm run test` 運行測試。
4. 使用 `pnpm run inspector:dev` 驗證變更（會自動編譯並啟動 Inspector）。
5. 在 Cursor 或 Claude Desktop 中重啟 MCP Server 以套用變更。

> **重要提示**:
>
> - `inspector` 指令執行的是 `dist/index.js`（編譯後的檔案）
> - 修改源碼後必須先執行 `build` 才能看到最新變更
> - 使用 `inspector:dev` 可以自動編譯並啟動，適合開發時使用

## 🧪 測試

專案包含完整的測試套件：

- **單元測試**: 53 個測試案例
- **整合測試**: 9 個測試案例
- **總計**: 62 個測試，全部通過

運行測試：

```bash
# 監聽模式
pnpm test

# 單次運行
pnpm test:run

# 開啟 UI
pnpm test:ui
```

## 🔧 配置說明

### 環境變數

#### Storage Driver Settings

| Variable Name      | Required | Default | Description |
| ------------------ | -------- | ------- | ----------- |
| `PROMPT_STORAGE`   | ❌       | `local` | Storage driver type: `github`, `local`, `memory`, `s3` |

#### Local Git Storage Settings (PROMPT_STORAGE=local)

| Variable Name | Required | Default           | Description |
| ------------- | -------- | ----------------- | ----------- |
| `STORAGE_DIR` | ❌       | `.prompts_cache`  | Local Git repository path (absolute or relative to current working directory) |

#### GitHub Storage Settings (PROMPT_STORAGE=github)

| Variable Name    | Required | Default           | Description |
| ---------------- | -------- | ----------------- | ----------- |
| `PROMPT_REPO_URL`| ✅*      | -                 | Git repository URL or local path (required for github storage type) |
| `STORAGE_DIR`    | ❌       | `.prompts_cache`  | Local cache directory |
| `GIT_BRANCH`     | ❌       | `main`            | Git branch name |
| `GIT_MAX_RETRIES`| ❌       | `3`               | Maximum retry count for Git operations |

#### Memory Storage Settings (PROMPT_STORAGE=memory)

| Variable Name | Required | Default | Description |
| ------------- | -------- | ------- | ----------- |
| -             | -        | -       | No additional configuration needed (used for testing or dynamic loading) |

#### S3 Storage Settings (PROMPT_STORAGE=s3)

| Variable Name         | Required | Default      | Description |
| --------------------- | -------- | ------------ | ----------- |
| `S3_BUCKET_NAME`      | ✅*      | -            | S3 bucket name (required for s3 storage type) |
| `S3_REGION`           | ❌       | `us-east-1`  | AWS region |
| `S3_ACCESS_KEY_ID`    | ❌       | -            | AWS Access Key (SDK mode, supports private buckets) |
| `S3_SECRET_ACCESS_KEY`| ❌       | -            | AWS Secret Key (SDK mode, supports private buckets) |
| `S3_BASE_URL`         | ❌       | Auto-generated | S3 public URL (URL mode, for public buckets) |
| `S3_PREFIX`           | ❌       | -            | S3 object prefix (used to limit scan scope) |

**S3 Mode Selection:**
- **SDK Mode**: Automatically used when both `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are provided (supports private buckets)
- **URL Mode**: Automatically used when credentials are not provided (for public buckets)

#### General Settings

| Variable Name | Required | Default                    | Description |
| ------------- | -------- | -------------------------- | ----------- |
| `MCP_LANGUAGE`| ❌       | `en`                       | Output language (`en` or `zh`) |
| `MCP_GROUPS`  | ❌       | `common`                   | Groups to load (comma-separated), system will log a hint when using default |
| `LOG_LEVEL`   | ❌       | `warn` (prod) / `info` (dev) | Log level, production defaults to warnings and errors only |
| `LOG_FILE`    | ❌       | -                          | Log file path (optional, strongly recommended) |

**Note**: Variables marked with ✅* are required for the corresponding storage type.

### 安全性

- ✅ 輸入驗證：所有環境變數都經過 Zod 驗證
- ✅ 路徑安全：防止路徑遍歷攻擊
- ✅ 群組驗證：群組名稱格式驗證（只允許字母、數字、下劃線、破折號）

## 📝 日誌

專案使用 [pino](https://github.com/pinojs/pino) 作為日誌系統，支援結構化日誌。

### 日誌級別

- `fatal`: 致命錯誤，導致程序退出
- `error`: 錯誤訊息
- `warn`: 警告訊息
- `info`: 一般資訊
- `debug`: 除錯訊息
- `trace`: 追蹤訊息
- `silent`: 完全禁用日誌輸出

**預設行為**：
- **生產環境**（`NODE_ENV` 未設定或不是 `development`）：預設為 `warn`，只輸出警告和錯誤
- **開發環境**（`NODE_ENV=development`）：預設為 `info`，輸出所有資訊級別以上的日誌
- 可通過 `LOG_LEVEL` 環境變數覆蓋預設值

### 設定日誌級別

```bash
# 在 .env 中設定
LOG_LEVEL=debug

# 或在環境變數中設定
export LOG_LEVEL=debug
```

## 🐛 故障排除

### 問題：Git 同步失敗（僅適用於 GitHub Storage）

**解決方案**:

1. 確認 `PROMPT_STORAGE=github` 已設定
2. 檢查 `PROMPT_REPO_URL` 是否正確
3. 確認網路連線正常
4. 檢查 Git 憑證是否正確
5. 查看日誌了解詳細錯誤訊息

### 問題：沒有載入任何 prompts

**解決方案**:

1. 確認 `PROMPT_STORAGE` 和對應的設定正確（例如 `STORAGE_DIR` 或 `PROMPT_REPO_URL`）
2. 檢查 `MCP_GROUPS` 設定是否正確
3. 確認 prompts 檔案在正確的目錄結構中
4. 檢查 YAML 檔案格式是否正確
5. 查看日誌中的錯誤訊息

### 問題：Partials 無法使用

**解決方案**:

1. 確認 partial 檔案副檔名為 `.hbs`
2. 檢查 partial 檔案內容是否正確
3. 確認在模板中使用 `{{> partial-name }}` 語法

## 📚 相關資源

- [Model Context Protocol 官方文檔](https://modelcontextprotocol.io/)
- [Handlebars 文檔](https://handlebarsjs.com/)
- [Zod 文檔](https://zod.dev/)

## 📄 授權

ISC

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

**版本**: 1.0.0  
**最後更新**: 2024-11-30
