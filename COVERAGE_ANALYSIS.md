# SourceManager.ts 覆蓋率分析

## 當前覆蓋率

-   **Statements**: 77.23% (目標: 75% ✅)
-   **Branches**: 67.81% (目標: 70% ⚠️)
-   **Functions**: 83.92% (目標: 75% ✅)
-   **Lines**: 77.37% (目標: 75% ✅)

## 未覆蓋的行號分析

### 1. 行 1558: `reloadSinglePrompt` 的最外層 catch 區塊

**代碼位置**:

```typescript
public async reloadSinglePrompt(...) {
    try {
        // ... 大量早期返回和內部錯誤處理
        return { success: true }
    } catch (error) {
        return { success: false, error: error as Error }  // ← 行 1558
    }
}
```

**無法覆蓋的原因**:

1. **防禦性編程**: 這是最外層的 catch-all，用於捕獲任何未預期的錯誤
2. **早期返回太多**: 函數內部有大量早期返回（early returns），大部分錯誤路徑都在內部處理
3. **難以模擬**: 要觸發這個 catch，需要模擬一個在函數開始就拋出的錯誤，或者在早期返回之後但在內部 try-catch 之外的錯誤
4. **實際場景**: 在正常使用中，這個 catch 幾乎不會被觸發，因為：
    - 檔案不存在 → 早期返回 `{ success: true }`
    - 檔案格式錯誤 → 內部 try-catch 處理
    - YAML 解析錯誤 → 內部 try-catch 處理
    - 驗證錯誤 → 早期返回 `{ success: false }`

**建議**:

-   這是合理的防禦性編程，可以保留
-   如果要測試，可以模擬 `path.relative()` 或 `this.shouldLoadPrompt()` 拋出錯誤
-   但這可能不是實際會發生的情況

### 2. 行 1691-1696: `createPromptRuntime` 的 else-if 和 else 分支

**代碼位置**:

```typescript
if (runtimeState !== undefined && source !== undefined) {
    finalRuntimeState = runtimeState
    finalSource = source
} else if (metadata) {
    // ← 行 1691-1693
    finalSource = "embedded"
    finalRuntimeState = "active"
} else {
    // ← 行 1694-1696
    finalSource = "legacy"
    finalRuntimeState = "legacy"
}
```

**無法覆蓋的原因**:

1. **調用模式固定**: `createPromptRuntime` 總是被調用時傳入了 `runtimeState` 和 `source`
    - 在 `loadPrompts` 中（行 500-505），總是先設定 `runtimeState` 和 `source`
    - 在 `loadPromptsFromSystemRepo` 中（行 1035-1042），也是同樣的模式
2. **Private 方法**: 這是 private 方法，只能通過公共方法間接調用
3. **邏輯保證**: 代碼邏輯保證在調用 `createPromptRuntime` 之前，`runtimeState` 和 `source` 已經被設定

**建議**:

-   這些分支是防禦性編程，用於處理未來可能的直接調用
-   如果要測試，可以：
    1. 使用 TypeScript 的 `@ts-expect-error` 來強制調用時不傳入參數
    2. 或者重構代碼，將這些分支作為公開的測試輔助方法
    3. 或者接受這些分支作為"不可達代碼"（unreachable code）

## 結論

### 是否因為代碼寫法導致無法提升？

**部分是的**，但這是**合理的設計決策**：

1. **防禦性編程**: 未覆蓋的代碼主要是防禦性編程，用於處理極端情況
2. **早期返回模式**: `reloadSinglePrompt` 使用大量早期返回，這使得最外層 catch 很難被觸發
3. **類型安全**: TypeScript 的類型系統保證了 `createPromptRuntime` 的調用模式，使得某些分支在實際使用中不可達

### 改進建議

#### 選項 1: 接受現狀（推薦）

-   77% 的覆蓋率已經超過目標（75%）
-   未覆蓋的代碼是防禦性編程，在實際使用中幾乎不會被觸發
-   繼續提升的成本（時間和複雜度）可能超過收益

#### 選項 2: 重構以提高可測試性

如果要達到更高的覆蓋率，可以考慮：

1. **將 `createPromptRuntime` 的 else 分支提取為獨立方法**:

    ```typescript
    private determineRuntimeStateFromMetadata(
        metadata: PromptMetadata | null,
        runtimeState?: PromptRuntimeState,
        source?: PromptSource
    ): { state: PromptRuntimeState; source: PromptSource } {
        if (runtimeState !== undefined && source !== undefined) {
            return { state: runtimeState, source }
        } else if (metadata) {
            return { state: "active", source: "embedded" }
        } else {
            return { state: "legacy", source: "legacy" }
        }
    }
    ```

    這樣可以單獨測試這個方法。

2. **為 `reloadSinglePrompt` 的最外層 catch 添加特定錯誤模擬**:
    ```typescript
    // 在測試中模擬 path.relative 拋出錯誤
    vi.spyOn(path, "relative").mockImplementation(() => {
        throw new Error("Path error")
    })
    ```

#### 選項 3: 標記為不可達代碼

如果確定這些分支在實際使用中不可達，可以使用 TypeScript 的註解：

```typescript
} else if (metadata) {
    // @ts-expect-error - This branch is unreachable in current implementation
    finalSource = "embedded"
    finalRuntimeState = "active"
}
```

## 建議

**保持現狀**。77% 的覆蓋率已經很好，未覆蓋的代碼主要是防禦性編程，在實際使用中幾乎不會被觸發。繼續提升的成本可能超過收益。

如果要提升到 80%+，建議：

1. 先處理 branches 覆蓋率（67.81% < 70%）
2. 考慮重構 `createPromptRuntime` 以提高可測試性
3. 為 `reloadSinglePrompt` 的最外層 catch 添加特定錯誤模擬測試
