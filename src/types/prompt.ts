/**
 * Prompt 參數類型定義
 */
export type PromptArgType = "string" | "number" | "boolean"

/**
 * Prompt 參數定義
 */
export interface PromptArgDefinition {
    readonly type: PromptArgType
    readonly description?: string
}

/**
 * Prompt 定義介面
 */
export interface PromptDefinition {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly args?: Readonly<Record<string, PromptArgDefinition>>
    readonly template: string
}
