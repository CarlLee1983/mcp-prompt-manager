# Code Review 報告

**專案**: mcp-prompt-manager  
**審查日期**: 2024-11-30  
**審查者**: 資深工程師

---

## 📊 總體評估

**評分**: 7.5/10

**優點**:
- ✅ 代碼結構清晰，職責分離良好
- ✅ 使用 TypeScript 提供類型安全
- ✅ 有完整的測試覆蓋（53 個測試）
- ✅ 使用現代工具鏈（Vitest, Prettier）
- ✅ 支援 Handlebars 模板和 Partials

**需要改進**:
- ⚠️ 錯誤處理不夠完善
- ⚠️ 日誌系統使用 console.error（不專業）
- ⚠️ 缺少輸入驗證和安全性檢查
- ⚠️ 代碼組織可以更模組化
- ⚠️ 缺少配置驗證

---

## 🔴 嚴重問題 (Critical Issues)

### 1. **安全性：缺少輸入驗證**

**位置**: `src/index.ts:15, 29-31`

**問題**:
```typescript
const REPO_URL = process.env.PROMPT_REPO_URL
const ACTIVE_GROUPS = process.env.MCP_GROUPS
    ? process.env.MCP_GROUPS.split(",").map((g) => g.trim())
    : ["common"]
```

**風險**:
- `REPO_URL` 未驗證，可能包含惡意路徑或 URL
- `MCP_GROUPS` 未驗證，可能包含路徑遍歷攻擊（如 `../../../etc/passwd`）
- 沒有對 Git URL 格式進行驗證

**建議**:
```typescript
// 驗證 REPO_URL
function validateRepoUrl(url: string | undefined): string {
    if (!url) {
        throw new Error("PROMPT_REPO_URL is required")
    }
    // 驗證 URL 格式或本地路徑
    if (url.includes("..") || url.includes("\0")) {
        throw new Error("Invalid REPO_URL: path traversal detected")
    }
    return url
}

// 驗證群組名稱
function validateGroupName(group: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(group)
}
```

---

### 2. **錯誤處理：Git 操作缺少重試機制**

**位置**: `src/index.ts:55-91`

**問題**:
- Git 操作失敗時直接拋出錯誤，沒有重試機制
- 網路問題時會導致服務無法啟動
- 沒有處理部分失敗的情況

**建議**:
```typescript
async function syncRepo() {
    const maxRetries = 3
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // ... git operations
            return
        } catch (error) {
            lastError = error as Error
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
                continue
            }
        }
    }
    throw lastError
}
```

---

### 3. **日誌系統：使用 console.error 不專業**

**位置**: 整個 `src/index.ts`

**問題**:
- 所有日誌都使用 `console.error`，即使是資訊性訊息
- 無法控制日誌級別
- 無法重定向或格式化日誌
- 生產環境不適合

**建議**:
```typescript
// 使用專業的日誌庫，如 winston 或 pino
import pino from "pino"

const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV === "development" 
        ? { target: "pino-pretty" }
        : undefined
})

// 使用不同級別
logger.info("Git syncing from:", REPO_URL)
logger.error("Git sync failed:", error)
logger.debug("Partial registered:", partialName)
```

---

## 🟡 重要問題 (Important Issues)

### 4. **代碼組織：單一文件過大**

**位置**: `src/index.ts` (223 行)

**問題**:
- 所有邏輯都在一個文件中
- 難以測試和維護
- 違反單一職責原則

**建議重構**:
```
src/
├── index.ts              # 入口點
├── config/
│   └── env.ts           # 環境變數配置
├── services/
│   ├── git.ts           # Git 同步服務
│   ├── loader.ts        # Prompt 載入器
│   └── partials.ts      # Partials 載入器
├── utils/
│   └── fileSystem.ts    # 檔案系統工具
└── types/
    └── prompt.ts        # 類型定義
```

---

### 5. **類型安全：使用 `as` 類型斷言**

**位置**: `src/index.ts:155`

**問題**:
```typescript
const promptDef = yaml.load(content) as PromptDefinition
```

**風險**:
- 沒有驗證 YAML 結構是否符合 `PromptDefinition`
- 可能導致運行時錯誤

**建議**:
```typescript
import { z } from "zod"

const PromptDefinitionSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    args: z.record(z.object({
        type: z.enum(["string", "number", "boolean"]),
        description: z.string().optional()
    })).optional(),
    template: z.string()
})

// 驗證並解析
const parseResult = PromptDefinitionSchema.safeParse(yaml.load(content))
if (!parseResult.success) {
    throw new Error(`Invalid prompt definition: ${parseResult.error}`)
}
const promptDef = parseResult.data
```

---

### 6. **錯誤處理：吞掉錯誤但繼續執行**

**位置**: `src/index.ts:199-201`

**問題**:
```typescript
} catch (e) {
    console.error(`[Error] Failed to parse ${relativePath}:`, e)
}
```

**風險**:
- 錯誤被吞掉，只記錄但不處理
- 可能導致部分 prompts 載入失敗但用戶不知道
- 沒有錯誤統計或報告

**建議**:
```typescript
const errors: Array<{ file: string; error: Error }> = []

try {
    // ... parsing logic
} catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    errors.push({ file: relativePath, error })
    logger.warn(`Failed to parse ${relativePath}:`, error)
}

// 在最後報告錯誤
if (errors.length > 0) {
    logger.error(`Failed to load ${errors.length} prompt(s)`)
    // 可以選擇是否拋出錯誤
}
```

---

### 7. **性能：重複讀取檔案系統**

**位置**: `src/index.ts:132, 113`

**問題**:
```typescript
// loadPrompts 中
const allFiles = await getFilesRecursively(STORAGE_DIR)

// loadPartials 中
const allFiles = await getFilesRecursively(STORAGE_DIR)
```

**問題**:
- 兩個函數都調用 `getFilesRecursively`，重複掃描檔案系統
- 對於大型 repo 會影響性能

**建議**:
```typescript
// 緩存檔案列表
let cachedFiles: string[] | null = null

async function getAllFiles(): Promise<string[]> {
    if (!cachedFiles) {
        cachedFiles = await getFilesRecursively(STORAGE_DIR)
    }
    return cachedFiles
}
```

---

## 🟢 改進建議 (Enhancements)

### 8. **配置管理：缺少配置驗證**

**建議**:
```typescript
import { z } from "zod"

const ConfigSchema = z.object({
    PROMPT_REPO_URL: z.string().min(1),
    MCP_LANGUAGE: z.enum(["en", "zh"]).default("en"),
    MCP_GROUPS: z.string().optional(),
    STORAGE_DIR: z.string().optional(),
})

function loadConfig() {
    dotenv.config()
    return ConfigSchema.parse({
        PROMPT_REPO_URL: process.env.PROMPT_REPO_URL,
        MCP_LANGUAGE: process.env.MCP_LANGUAGE,
        MCP_GROUPS: process.env.MCP_GROUPS,
        STORAGE_DIR: process.env.STORAGE_DIR,
    })
}
```

---

### 9. **Git 操作：缺少分支和標籤支援**

**位置**: `src/index.ts:75, 80, 84`

**問題**:
- 只支援預設分支
- 無法指定特定分支或標籤

**建議**:
```typescript
const GIT_BRANCH = process.env.GIT_BRANCH || "main"
const GIT_TAG = process.env.GIT_TAG

// 在 clone 時指定分支
await simpleGit().clone(REPO_URL, STORAGE_DIR, ["-b", GIT_BRANCH])
```

---

### 10. **Handlebars：缺少錯誤處理**

**位置**: `src/index.ts:175-177`

**問題**:
```typescript
const templateDelegate = Handlebars.compile(promptDef.template, {
    noEscape: true,
})
```

**風險**:
- 模板編譯失敗時沒有處理
- 模板執行時錯誤沒有捕獲

**建議**:
```typescript
let templateDelegate: HandlebarsTemplateDelegate
try {
    templateDelegate = Handlebars.compile(promptDef.template, {
        noEscape: true,
    })
} catch (error) {
    throw new Error(`Failed to compile template for ${promptDef.id}: ${error}`)
}

// 在執行時也要捕獲錯誤
server.prompt(promptDef.id, zodShape, (args) => {
    try {
        const context = { ...args, output_lang_rule: LANG_INSTRUCTION, sys_lang: LANG_SETTING }
        const message = templateDelegate(context)
        return { messages: [{ role: "user", content: { type: "text", text: message } }] }
    } catch (error) {
        logger.error(`Template execution failed for ${promptDef.id}:`, error)
        throw error
    }
})
```

---

### 11. **檔案系統：缺少權限檢查**

**位置**: `src/index.ts:62, 78`

**問題**:
- 沒有檢查目錄權限
- 沒有處理權限不足的情況

**建議**:
```typescript
async function ensureDirectoryAccess(dir: string) {
    try {
        await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK)
    } catch (error) {
        throw new Error(`No access to directory ${dir}: ${error}`)
    }
}
```

---

### 12. **類型定義：可以更嚴格**

**位置**: `src/index.ts:34-45`

**建議**:
```typescript
// 使用更嚴格的類型
type PromptArgType = "string" | "number" | "boolean"

interface PromptArgDefinition {
    readonly type: PromptArgType
    readonly description?: string
}

interface PromptDefinition {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly args?: Readonly<Record<string, PromptArgDefinition>>
    readonly template: string
}
```

---

## 📝 代碼風格問題

### 13. **註解：部分註解可以改進**

**位置**: 整個文件

**建議**:
- 使用 JSDoc 格式的註解
- 為函數添加參數和返回值說明

```typescript
/**
 * 遞迴讀取目錄中的所有檔案
 * @param dir - 要掃描的目錄路徑
 * @returns 檔案路徑陣列
 * @throws {Error} 當目錄不存在或無法讀取時
 */
async function getFilesRecursively(dir: string): Promise<string[]>
```

---

### 14. **常數：魔術數字和字串**

**位置**: `src/index.ts:66, 98`

**建議**:
```typescript
const GIT_MAX_CONCURRENT_PROCESSES = 6
const HIDDEN_FILE_PREFIX = "."

// 使用常數而非魔術值
if (file.startsWith(HIDDEN_FILE_PREFIX)) continue
```

---

## 🧪 測試相關

### 15. **測試覆蓋率：缺少整合測試**

**問題**:
- 單元測試完整，但缺少整合測試
- 沒有測試完整的啟動流程

**建議**:
- 添加整合測試，測試從 Git clone 到 MCP Server 啟動的完整流程
- 使用 mock Git 操作來測試錯誤情況

---

## 📦 依賴管理

### 16. **package.json：缺少描述和關鍵字**

**位置**: `package.json:4, 16`

**建議**:
```json
{
  "description": "MCP Server for managing and serving prompt templates from Git repositories",
  "keywords": ["mcp", "prompt", "template", "git", "handlebars"],
  "author": "Your Name",
  "license": "MIT"
}
```

---

## ✅ 優點總結

1. **代碼結構清晰** - 函數職責分明
2. **類型安全** - 使用 TypeScript 和介面定義
3. **測試完整** - 53 個測試案例，覆蓋主要功能
4. **現代工具鏈** - Vitest, Prettier, TypeScript
5. **功能完整** - 支援 Git 同步、Handlebars、Partials

---

## 🎯 優先級建議

### 高優先級（立即修復）
1. ✅ 添加輸入驗證和安全性檢查
2. ✅ 改進錯誤處理（不要吞掉錯誤）
3. ✅ 使用專業日誌系統

### 中優先級（近期改進）
4. ✅ 重構代碼組織（拆分模組）
5. ✅ 添加配置驗證
6. ✅ 改進 Git 操作（重試機制）

### 低優先級（長期優化）
7. ✅ 性能優化（緩存檔案列表）
8. ✅ 添加整合測試
9. ✅ 改進文檔和註解

---

## 📚 參考資源

- [Node.js 安全最佳實踐](https://nodejs.org/en/docs/guides/security/)
- [TypeScript 最佳實踐](https://typescript-eslint.io/rules/)
- [錯誤處理模式](https://www.joyent.com/node-js/production/design/errors)

---

**審查完成**

