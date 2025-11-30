import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs/promises"
import path from "path"
import os from "os"
import yaml from "js-yaml"
import Handlebars from "handlebars"

// 測試用的輔助函數（模擬 index.ts 中的邏輯）
async function getFilesRecursively(dir: string): Promise<string[]> {
    let results: string[] = []
    const list = await fs.readdir(dir)
    for (const file of list) {
        if (file.startsWith(".")) continue // 忽略 .git
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

// 群組過濾邏輯測試
function shouldLoadPrompt(
    filePath: string,
    storageDir: string,
    activeGroups: string[]
): boolean {
    const relativePath = path.relative(storageDir, filePath)
    const pathParts = relativePath.split(path.sep)

    const groupName = pathParts.length > 1 ? (pathParts[0] ?? "root") : "root"
    const isAlwaysActive = groupName === "root" || groupName === "common"
    const isSelected = activeGroups.includes(groupName)

    return isAlwaysActive || isSelected
}

describe("工具函數測試", () => {
    let testDir: string

    beforeEach(async () => {
        // 建立臨時測試目錄
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-test-"))
    })

    afterEach(async () => {
        // 清理臨時目錄
        await fs.rm(testDir, { recursive: true, force: true })
    })

    describe("getFilesRecursively", () => {
        it("應該遞迴讀取所有檔案", async () => {
            // 建立測試檔案結構
            await fs.mkdir(path.join(testDir, "subdir"))
            await fs.writeFile(path.join(testDir, "file1.txt"), "content1")
            await fs.writeFile(
                path.join(testDir, "subdir", "file2.txt"),
                "content2"
            )
            await fs.writeFile(
                path.join(testDir, "subdir", "file3.txt"),
                "content3"
            )

            const files = await getFilesRecursively(testDir)
            const fileNames = files.map((f) => path.basename(f)).sort()

            expect(fileNames).toEqual(["file1.txt", "file2.txt", "file3.txt"])
        })

        it("應該忽略以 . 開頭的檔案和目錄", async () => {
            await fs.writeFile(path.join(testDir, ".hidden"), "hidden")
            await fs.writeFile(path.join(testDir, "visible.txt"), "visible")
            await fs.mkdir(path.join(testDir, ".git"))
            await fs.writeFile(
                path.join(testDir, ".git", "config"),
                "git config"
            )

            const files = await getFilesRecursively(testDir)
            const fileNames = files.map((f) => path.basename(f))

            expect(fileNames).not.toContain(".hidden")
            expect(fileNames).not.toContain("config")
            expect(fileNames).toContain("visible.txt")
        })

        it("應該處理空目錄", async () => {
            const files = await getFilesRecursively(testDir)
            expect(files).toEqual([])
        })
    })

    describe("群組過濾邏輯", () => {
        it("應該永遠載入根目錄的檔案", () => {
            const filePath = path.join(testDir, "root-prompt.yaml")
            expect(shouldLoadPrompt(filePath, testDir, [])).toBe(true)
            expect(shouldLoadPrompt(filePath, testDir, ["laravel"])).toBe(true)
        })

        it("應該永遠載入 common 群組的檔案", () => {
            const commonDir = path.join(testDir, "common")
            const filePath = path.join(commonDir, "prompt.yaml")
            expect(shouldLoadPrompt(filePath, testDir, [])).toBe(true)
            expect(shouldLoadPrompt(filePath, testDir, ["laravel"])).toBe(true)
        })

        it("應該載入在 activeGroups 中的群組", () => {
            const laravelDir = path.join(testDir, "laravel")
            const filePath = path.join(laravelDir, "prompt.yaml")
            expect(shouldLoadPrompt(filePath, testDir, ["laravel"])).toBe(true)
            expect(shouldLoadPrompt(filePath, testDir, ["vue"])).toBe(false)
        })

        it("應該支援多個群組", () => {
            const vueDir = path.join(testDir, "vue")
            const filePath = path.join(vueDir, "prompt.yaml")
            expect(
                shouldLoadPrompt(filePath, testDir, ["laravel", "vue"])
            ).toBe(true)
            expect(shouldLoadPrompt(filePath, testDir, ["react"])).toBe(false)
        })
    })
})

describe("YAML 解析測試", () => {
    it("應該正確解析有效的 YAML", () => {
        const yamlContent = `
id: "test-prompt"
title: "測試 Prompt"
description: "這是一個測試"
args:
  code:
    type: "string"
    description: "程式碼"
template: "請審查 {{code}}"
`

        const parsed = yaml.load(yamlContent) as any

        expect(parsed.id).toBe("test-prompt")
        expect(parsed.title).toBe("測試 Prompt")
        expect(parsed.args.code.type).toBe("string")
        expect(parsed.template).toBe("請審查 {{code}}")
    })

    it("應該處理缺少欄位的 YAML", () => {
        const yamlContent = `
id: "test"
template: "簡單模板"
`

        const parsed = yaml.load(yamlContent) as any

        expect(parsed.id).toBe("test")
        expect(parsed.template).toBe("簡單模板")
        expect(parsed.args).toBeUndefined()
    })

    it("應該處理多種參數類型", () => {
        const yamlContent = `
id: "multi-args"
args:
  name:
    type: "string"
  age:
    type: "number"
  active:
    type: "boolean"
template: "{{name}} is {{age}} years old"
`

        const parsed = yaml.load(yamlContent) as any

        expect(parsed.args.name.type).toBe("string")
        expect(parsed.args.age.type).toBe("number")
        expect(parsed.args.active.type).toBe("boolean")
    })
})

describe("Handlebars 模板測試", () => {
    beforeEach(() => {
        // 清除之前的 partials
        Handlebars.unregisterPartial("test-partial")
    })

    it("應該正確渲染簡單模板", () => {
        const template = Handlebars.compile("Hello {{name}}")
        const result = template({ name: "World" })

        expect(result).toBe("Hello World")
    })

    it("應該支援條件語法", () => {
        const template = Handlebars.compile(
            "{{#if active}}Active{{else}}Inactive{{/if}}"
        )

        expect(template({ active: true })).toBe("Active")
        expect(template({ active: false })).toBe("Inactive")
    })

    it("應該支援 Partials", () => {
        Handlebars.registerPartial("greeting", "Hello {{name}}!")
        const template = Handlebars.compile("{{> greeting}}")

        const result = template({ name: "Carl" })

        expect(result).toBe("Hello Carl!")
    })

    it("應該自動注入系統變數", () => {
        const template = Handlebars.compile(
            "{{output_lang_rule}} - {{sys_lang}}"
        )
        const context = {
            output_lang_rule: "Please reply in English.",
            sys_lang: "en",
        }

        const result = template(context)

        expect(result).toBe("Please reply in English. - en")
    })

    it("應該處理複雜模板", () => {
        const template = Handlebars.compile(
            `
你是一位 {{language}} 工程師。
請審查以下程式碼：

\`\`\`
{{code}}
\`\`\`
        `.trim(),
            { noEscape: true }
        )

        const result = template({
            language: "TypeScript",
            code: "const x = 1",
        })

        expect(result).toContain("TypeScript")
        expect(result).toContain("const x = 1")
    })
})
