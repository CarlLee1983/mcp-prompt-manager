/**
 * Prompt 參數類型定義
 * 
 * 支援的參數類型：字串、數字、布林值
 */
export type PromptArgType = 'string' | 'number' | 'boolean'

/**
 * Prompt 參數定義
 * 
 * 定義一個 Prompt 參數的結構，包括類型、描述和預設值。
 * 
 * @example
 * ```typescript
 * const arg: PromptArgDefinition = {
 *   type: 'string',
 *   description: 'Code to review',
 *   required: true
 * }
 * ```
 * 
 * @example
 * ```typescript
 * const optionalArg: PromptArgDefinition = {
 *   type: 'boolean',
 *   description: 'Enable strict mode',
 *   default: false,
 *   required: false
 * }
 * ```
 */
export interface PromptArgDefinition {
    /** 參數類型 */
    readonly type: PromptArgType
    /** 參數描述，可包含 '(required)' 或 'optional' 關鍵字來標示是否為必需（用於向後相容） */
    readonly description?: string
    /** 參數預設值，如果提供則該參數為可選 */
    readonly default?: string | number | boolean
    /** 參數是否為必需，明確指定此欄位將優先於從 description 解析的結果 */
    readonly required?: boolean
}

/**
 * Prompt 定義介面
 * 
 * 定義一個完整的 Prompt 模板結構，包括 ID、標題、描述、參數和 Handlebars 模板。
 * 
 * @example
 * ```typescript
 * const prompt: PromptDefinition = {
 *   id: 'code-review',
 *   title: 'Code Review',
 *   description: 'Authority tool for comprehensive code review.',
 *   args: {
 *     code: {
 *       type: 'string',
 *       description: 'Code to review (required)'
 *     },
 *     language: {
 *       type: 'string',
 *       description: 'Programming language (optional)',
 *       default: ''
 *     }
 *   },
 *   template: '{{> role-expert}}\n\n# Code Review\n\n{{code}}'
 * }
 * ```
 */
export interface PromptDefinition {
    /** Prompt 的唯一識別碼 */
    readonly id: string
    /** Prompt 的標題 */
    readonly title: string
    /** Prompt 的描述，可包含 TRIGGER 和 RULES 資訊 */
    readonly description?: string
    /** Prompt 的參數定義，鍵為參數名稱，值為參數定義 */
    readonly args?: Readonly<Record<string, PromptArgDefinition>>
    /** Handlebars 模板字串，用於生成最終的 Prompt 內容 */
    readonly template: string
}
