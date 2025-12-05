# MCP Prompt Manager (Git-Driven)

<div align="center">

**基於 Git 的 Model Context Protocol (MCP) Server，提供強大的 Prompt 模板管理功能**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/CarlLee1983/mcp-prompt-manager)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

[English](README.md) | [繁體中文](README.zh-TW.md)

</div>

## 📋 簡介

這是一個基於 Git 的 Model Context Protocol (MCP) Server，專門用於管理和提供 Prompt 模板。它允許你將 Prompts 存儲在一個獨立的 Git Repository 中，並透過 MCP 協議讓 Cursor、Claude Desktop 等 AI 編輯器直接使用。

**主要優勢：**
- 🔄 團隊協作：透過 Git 版本控制，確保團隊使用統一的 Prompt 版本
- 🎯 動態模板：支援 Handlebars 語法，建立可重用的動態 Prompt
- 🚀 零停機重載：支援熱重載，無需重啟即可更新 Prompts
- 🔍 智能管理：內建 Prompt 版本管理、狀態追蹤和群組過濾
- 📊 完整監控：提供系統健康狀態和 Prompt 統計資訊

## ✨ 特色

- **Git 同步**: Prompts 直接從指定的 Git Repository 同步，確保團隊使用統一的 Prompt 版本。
- **Handlebars 模板**: 支援強大的 Handlebars 語法，可以建立動態、可重用的 Prompt 模板。
- **Partials 支援**: 支援 Handlebars Partials，方便拆分和重用 Prompt 片段（例如角色設定、輸出格式）。
- **本地緩存**: 自動將 Git Repo 內容緩存到本地 `.prompts_cache` 目錄，提高讀取速度。
- **快取失效策略**: 自動定期清理過期快取項目，避免記憶體洩漏，確保資料一致性。
- **群組過濾**: 支援按群組過濾載入 prompts，只載入需要的部分。
- **錯誤處理**: 完整的錯誤統計和報告，確保問題可追蹤。
- **重試機制**: Git 操作自動重試，提高可靠性。
- **類型安全**: 使用 Zod 驗證配置和 prompt 定義，確保類型安全。
- **專業日誌**: 使用 pino 日誌系統，支援結構化日誌和多種日誌級別。

## 🚀 快速開始

### 1. 安裝

首先，Clone 本專案並安裝依賴：

```bash
git clone <本專案的 URL>
cd mcp-prompt-manager
npm install
# 或使用 pnpm (推薦)
pnpm install
```

> 注意：專案強制使用 pnpm，npm/yarn 安裝會被 preinstall 檢查阻擋。

### 2. 設定環境變數

複製範例設定檔並建立 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，設定你的 Prompt Git Repository 路徑或 URL：

```bash
# Git Repository 來源（必填）
# 本地路徑範例
PROMPT_REPO_URL=/Users/yourname/Desktop/my-local-prompts

# 或遠端 Git URL 範例
# PROMPT_REPO_URL=https://github.com/yourusername/my-prompts.git
# PROMPT_REPO_URL=git@github.com:yourusername/my-prompts.git

# 輸出語言設定（可選，預設 en）
MCP_LANGUAGE=en  # 或 zh

# 群組過濾設定（可選，未設定時預設只載入 common 群組）
# 設定範例: MCP_GROUPS="laravel,vue,react"
# 注意：未設定時，系統會在日誌中明確提示使用預設群組
MCP_GROUPS=laravel,vue

# 自訂儲存目錄（可選，預設 .prompts_cache）
STORAGE_DIR=/custom/path

# Git 分支（可選，預設 main）
GIT_BRANCH=main

# Git 重試次數（可選，預設 3）
GIT_MAX_RETRIES=3

# 快取清理間隔（可選，預設 10000 毫秒）
# 設定定期清理過期快取項目的間隔時間（毫秒）
# 預設值為 10 秒（CACHE_TTL * 2），確保過期項目能被及時清理
# 建議值：5000-30000 毫秒，根據使用頻率調整
CACHE_CLEANUP_INTERVAL=10000

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
                "PROMPT_REPO_URL": "/Users/yourname/Desktop/my-local-prompts",
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
                "PROMPT_REPO_URL": "/Users/yourname/Desktop/my-local-prompts",
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
                "PROMPT_REPO_URL": "/path/to/your/repo",
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
                "PROMPT_REPO_URL": "/path/to/your/repo",
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
                "PROMPT_REPO_URL": "/path/to/your/repo"
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
        PROMPT_REPO_URL: "/path/to/repo",
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
            "PROMPT_REPO_URL": "/path/to/repo",
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
                "PROMPT_REPO_URL": "your-repo-url-or-path",
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
- **`env`**: 環境變數物件（可選）
    - `PROMPT_REPO_URL`: Git 倉庫 URL 或本地路徑（必填）
    - `MCP_LANGUAGE`: 輸出語言，`en` 或 `zh`（可選，預設 `en`）
    - `MCP_GROUPS`: 要載入的群組，逗號分隔（可選，未設定時預設只載入 `common` 群組，系統會在日誌中提示）
    - `STORAGE_DIR`: 本地緩存目錄（可選）
    - `GIT_BRANCH`: Git 分支（可選，預設 `main`）
    - `GIT_MAX_RETRIES`: Git 重試次數（可選，預設 `3`）
    - `CACHE_CLEANUP_INTERVAL`: 快取清理間隔，毫秒（可選，預設 `10000`）
    - `LOG_LEVEL`: 日誌級別（可選，預設 `info`）

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
                "PROMPT_REPO_URL": "/path/to/repo",
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

1. 確認 `PROMPT_REPO_URL` 正確
2. 檢查 `MCP_GROUPS` 設定是否包含你想要的群組
   - **注意**：如果 `MCP_GROUPS` 未設定，系統預設只載入 `common` 群組
   - 查看日誌中的提示訊息，確認是否使用了預設群組
   - 設定 `MCP_GROUPS=laravel,vue` 等來載入其他群組
3. 確認 Git 倉庫中有 `.yaml` 或 `.yml` 檔案
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

### Registry 功能（可選）

你可以在 Prompt Repository 的根目錄建立 `registry.yaml` 檔案，用於集中管理 prompts 的可見性和棄用狀態。

#### Registry 檔案格式

```yaml
prompts:
  - id: "code-review"
    group: "common"
    visibility: "public"  # public, private, internal
    deprecated: false
  - id: "old-prompt"
    visibility: "private"
    deprecated: true
```

#### Registry 欄位說明

- **`id`**: Prompt ID（必填）
- **`group`**: 群組名稱（可選）
- **`visibility`**: 可見性設定
  - `public`: 公開（預設）
  - `private`: 私有
  - `internal`: 內部使用
- **`deprecated`**: 是否已棄用（預設 `false`）

#### Registry 的作用

- **集中管理**: 在單一檔案中管理所有 prompts 的可見性和棄用狀態
- **覆蓋預設值**: 可以覆蓋 prompt 定義檔中的預設設定
- **版本控制**: 透過 Git 追蹤 prompts 的生命週期

> **注意**: `registry.yaml` 是可選的。如果不存在，系統會使用 prompt 定義檔中的預設值。

### Prompt 運行狀態

每個 prompt 都有一個運行狀態（`runtime_state`），用於表示 prompt 的當前可用性：

- **`active`**: 活躍狀態，prompt 正常運作，可以作為 MCP Tool 使用
- **`legacy`**: 遺留狀態，prompt 仍然可用但已標記為舊版本，建議使用新版本
- **`invalid`**: 無效狀態，prompt 定義有問題（例如缺少必要欄位、模板錯誤等），無法使用
- **`disabled`**: 已停用，prompt 被明確停用（例如在 registry 中標記為 deprecated）
- **`warning`**: 警告狀態，prompt 可以運作但有一些警告（例如版本過舊）

### Prompt 來源

每個 prompt 都有一個來源（`source`）標記，表示 metadata 的來源：

- **`embedded`**: 嵌入在 prompt 定義檔中的 metadata（使用 `metadata:` 區塊）
- **`registry`**: 來自 `registry.yaml` 的設定
- **`legacy`**: 遺留模式，沒有 metadata，使用預設值

### Prompt 狀態

每個 prompt 都有一個狀態（`status`），表示 prompt 的開發階段：

- **`draft`**: 草稿，正在開發中
- **`stable`**: 穩定版本，可以正常使用
- **`deprecated`**: 已棄用，不建議使用
- **`legacy`**: 遺留版本，仍然可用但建議升級

## 🔧 MCP 工具與資源

本專案提供多個 MCP 工具和資源，方便管理和查詢 Prompts。

### MCP 工具（Tools）

伺服器提供 6 個管理工具，並會動態註冊從載入的 prompts 產生的工具。

#### 1. `mcp.reload` / `mcp.reload_prompts`

重載所有 Prompts，無需重啟伺服器（熱重載）。

- **功能**：從 Git 倉庫拉取最新變更，清除快取，重新載入所有 Handlebars partials 和 prompts
- **參數**：無
- **使用範例**：
  ```json
  {
    "tool": "mcp.reload",
    "arguments": {}
  }
  ```

#### 2. `mcp.stats` / `mcp.prompt.stats`

獲取 Prompts 統計資訊。

- **功能**：返回所有 prompts 的統計資訊，包括各運行狀態的數量（active、legacy、invalid、disabled、warning）
- **參數**：無
- **返回內容**：
  - `total`: 總數
  - `active`: 活躍狀態數量
  - `legacy`: 遺留狀態數量
  - `invalid`: 無效狀態數量
  - `disabled`: 已停用數量
  - `warning`: 警告狀態數量

#### 3. `mcp.list` / `mcp.prompt.list`

列出所有 Prompts，支援多種過濾條件。

- **功能**：列出所有 prompt runtimes，包含完整的元數據資訊
- **參數**（可選）：
  - `status`: 過濾狀態（`draft`、`stable`、`deprecated`、`legacy`）
  - `group`: 過濾群組名稱
  - `tag`: 過濾標籤（prompts 必須包含此標籤）
  - `runtime_state`: 過濾運行狀態（`active`、`legacy`、`invalid`、`disabled`、`warning`）
- **使用範例**：
  ```json
  {
    "tool": "mcp.list",
    "arguments": {
      "group": "laravel",
      "runtime_state": "active"
    }
  }
  ```

#### 4. `mcp.inspect`

檢查特定 Prompt 的詳細運行資訊。

- **功能**：根據 Prompt ID 獲取完整的運行時元數據，包括狀態、來源、版本、標籤和使用案例
- **參數**：
  - `id`: Prompt ID（必填）
- **使用範例**：
  ```json
  {
    "tool": "mcp.inspect",
    "arguments": {
      "id": "code-review"
    }
  }
  ```

#### 5. `mcp.repo.switch`

切換到不同的 Prompt 倉庫並重新載入（零停機時間）。

- **功能**：切換到新的 Git 倉庫並重新載入所有 prompts
- **參數**：
  - `repo_url`: 倉庫 URL（必填）
  - `branch`: 分支名稱（可選）
- **使用範例**：
  ```json
  {
    "tool": "mcp.repo.switch",
    "arguments": {
      "repo_url": "/path/to/new/repo",
      "branch": "main"
    }
  }
  ```

#### 6. `preview_prompt`

預覽/渲染 Prompt 模板（除錯工具）。

- **功能**：使用給定的參數渲染 Prompt 模板，顯示最終文字而不執行它。用於驗證模板邏輯。
- **參數**：
  - `promptId`: Prompt ID（必填，例如 `'laravel:code-review'`）
  - `args`: JSON 物件，包含要傳入模板的變數（必填）
- **返回內容**：
  - `success`: 布林值，表示成功或失敗
  - `renderedText`: 渲染後的 Prompt 文字
  - `highlightedText`: 渲染後的文字，變數以 Markdown 粗體標示
  - `statistics`: 物件，包含 `renderedLength`（字元數）和 `estimatedTokens`（估算的 token 數）
  - `warnings`: Schema 驗證警告陣列（例如缺少建議欄位）
- **使用範例**：
  ```json
  {
    "tool": "preview_prompt",
    "arguments": {
      "promptId": "laravel:code-review",
      "args": {
        "code": "function test() { return true; }",
        "language": "php"
      }
    }
  }
  ```
- **進階功能**：
  - **Schema 驗證**：嚴格驗證參數是否符合 Prompt 的 Zod schema
  - **Token 估算**：估算 token 數量（支援英文和中文文字）
  - **變數高亮**：使用 Markdown 粗體標示動態替換的變數
  - **Schema 警告**：檢測並報告缺少的必填或建議欄位

### MCP 資源（Resources）

#### 1. `system://health`

系統健康狀態資源。

- **URI**: `system://health`
- **MIME 類型**: `application/json`
- **內容**：包含以下資訊：
  - `git`: Git 倉庫資訊（URL、路徑、HEAD commit）
  - `prompts`: Prompts 統計（總數、各狀態數量、已載入數量、群組列表）
  - `registry`: Registry 狀態（是否啟用、來源）
  - `cache`: 快取資訊（大小、清理間隔）
  - `system`: 系統資訊（運行時間、記憶體使用）

#### 2. `prompts://list`

Prompts 列表資源。

- **URI**: `prompts://list`
- **MIME 類型**: `application/json`
- **內容**：所有 prompts 的完整元數據列表，包括：
  - `id`: Prompt ID
  - `title`: 標題
  - `version`: 版本
  - `status`: 狀態
  - `runtime_state`: 運行狀態
  - `source`: 來源
  - `tags`: 標籤陣列
  - `use_cases`: 使用案例陣列
  - `group`: 群組名稱
  - `visibility`: 可見性

### 工具使用建議

- **開發時**：使用 `mcp.reload` 快速重載 prompts，無需重啟伺服器
- **除錯時**：使用 `mcp.inspect` 檢查特定 prompt 的詳細資訊，或使用 `preview_prompt` 測試模板渲染
- **監控時**：使用 `mcp.stats` 和 `system://health` 資源監控系統狀態
- **查詢時**：使用 `mcp.list` 配合過濾條件查找特定 prompts
- **測試時**：使用 `preview_prompt` 驗證模板邏輯、檢查 token 數量，並在實際執行前查看變數替換結果

## 💻 開發指南

### 專案結構

```
mcp-prompt-manager/
├── src/
│   ├── index.ts              # 主程式入口
│   ├── config/
│   │   └── env.ts            # 環境變數配置和驗證
│   ├── services/
│   │   ├── control.ts        # MCP 控制工具處理
│   │   ├── git.ts            # Git 同步服務
│   │   ├── health.ts         # 健康狀態服務
│   │   └── loaders.ts        # Prompt 和 Partials 載入器
│   ├── types/
│   │   ├── prompt.ts         # Prompt 類型定義
│   │   ├── promptMetadata.ts # Prompt 元數據類型
│   │   ├── promptRuntime.ts  # Prompt 運行時類型
│   │   └── registry.ts       # Registry 類型定義
│   └── utils/
│       ├── fileSystem.ts     # 檔案系統工具（含緩存）
│       └── logger.ts         # 日誌工具
├── test/                      # 測試文件
│   ├── config.test.ts
│   ├── loaders.test.ts
│   ├── promptMetadata.test.ts
│   ├── utils.test.ts
│   └── integration.test.ts  # 整合測試
├── dist/                      # 編譯輸出
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

| 變數名                  | 必填 | 預設值           | 說明                     |
| ----------------------- | ---- | ---------------- | ------------------------ |
| `PROMPT_REPO_URL`       | ✅   | -                | Git 倉庫 URL 或本地路徑  |
| `MCP_LANGUAGE`          | ❌   | `en`             | 輸出語言 (`en` 或 `zh`)  |
| `MCP_GROUPS`            | ❌   | `common`         | 要載入的群組（逗號分隔），未設定時會在日誌中提示預設行為 |
| `STORAGE_DIR`           | ❌   | `.prompts_cache` | 本地緩存目錄             |
| `GIT_BRANCH`            | ❌   | `main`           | Git 分支名稱             |
| `GIT_MAX_RETRIES`       | ❌   | `3`              | Git 操作最大重試次數     |
| `CACHE_CLEANUP_INTERVAL` | ❌   | `10000`          | 快取清理間隔（毫秒），定期清理過期快取項目 |
| `LOG_LEVEL`             | ❌   | `warn` (生產) / `info` (開發) | 日誌級別，生產環境預設只輸出警告和錯誤 |

### 快取失效策略

系統使用 TTL-based 定期清理機制來管理檔案列表快取，確保記憶體使用效率。

#### 快取機制

- **快取 TTL**: 5 秒（硬編碼）
- **清理間隔**: 預設 10 秒（`CACHE_TTL * 2`），可透過 `CACHE_CLEANUP_INTERVAL` 環境變數調整
- **自動清理**: 應用程式啟動時自動啟動清理機制
- **優雅關閉**: 應用程式關閉時自動停止清理定時器

#### 工作原理

1. **快取建立**: 當 `getFilesRecursively()` 被調用時，會將掃描結果快取 5 秒
2. **定期清理**: 每 10 秒（或設定的間隔）自動掃描並移除過期的快取項目
3. **記憶體管理**: 防止快取無限增長，避免記憶體洩漏

#### 配置範例

```bash
# 設定較短的清理間隔（用於測試）
CACHE_CLEANUP_INTERVAL=2000  # 2 秒清理一次

# 設定較長的清理間隔（用於生產環境，減少清理頻率）
CACHE_CLEANUP_INTERVAL=30000  # 30 秒清理一次
```

#### 監控快取狀態

可以透過日誌查看快取清理狀態（需要設定 `LOG_LEVEL=debug`）：

```
[DEBUG] Cache cleanup mechanism started { interval: 10000 }
[DEBUG] Cache cleanup completed { cleaned: 2 }
```

#### 驗證快取機制

詳見 [CACHE_VERIFICATION.md](./CACHE_VERIFICATION.md) 文件，包含完整的驗證方法和測試指南。

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

### 問題：Git 同步失敗

**解決方案**:

1. 檢查 `PROMPT_REPO_URL` 是否正確
2. 確認網路連線正常
3. 檢查 Git 憑證是否正確
4. 查看日誌了解詳細錯誤訊息

### 問題：沒有載入任何 prompts

**解決方案**:

1. 檢查 `MCP_GROUPS` 設定是否正確
2. 確認 prompts 檔案在正確的目錄結構中
3. 檢查 YAML 檔案格式是否正確
4. 查看日誌中的錯誤訊息

### 問題：Partials 無法使用

**解決方案**:

1. 確認 partial 檔案副檔名為 `.hbs`
2. 檢查 partial 檔案內容是否正確
3. 確認在模板中使用 `{{> partial-name }}` 語法

## 📦 主要依賴

- **@modelcontextprotocol/sdk**: MCP SDK，提供 MCP Server 核心功能
- **handlebars**: Handlebars 模板引擎，支援動態 Prompt 生成
- **simple-git**: Git 操作庫，用於同步 Git 倉庫
- **js-yaml**: YAML 解析器，用於解析 Prompt 定義檔
- **zod**: TypeScript 優先的 schema 驗證庫，用於配置和類型驗證
- **pino**: 高性能結構化日誌庫
- **dotenv**: 環境變數載入工具

## 📚 相關資源

- [Model Context Protocol 官方文檔](https://modelcontextprotocol.io/)
- [Handlebars 文檔](https://handlebarsjs.com/)
- [Zod 文檔](https://zod.dev/)
- [Simple Git 文檔](https://github.com/steveukx/git-js)
- [Pino 文檔](https://getpino.io/)

## 📄 授權

ISC

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

**版本**: 1.0.0  
**最後更新**: 2024-11-30
