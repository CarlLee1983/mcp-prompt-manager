# MCP Prompt Manager (多儲存驅動器支援)

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
npm install
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

# 本地 Git repository 路徑（可選）
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
PROMPT_REPO_URL=/Users/yourname/Desktop/my-local-prompts

# 或遠端 Git URL 範例
# PROMPT_REPO_URL=https://github.com/yourusername/my-prompts.git
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
# 如果提供 credentials，會自動使用 SDK 模式
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key

# 方式二：使用 URL 模式（公開 bucket）
# 如果不提供 credentials，會自動使用 URL 模式
# S3_BASE_URL=https://my-prompts-bucket.s3.amazonaws.com

# S3 物件前綴（可選，用於限制掃描範圍）
# S3_PREFIX=prompts/common
```

**S3 模式選擇說明：**
- **SDK 模式**：當同時提供 `S3_ACCESS_KEY_ID` 和 `S3_SECRET_ACCESS_KEY` 時自動使用（支援私有 bucket）
- **URL 模式**：當未提供 credentials 時自動使用（適合公開 bucket）

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
LOG_LEVEL=info

# 日誌檔案路徑（可選，強烈建議設定）
# 設定此變數後，所有級別的日誌都會寫入檔案（JSON 格式）
LOG_FILE=logs/mcp.log
```

### 3. 編譯

```bash
npm run build
# 或
pnpm run build
```

## 🔧 配置說明

### 環境變數

#### 儲存驅動器設定

| 變數名            | 必填 | 預設值           | 說明                     |
| ----------------- | ---- | ---------------- | ------------------------ |
| `PROMPT_STORAGE`  | ❌   | `local`          | 儲存驅動器類型：`github`, `local`, `memory`, `s3` |

#### Local Git Storage 設定 (PROMPT_STORAGE=local)

| 變數名        | 必填 | 預設值           | 說明                     |
| ------------- | ---- | ---------------- | ------------------------ |
| `STORAGE_DIR` | ❌   | `.prompts_cache` | 本地 Git repository 路徑（絕對或相對路徑） |

#### GitHub Storage 設定 (PROMPT_STORAGE=github)

| 變數名            | 必填 | 預設值           | 說明                     |
| ----------------- | ---- | ---------------- | ------------------------ |
| `PROMPT_REPO_URL` | ✅*  | -                | Git 倉庫 URL 或本地路徑（github 類型必填） |
| `STORAGE_DIR`     | ❌   | `.prompts_cache` | 本地緩存目錄             |
| `GIT_BRANCH`      | ❌   | `main`           | Git 分支名稱             |
| `GIT_MAX_RETRIES` | ❌   | `3`              | Git 操作最大重試次數     |

#### Memory Storage 設定 (PROMPT_STORAGE=memory)

| 變數名 | 必填 | 預設值 | 說明                     |
| ------ | ---- | ------ | ------------------------ |
| -      | -    | -      | 不需要額外設定（用於測試或動態載入） |

#### S3 Storage 設定 (PROMPT_STORAGE=s3)

| 變數名                | 必填 | 預設值           | 說明                     |
| --------------------- | ---- | ---------------- | ------------------------ |
| `S3_BUCKET_NAME`      | ✅*  | -                | S3 bucket 名稱（s3 類型必填） |
| `S3_REGION`           | ❌   | `us-east-1`      | AWS region               |
| `S3_ACCESS_KEY_ID`    | ❌   | -                | AWS Access Key（SDK 模式，支援私有 bucket） |
| `S3_SECRET_ACCESS_KEY`| ❌   | -                | AWS Secret Key（SDK 模式，支援私有 bucket） |
| `S3_BASE_URL`         | ❌   | 自動生成         | S3 公開 URL（URL 模式，公開 bucket） |
| `S3_PREFIX`           | ❌   | -                | S3 物件前綴（用於限制掃描範圍） |

**S3 模式選擇：**
- **SDK 模式**：當同時提供 `S3_ACCESS_KEY_ID` 和 `S3_SECRET_ACCESS_KEY` 時自動使用（支援私有 bucket）
- **URL 模式**：當未提供 credentials 時自動使用（適合公開 bucket）

#### 通用設定

| 變數名            | 必填 | 預設值           | 說明                     |
| ----------------- | ---- | ---------------- | ------------------------ |
| `MCP_LANGUAGE`    | ❌   | `en`             | 輸出語言 (`en` 或 `zh`)  |
| `MCP_GROUPS`      | ❌   | `common`         | 要載入的群組（逗號分隔），未設定時會在日誌中提示預設行為 |
| `LOG_LEVEL`       | ❌   | `warn` (生產) / `info` (開發) | 日誌級別，生產環境預設只輸出警告和錯誤 |
| `LOG_FILE`        | ❌   | -                | 日誌檔案路徑（可選，強烈建議設定） |

**注意**：標記為 ✅* 的變數在對應的儲存類型下為必填。

## 📝 使用範例

### Local Git Storage 範例

```bash
PROMPT_STORAGE=local
STORAGE_DIR=/Users/carl/Dev/prompts-repo
```

### GitHub Storage 範例

```bash
PROMPT_STORAGE=github
PROMPT_REPO_URL=https://github.com/yourusername/my-prompts.git
STORAGE_DIR=.prompts_cache
GIT_BRANCH=main
```

### S3 Storage 範例（私有 bucket）

```bash
PROMPT_STORAGE=s3
S3_BUCKET_NAME=my-private-prompts
S3_REGION=us-west-2
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_PREFIX=prompts
```

### S3 Storage 範例（公開 bucket）

```bash
PROMPT_STORAGE=s3
S3_BUCKET_NAME=my-public-prompts
S3_REGION=us-east-1
S3_BASE_URL=https://my-public-prompts.s3.amazonaws.com
```

## 🛠️ 使用方法

詳細的使用方法請參考 [README.md](./README.md) 中的說明。

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
**最後更新**: 2024-12-01

