/**
 * Prompt Runtime State
 * Represents the runtime state of a prompt
 */
export type PromptRuntimeState = 'active' | 'legacy' | 'invalid' | 'disabled' | 'warning'

/**
 * Prompt Source
 * Represents the source of prompt metadata
 */
export type PromptSource = 'embedded' | 'registry' | 'legacy'

/**
 * Prompt Runtime Object
 * Complete prompt runtime information
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

