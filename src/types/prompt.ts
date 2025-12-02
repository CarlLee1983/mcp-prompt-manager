/**
 * Prompt argument type definition
 * 
 * Supported argument types: string, number, boolean
 */
export type PromptArgType = 'string' | 'number' | 'boolean'

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
    /** Description of the Prompt, may contain TRIGGER and RULES information */
    readonly description?: string
    /** Prompt argument definitions, key is argument name, value is argument definition */
    readonly args?: Readonly<Record<string, PromptArgDefinition>>
    /** Handlebars template string for generating the final Prompt content */
    readonly template: string
}
