/**
 * Prompt Runtime State
 * 表示 prompt 在執行時期的狀態
 */
export type PromptRuntimeState = 'active' | 'legacy' | 'invalid' | 'disabled' | 'warning'

/**
 * Prompt Source
 * 表示 prompt metadata 的來源
 */
export type PromptSource = 'embedded' | 'registry' | 'legacy'

/**
 * Prompt Runtime Object
 * 完整的 prompt runtime 資訊
 */
export interface PromptRuntime {
    id: string
    title: string
    version: string
    status: 'draft' | 'stable' | 'deprecated' | 'legacy'
    tags: string[]
    use_cases: string[]
    runtime_state: PromptRuntimeState
    source: PromptSource
    group?: string
    visibility?: 'public' | 'private' | 'internal'
}

