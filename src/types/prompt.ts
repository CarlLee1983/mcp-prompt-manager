/**
 * Prompt argument type definition
 *
 * Supported argument types: string, number, boolean
 */
export type PromptArgType = "string" | "number" | "boolean"

/**
 * Prompt argument definition
 *
 * Defines the structure of a Prompt argument, including type, description, and default value.
 *
 * @example
 * ```typescript
 * const arg: PromptArgDefinition = {
 *   type: 'string',
 *   description: 'Code to review',
 * }
 * ```
 *
 * @example
 * ```typescript
 * const optionalArg: PromptArgDefinition = {
 *   type: 'boolean',
 *   description: 'Enable strict mode',
 *   default: false,
 * }
 * ```
 */
export interface PromptArgDefinition {
    /** Argument type */
    readonly type: PromptArgType
    /** Argument description, may contain '(required)' or 'optional' keywords to indicate if required (for backward compatibility) */
    readonly description?: string
    /** Argument default value, if provided the argument is optional */
    readonly default?: string | number | boolean
    /** Whether the argument is required, explicitly specifying this field takes priority over parsing from description */
    readonly required?: boolean
}

/**
 * Prompt triggers definition
 *
 * Defines trigger patterns for when the prompt should be used.
 */
export interface PromptTriggers {
    /** List of trigger patterns that should activate this prompt */
    readonly patterns: readonly string[]
}

/**
 * Prompt definition interface
 *
 * Defines a complete Prompt template structure, including ID, title, description, arguments, and Handlebars template.
 *
 * @example
 * ```typescript
 * const prompt: PromptDefinition = {
 *   id: 'code-review',
 *   title: 'Code Review',
 *   description: 'Authority tool for comprehensive code review.',
 *   triggers: {
 *     patterns: ['review', 'check code']
 *   },
 *   rules: [
 *     'MUST use this tool when code review is requested',
 *     'Analyze code quality and security issues'
 *   ],
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
    /** Unique identifier for the Prompt */
    readonly id: string
    /** Title of the Prompt */
    readonly title: string
    /** Description of the Prompt */
    readonly description?: string
    /** Trigger patterns for when this prompt should be used */
    readonly triggers?: PromptTriggers
    /** Rules that must be followed when using this prompt */
    readonly rules?: readonly string[]
    /** Prompt argument definitions, key is argument name, value is argument definition */
    readonly args?: Readonly<Record<string, PromptArgDefinition>>
    /** Handlebars template string for generating the final Prompt content */
    readonly template: string
}
