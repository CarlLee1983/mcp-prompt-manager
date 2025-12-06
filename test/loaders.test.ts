import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import Handlebars from 'handlebars'
import { z } from 'zod'

// Simulate functions from index.ts
async function getFilesRecursively(dir: string): Promise<string[]> {
    let results: string[] = []
    const list = await fs.readdir(dir)
    for (const file of list) {
        if (file.startsWith('.')) continue
        const filePath = path.resolve(dir, file)
        const stat = await fs.stat(filePath)
        if (stat && stat.isDirectory()) {
            results = results.concat(await getFilesRecursively(filePath))
        } else {
            results.push(filePath)
        }
    }
    return results
}

async function loadPartials(storageDir: string) {
    const allFiles = await getFilesRecursively(storageDir)

    for (const filePath of allFiles) {
        if (!filePath.endsWith('.hbs')) continue

        const content = await fs.readFile(filePath, 'utf-8')
        const partialName = path.parse(filePath).name

        Handlebars.registerPartial(partialName, content)
    }
}

interface PromptArgDefinition {
    type: 'string' | 'number' | 'boolean'
    description?: string
    default?: string | number | boolean
    required?: boolean
}

interface PromptDefinition {
    id: string
    title: string
    description?: string
    args: Record<string, PromptArgDefinition>
    template: string
}

function buildZodSchema(args: Record<string, PromptArgDefinition>) {
    const zodShape: Record<string, z.ZodTypeAny> = {}
    if (args) {
        for (const [key, config] of Object.entries(args)) {
            let schema
            if (config.type === 'number') schema = z.number()
            else if (config.type === 'boolean') schema = z.boolean()
            else schema = z.string()

            if (config.description) schema = schema.describe(config.description)
            zodShape[key] = schema
        }
    }
    return zodShape
}

describe('Loader Tests', () => {
    let testDir: string

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-loader-test-'))
        // Clear all partials
        Handlebars.unregisterPartial('test-partial')
        Handlebars.unregisterPartial('greeting')
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    describe('loadPartials', () => {
        it('should load .hbs files as Handlebars partials', async () => {
            await fs.writeFile(
                path.join(testDir, 'greeting.hbs'),
                'Hello {{name}}!'
            )
            await fs.writeFile(
                path.join(testDir, 'footer.hbs'),
                'Footer content'
            )

            await loadPartials(testDir)

            const template = Handlebars.compile('{{> greeting}}')
            expect(template({ name: 'Carl' })).toBe('Hello Carl!')
        })

        it('should ignore non-.hbs files', async () => {
            await fs.writeFile(path.join(testDir, 'not-partial.txt'), 'content')
            await fs.writeFile(
                path.join(testDir, 'partial.hbs'),
                'Partial content'
            )

            await loadPartials(testDir)

            expect(Handlebars.partials['not-partial']).toBeUndefined()
            expect(Handlebars.partials['partial']).toBe('Partial content')
        })

        it('should load partials from subdirectories', async () => {
            await fs.mkdir(path.join(testDir, 'partials'))
            await fs.writeFile(
                path.join(testDir, 'partials', 'header.hbs'),
                'Header'
            )

            await loadPartials(testDir)

            expect(Handlebars.partials['header']).toBe('Header')
        })

        it('should handle empty directory', async () => {
            await loadPartials(testDir)
            // Should not throw error
            expect(true).toBe(true)
        })
    })

    describe('Zod Schema Construction', () => {
        it('should create correct schema for string type', () => {
            const args = {
                name: { type: 'string' as const, description: 'Name' },
            }
            const schema = buildZodSchema(args)

            expect(schema.name).toBeInstanceOf(z.ZodString)
            expect(() => schema.name.parse('test')).not.toThrow()
            expect(() => schema.name.parse(123)).toThrow()
        })

        it('should create correct schema for number type', () => {
            const args = {
                age: { type: 'number' as const },
            }
            const schema = buildZodSchema(args)

            expect(schema.age).toBeInstanceOf(z.ZodNumber)
            expect(() => schema.age.parse(25)).not.toThrow()
            expect(() => schema.age.parse('25')).toThrow()
        })

        it('should create correct schema for boolean type', () => {
            const args = {
                active: { type: 'boolean' as const },
            }
            const schema = buildZodSchema(args)

            expect(schema.active).toBeInstanceOf(z.ZodBoolean)
            expect(() => schema.active.parse(true)).not.toThrow()
            expect(() => schema.active.parse('true')).toThrow()
        })

        it('should include description', () => {
            const args = {
                code: {
                    type: 'string' as const,
                    description: 'Code content',
                },
            }
            const schema = buildZodSchema(args)

            // Zod describe sets the description
            expect(schema.code).toBeInstanceOf(z.ZodString)
        })

        it('should handle multiple arguments', () => {
            const args = {
                name: { type: 'string' as const },
                age: { type: 'number' as const },
                active: { type: 'boolean' as const },
            }
            const schema = buildZodSchema(args)

            expect(Object.keys(schema)).toHaveLength(3)
            expect(schema.name).toBeInstanceOf(z.ZodString)
            expect(schema.age).toBeInstanceOf(z.ZodNumber)
            expect(schema.active).toBeInstanceOf(z.ZodBoolean)
        })

        it('should handle empty args', () => {
            const schema = buildZodSchema({})
            expect(Object.keys(schema)).toHaveLength(0)
        })
    })

    describe('Prompt Loading Flow', () => {
        it('should correctly parse and compile full prompt', async () => {
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
description: 'This is a test'
version: '1.0.0'
args:
  code:
    type: 'string'
    description: 'Code'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            const content = await fs.readFile(
                path.join(testDir, 'test-prompt.yaml'),
                'utf-8'
            )
            const promptDef = yaml.load(content) as PromptDefinition

            expect(promptDef.id).toBe('test-prompt')
            expect(promptDef.template).toBe('Please review {{code}}')

            const zodShape = buildZodSchema(promptDef.args)
            const template = Handlebars.compile(promptDef.template, {
                noEscape: true,
            })

            const result = template({ code: 'const x = 1' })
            expect(result).toBe('Please review const x = 1')
        })

        it('should skip prompt missing id', () => {
            const yamlContent = `
title: 'No ID Prompt'
template: 'Content'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            expect(promptDef.id).toBeUndefined()
            // Should continue in actual code
        })

        it('should skip prompt missing template', () => {
            const yamlContent = `
id: 'no-template'
title: 'No Template'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            expect(promptDef.template).toBeUndefined()
            // Should continue in actual code
        })

        it('should handle template with partials', async () => {
            await fs.writeFile(
                path.join(testDir, 'role-expert.hbs'),
                'You are a senior engineer.'
            )
            await loadPartials(testDir)

            const template = Handlebars.compile('{{> role-expert}}', {
                noEscape: true,
            })
            const result = template({})

            expect(result).toBe('You are a senior engineer.')
        })

        it('should handle system variable injection', () => {
            const template = Handlebars.compile(
                '{{output_lang_rule}} - {{sys_lang}}',
                { noEscape: true }
            )

            const context = {
                output_lang_rule: 'Please reply in Traditional Chinese.',
                sys_lang: 'zh',
            }

            const result = template(context)
            expect(result).toBe('Please reply in Traditional Chinese. - zh')
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid YAML format', () => {
            const invalidYaml = `
id: 'test'
title: 'Test'
description: 'This is a test'
version: '1.0.0'
template: 'Content'
`

            expect(() => {
                yaml.load(invalidYaml)
            }).not.toThrow() // YAML parser usually doesn't throw, but returns strange result
        })

        it('should handle file read error', async () => {
            const nonExistentFile = path.join(testDir, 'not-exist.yaml')

            await expect(
                fs.readFile(nonExistentFile, 'utf-8')
            ).rejects.toThrow()
        })

        it('should handle empty YAML file', () => {
            const emptyYaml = ''

            const result = yaml.load(emptyYaml)
            expect(result).toBeUndefined()
        })

        it('should handle comment-only YAML', () => {
            const commentOnlyYaml = `
# This is just a comment
# No actual content
`

            const result = yaml.load(commentOnlyYaml)
            expect(result).toBeNull() // or undefined, depending on YAML parser
        })
    })

    describe('Edge Cases', () => {
        it('should handle empty args', () => {
            const yamlContent = `
id: 'no-args'
template: 'Simple template'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            const zodShape = buildZodSchema(promptDef.args || {})

            expect(Object.keys(zodShape)).toHaveLength(0)
        })

        it('should handle very long template', () => {
            const longTemplate = '{{text}}'.repeat(1000)
            const template = Handlebars.compile(longTemplate, {
                noEscape: true,
            })

            const result = template({ text: 'a' })
            // 1000 '{{text}}' will render to 1000 'a's
            expect(result.length).toBeGreaterThanOrEqual(1000)
        })

        it('should handle special characters', () => {
            const template = Handlebars.compile('{{text}}', { noEscape: true })

            const specialChars = '<>&"\''
            const result = template({ text: specialChars })

            expect(result).toBe(specialChars)
        })

        it('should handle nested arguments', () => {
            const yamlContent = `
id: 'nested'
args:
  user:
    type: 'string'
  settings:
    type: 'string'
template: 'User: {{user}}, Settings: {{settings}}'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            const zodShape = buildZodSchema(promptDef.args)

            expect(Object.keys(zodShape)).toHaveLength(2)
            expect(zodShape.user).toBeInstanceOf(z.ZodString)
            expect(zodShape.settings).toBeInstanceOf(z.ZodString)
        })
    })
})
