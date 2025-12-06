import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPrompt } from '../src/services/loaders.js'
import { SourceManager } from '../src/services/sourceManager.js'
import { LANG_INSTRUCTION, LANG_SETTING } from '../src/config/env.js'
import { z } from 'zod'

/**
 * Simulate the full process of the preview_prompt tool
 */
async function simulatePreviewPrompt(
    promptId: string,
    args: Record<string, unknown>
): Promise<{
    success: boolean
    renderedText?: string
    highlightedText?: string
    statistics?: { renderedLength: number; estimatedTokens: number }
    warnings?: string[]
    error?: string
}> {
    // 1. Get prompt
    const cachedPrompt = getPrompt(promptId)
    if (!cachedPrompt) {
        return {
            success: false,
            error: `Prompt not found: ${promptId}`,
        }
    }

    // 2. Validate arguments
    const zodSchema = Object.keys(cachedPrompt.zodShape).length > 0
        ? z.object(cachedPrompt.zodShape)
        : z.object({})

    const validationResult = zodSchema.safeParse(args)
    if (!validationResult.success) {
        return {
            success: false,
            error: 'Validation failed',
        }
    }

    // 3. Render template
    try {
        const context = {
            ...validationResult.data,
            output_lang_rule: LANG_INSTRUCTION,
            sys_lang: LANG_SETTING,
        }

        const renderedText = cachedPrompt.compiledTemplate(context)

        // 4. Calculate statistics
        const renderedLength = renderedText.length
        const estimatedTokens = estimateTokens(renderedText)

        // 5. Generate highlighted version
        const highlightedText = highlightVariables(
            cachedPrompt.metadata.template,
            renderedText,
            context
        )

        // 6. Check warnings
        const warnings = checkSchemaWarnings(cachedPrompt.zodShape, args)

        return {
            success: true,
            renderedText,
            highlightedText,
            statistics: {
                renderedLength,
                estimatedTokens,
            },
            warnings,
        }
    } catch (error) {
        return {
            success: false,
            error: `Template rendering failed: ${error instanceof Error ? error.message : String(error)}`,
        }
    }
}

function estimateTokens(text: string): number {
    const chineseRegex = /[\u4e00-\u9fff]/g
    const chineseChars = (text.match(chineseRegex) || []).length
    const otherChars = text.length - chineseChars
    const chineseTokens = Math.ceil(chineseChars / 1.5)
    const otherTokens = Math.ceil(otherChars / 4)
    return chineseTokens + otherTokens
}

function highlightVariables(
    template: string,
    renderedText: string,
    context: Record<string, unknown>
): string {
    let highlightedText = renderedText
    const variableEntries = Object.entries(context)
        .filter(([key]) => key !== 'output_lang_rule' && key !== 'sys_lang')
        .map(([key, value]) => [key, String(value ?? '')])
        .filter(([, value]) => value && value.length > 0) as [string, string][]

    variableEntries.sort((a, b) => b[1].length - a[1].length)

    for (const [, value] of variableEntries) {
        if (value.length < 2) continue
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        let regex: RegExp
        if (/^[a-zA-Z0-9_]+$/.test(value)) {
            regex = new RegExp(`\\b${escapedValue}\\b`, 'g')
        } else {
            regex = new RegExp(escapedValue.replace(/\s+/g, '\\s+'), 'g')
        }
        highlightedText = highlightedText.replace(regex, (match) => {
            if (match.startsWith('**') && match.endsWith('**')) {
                return match
            }
            return `**${value}**`
        })
    }
    return highlightedText
}

function checkSchemaWarnings(
    zodShape: z.ZodRawShape,
    providedArgs: Record<string, unknown>
): string[] {
    const warnings: string[] = []
    const providedKeys = new Set(Object.keys(providedArgs))

    for (const [key, schema] of Object.entries(zodShape)) {
        if (!providedKeys.has(key)) {
            const schemaDef = (schema as any)._def
            const isOptional = schemaDef?.typeName === 'ZodOptional' ||
                schemaDef?.typeName === 'ZodDefault' ||
                schema instanceof z.ZodOptional ||
                schema instanceof z.ZodDefault

            if (isOptional) {
                const description = schemaDef?.description ||
                    (schema as any).description ||
                    ''
                if (description.toLowerCase().includes('recommended') ||
                    description.toLowerCase().includes('suggested')) {
                    warnings.push(`Missing recommended field: '${key}'`)
                }
            } else {
                warnings.push(`Missing required field: '${key}'`)
            }
        }
    }
    return warnings
}

describe('preview_prompt integration tests', () => {
    let testDir: string
    let server: McpServer
    const originalEnv = process.env

    beforeEach(async () => {
        process.env.PROMPT_REPO_URL = '/tmp/test-repo'
        process.env.MCP_GROUPS = 'common'
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-preview-integration-'))
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        })
        SourceManager.getInstance().clearAllPrompts()
    })

    afterEach(() => {
        process.env = originalEnv
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    it('should simulate the full execution flow of the preview_prompt tool', async () => {
        const yamlContent = `
id: 'laravel:code-review'
title: 'Laravel Code Review'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
    description: 'Code to review (required)'
  language:
    type: 'string'
    description: 'Programming language (optional)'
template: 'Please review the following {{language}} code:\n\n{{code}}'
`
        await fs.writeFile(path.join(testDir, 'laravel-code-review.yaml'), yamlContent)

        const sourceManager = SourceManager.getInstance()
        await sourceManager.loadPrompts(server, testDir)

        // Simulate preview_prompt call
        const result = await simulatePreviewPrompt('laravel:code-review', {
            code: 'function test() { return true; }',
            language: 'PHP',
        })

        // Verify result
        expect(result.success).toBe(true)
        expect(result.renderedText).toBeDefined()
        expect(result.renderedText).toContain('PHP')
        expect(result.renderedText).toContain('function test()')

        expect(result.highlightedText).toBeDefined()
        expect(result.highlightedText).toContain('**PHP**')
        expect(result.highlightedText).toContain('**function test() { return true; }**')

        expect(result.statistics).toBeDefined()
        expect(result.statistics!.renderedLength).toBeGreaterThan(0)
        expect(result.statistics!.estimatedTokens).toBeGreaterThan(0)

        expect(result.warnings).toBeDefined()
        expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('should handle non-existent prompt', async () => {
        const result = await simulatePreviewPrompt('non-existent-prompt', {})
        expect(result.success).toBe(false)
        expect(result.error).toContain('Prompt not found')
    })

    it('should handle argument validation failure', async () => {
        const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
    description: 'Code to review (required)'
template: 'Review {{code}}'
`
        await fs.writeFile(path.join(testDir, 'test-prompt.yaml'), yamlContent)

        const sourceManager = SourceManager.getInstance()
        await sourceManager.loadPrompts(server, testDir)

        // Missing required fields
        const result = await simulatePreviewPrompt('test-prompt', {})
        expect(result.success).toBe(false)
        expect(result.error).toContain('Validation failed')
    })

    it('should return complete statistics', async () => {
        const yamlContent = `
id: 'stats-test-prompt'
title: 'Stats Test'
version: '1.0.0'
status: 'stable'
template: 'This is a test message with mixed content.'
`
        await fs.writeFile(path.join(testDir, 'stats-test-prompt.yaml'), yamlContent)

        const sourceManager = SourceManager.getInstance()
        await sourceManager.loadPrompts(server, testDir)

        const result = await simulatePreviewPrompt('stats-test-prompt', {})
        expect(result.success).toBe(true)
        expect(result.statistics).toBeDefined()
        expect(result.statistics!.renderedLength).toBeGreaterThan(0)
        expect(result.statistics!.estimatedTokens).toBeGreaterThan(0)

        // Verify token estimation is reasonable (should be > 0 and related to text length)
        expect(result.statistics!.estimatedTokens).toBeGreaterThan(0)
        expect(result.statistics!.estimatedTokens).toBeLessThan(result.statistics!.renderedLength)
    })
})

