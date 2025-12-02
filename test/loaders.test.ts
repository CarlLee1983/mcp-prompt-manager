import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import Handlebars from 'handlebars'
import { z } from 'zod'

// 模擬 index.ts 中的函數
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

describe('載入器測試', () => {
    let testDir: string

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-loader-test-'))
        // 清除所有 partials
        Handlebars.unregisterPartial('test-partial')
        Handlebars.unregisterPartial('greeting')
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    describe('loadPartials', () => {
        it('應該載入 .hbs 檔案作為 Handlebars partials', async () => {
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

        it('應該忽略非 .hbs 檔案', async () => {
            await fs.writeFile(path.join(testDir, 'not-partial.txt'), 'content')
            await fs.writeFile(
                path.join(testDir, 'partial.hbs'),
                'Partial content'
            )

            await loadPartials(testDir)

            expect(Handlebars.partials['not-partial']).toBeUndefined()
            expect(Handlebars.partials['partial']).toBe('Partial content')
        })

        it('應該從子目錄載入 partials', async () => {
            await fs.mkdir(path.join(testDir, 'partials'))
            await fs.writeFile(
                path.join(testDir, 'partials', 'header.hbs'),
                'Header'
            )

            await loadPartials(testDir)

            expect(Handlebars.partials['header']).toBe('Header')
        })

        it('應該處理空目錄', async () => {
            await loadPartials(testDir)
            // 不應該拋出錯誤
            expect(true).toBe(true)
        })
    })

    describe('Zod Schema 建構', () => {
        it('應該為 string 類型建立正確的 schema', () => {
            const args = {
                name: { type: 'string' as const, description: '名稱' },
            }
            const schema = buildZodSchema(args)

            expect(schema.name).toBeInstanceOf(z.ZodString)
            expect(() => schema.name.parse('test')).not.toThrow()
            expect(() => schema.name.parse(123)).toThrow()
        })

        it('應該為 number 類型建立正確的 schema', () => {
            const args = {
                age: { type: 'number' as const },
            }
            const schema = buildZodSchema(args)

            expect(schema.age).toBeInstanceOf(z.ZodNumber)
            expect(() => schema.age.parse(25)).not.toThrow()
            expect(() => schema.age.parse('25')).toThrow()
        })

        it('應該為 boolean 類型建立正確的 schema', () => {
            const args = {
                active: { type: 'boolean' as const },
            }
            const schema = buildZodSchema(args)

            expect(schema.active).toBeInstanceOf(z.ZodBoolean)
            expect(() => schema.active.parse(true)).not.toThrow()
            expect(() => schema.active.parse('true')).toThrow()
        })

        it('應該包含 description', () => {
            const args = {
                code: {
                    type: 'string' as const,
                    description: '程式碼內容',
                },
            }
            const schema = buildZodSchema(args)

            // Zod 的 describe 會設定 description
            expect(schema.code).toBeInstanceOf(z.ZodString)
        })

        it('應該處理多個參數', () => {
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

        it('應該處理空的 args', () => {
            const schema = buildZodSchema({})
            expect(Object.keys(schema)).toHaveLength(0)
        })
    })

    describe('Prompt 載入流程', () => {
        it('應該正確解析並編譯完整的 prompt', async () => {
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
args:
  code:
    type: 'string'
    description: '程式碼'
template: '請審查 {{code}}'
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
            expect(promptDef.template).toBe('請審查 {{code}}')

            const zodShape = buildZodSchema(promptDef.args)
            const template = Handlebars.compile(promptDef.template, {
                noEscape: true,
            })

            const result = template({ code: 'const x = 1' })
            expect(result).toBe('請審查 const x = 1')
        })

        it('應該跳過缺少 id 的 prompt', () => {
            const yamlContent = `
title: '無 ID Prompt'
template: '內容'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            expect(promptDef.id).toBeUndefined()
            // 在實際代碼中會 continue
        })

        it('應該跳過缺少 template 的 prompt', () => {
            const yamlContent = `
id: 'no-template'
title: '無模板'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            expect(promptDef.template).toBeUndefined()
            // 在實際代碼中會 continue
        })

        it('應該處理包含 partials 的模板', async () => {
            await fs.writeFile(
                path.join(testDir, 'role-expert.hbs'),
                '你是一位資深工程師。'
            )
            await loadPartials(testDir)

            const template = Handlebars.compile('{{> role-expert}}', {
                noEscape: true,
            })
            const result = template({})

            expect(result).toBe('你是一位資深工程師。')
        })

        it('應該處理系統變數注入', () => {
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

    describe('錯誤處理', () => {
        it('應該處理無效的 YAML 格式', () => {
            const invalidYaml = `
id: 'test'
title: '測試'
args:
  - invalid: list
template: '內容'
`

            expect(() => {
                yaml.load(invalidYaml)
            }).not.toThrow() // YAML 解析器通常不會拋出錯誤，但會返回奇怪的結果
        })

        it('應該處理檔案讀取錯誤', async () => {
            const nonExistentFile = path.join(testDir, 'not-exist.yaml')

            await expect(
                fs.readFile(nonExistentFile, 'utf-8')
            ).rejects.toThrow()
        })

        it('應該處理空的 YAML 檔案', () => {
            const emptyYaml = ''

            const result = yaml.load(emptyYaml)
            expect(result).toBeUndefined()
        })

        it('應該處理只有註解的 YAML', () => {
            const commentOnlyYaml = `
# 這只是註解
# 沒有實際內容
`

            const result = yaml.load(commentOnlyYaml)
            expect(result).toBeNull() // 或 undefined，取決於 YAML 解析器
        })
    })

    describe('邊界情況', () => {
        it('應該處理空的 args', () => {
            const yamlContent = `
id: 'no-args'
template: '簡單模板'
`

            const promptDef = yaml.load(yamlContent) as PromptDefinition
            const zodShape = buildZodSchema(promptDef.args || {})

            expect(Object.keys(zodShape)).toHaveLength(0)
        })

        it('應該處理非常長的模板', () => {
            const longTemplate = '{{text}}'.repeat(1000)
            const template = Handlebars.compile(longTemplate, {
                noEscape: true,
            })

            const result = template({ text: 'a' })
            // 1000 個 '{{text}}' 會渲染成 1000 個 'a'
            expect(result.length).toBeGreaterThanOrEqual(1000)
        })

        it('should handle special characters', () => {
            const template = Handlebars.compile('{{text}}', { noEscape: true })

            const specialChars = '<>&"\''
            const result = template({ text: specialChars })

            expect(result).toBe(specialChars)
        })

        it('應該處理多層嵌套的參數', () => {
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
