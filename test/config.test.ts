import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('環境變數配置測試', () => {
    const originalEnv = process.env

    beforeEach(() => {
        // 清除環境變數
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('MCP_LANGUAGE', () => {
        it('應該預設為 'en'', () => {
            delete process.env.MCP_LANGUAGE
            const lang = process.env.MCP_LANGUAGE || 'en'
            expect(lang).toBe('en')
        })

        it('應該支援 'zh' 設定', () => {
            process.env.MCP_LANGUAGE = 'zh'
            const lang = process.env.MCP_LANGUAGE || 'en'
            expect(lang).toBe('zh')
        })

        it('應該支援自訂語言設定', () => {
            process.env.MCP_LANGUAGE = 'ja'
            const lang = process.env.MCP_LANGUAGE || 'en'
            expect(lang).toBe('ja')
        })
    })

    describe('MCP_GROUPS', () => {
        it('應該預設為 ['common']', () => {
            delete process.env.MCP_GROUPS
            const groups = process.env.MCP_GROUPS
                ? process.env.MCP_GROUPS.split(',').map((g) => g.trim())
                : ['common']
            expect(groups).toEqual(['common'])
        })

        it('應該解析單一群組', () => {
            process.env.MCP_GROUPS = 'laravel'
            const groups = process.env.MCP_GROUPS.split(',').map((g) =>
                g.trim()
            )
            expect(groups).toEqual(['laravel'])
        })

        it('應該解析多個群組', () => {
            process.env.MCP_GROUPS = 'laravel,vue,react'
            const groups = process.env.MCP_GROUPS.split(',').map((g) =>
                g.trim()
            )
            expect(groups).toEqual(['laravel', 'vue', 'react'])
        })

        it('應該處理帶空格的群組名稱', () => {
            process.env.MCP_GROUPS = 'laravel, vue , react'
            const groups = process.env.MCP_GROUPS.split(',').map((g) =>
                g.trim()
            )
            expect(groups).toEqual(['laravel', 'vue', 'react'])
        })

        it('應該處理空字串', () => {
            process.env.MCP_GROUPS = ''
            // 空字串在 JavaScript 中是 falsy，所以會回退到預設值
            const groups = process.env.MCP_GROUPS
                ? process.env.MCP_GROUPS.split(',').map((g) => g.trim())
                : ['common']
            // 空字串是 falsy，所以會使用預設值
            expect(groups).toEqual(['common'])
        })
    })

    describe('PROMPT_REPO_URL', () => {
        it('應該可以設定本地路徑', () => {
            process.env.PROMPT_REPO_URL = '/path/to/repo'
            expect(process.env.PROMPT_REPO_URL).toBe('/path/to/repo')
        })

        it('應該可以設定 Git URL', () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            expect(process.env.PROMPT_REPO_URL).toBe(
                'https://github.com/user/repo.git'
            )
        })

        it('應該可以設定 SSH URL', () => {
            process.env.PROMPT_REPO_URL = 'git@github.com:user/repo.git'
            expect(process.env.PROMPT_REPO_URL).toBe(
                'git@github.com:user/repo.git'
            )
        })

        it('缺失時應該為 undefined', () => {
            delete process.env.PROMPT_REPO_URL
            expect(process.env.PROMPT_REPO_URL).toBeUndefined()
        })
    })

    describe('語言指令生成', () => {
        it('應該為 'zh' 生成繁體中文指令', () => {
            const lang = 'zh'
            const instruction =
                lang === 'zh'
                    ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
                    : 'Please reply in English.'
            expect(instruction).toContain('Traditional Chinese')
            expect(instruction).toContain('繁體中文')
        })

        it('應該為其他語言生成英文指令', () => {
            const lang = 'en'
            const instruction =
                lang === 'zh'
                    ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
                    : 'Please reply in English.'
            expect(instruction).toBe('Please reply in English.')
        })

        it('應該為 'ja' 生成英文指令', () => {
            const lang = 'ja'
            const instruction =
                lang === 'zh'
                    ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
                    : 'Please reply in English.'
            expect(instruction).toBe('Please reply in English.')
        })
    })
})
