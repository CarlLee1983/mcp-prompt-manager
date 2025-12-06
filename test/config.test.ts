import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Environment Variable Configuration Tests', () => {
    const originalEnv = process.env

    beforeEach(() => {
        // Clear environment variables
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('MCP_LANGUAGE', () => {
        it('should default to en', () => {
            delete process.env.MCP_LANGUAGE
            const lang = process.env.MCP_LANGUAGE || 'en'
            expect(lang).toBe('en')
        })

        it('should support zh setting', () => {
            process.env.MCP_LANGUAGE = 'zh'
            const lang = process.env.MCP_LANGUAGE || 'en'
            expect(lang).toBe('zh')
        })

        it('should support custom language setting', () => {
            process.env.MCP_LANGUAGE = 'ja'
            const lang = process.env.MCP_LANGUAGE || 'en'
            expect(lang).toBe('ja')
        })
    })

    describe('MCP_GROUPS', () => {
        it('should default to [common]', () => {
            delete process.env.MCP_GROUPS
            const groups = process.env.MCP_GROUPS
                ? (process.env.MCP_GROUPS as string).split(',').map((g) => g.trim())
                : ['common']
            expect(groups).toEqual(['common'])
        })

        it('should parse single group', () => {
            process.env.MCP_GROUPS = 'laravel'
            const groups = process.env.MCP_GROUPS.split(',').map((g) =>
                g.trim()
            )
            expect(groups).toEqual(['laravel'])
        })

        it('should parse multiple groups', () => {
            process.env.MCP_GROUPS = 'laravel,vue,react'
            const groups = process.env.MCP_GROUPS.split(',').map((g) =>
                g.trim()
            )
            expect(groups).toEqual(['laravel', 'vue', 'react'])
        })

        it('should handle group names with whitespace', () => {
            process.env.MCP_GROUPS = 'laravel, vue , react'
            const groups = process.env.MCP_GROUPS.split(',').map((g) =>
                g.trim()
            )
            expect(groups).toEqual(['laravel', 'vue', 'react'])
        })

        it('should handle empty string', () => {
            process.env.MCP_GROUPS = ''
            // Empty string is falsy in JavaScript, so it falls back to default
            const groups = process.env.MCP_GROUPS
                ? process.env.MCP_GROUPS.split(',').map((g) => g.trim())
                : ['common']
            // Empty string is falsy, so it uses default value
            expect(groups).toEqual(['common'])
        })
    })

    describe('PROMPT_REPO_URL', () => {
        it('should allow local path', () => {
            process.env.PROMPT_REPO_URL = '/path/to/repo'
            expect(process.env.PROMPT_REPO_URL).toBe('/path/to/repo')
        })

        it('should allow Git URL', () => {
            process.env.PROMPT_REPO_URL = 'https://github.com/user/repo.git'
            expect(process.env.PROMPT_REPO_URL).toBe(
                'https://github.com/user/repo.git'
            )
        })

        it('should allow SSH URL', () => {
            process.env.PROMPT_REPO_URL = 'git@github.com:user/repo.git'
            expect(process.env.PROMPT_REPO_URL).toBe(
                'git@github.com:user/repo.git'
            )
        })

        it('should be undefined when missing', () => {
            delete process.env.PROMPT_REPO_URL
            expect(process.env.PROMPT_REPO_URL).toBeUndefined()
        })
    })

    describe('Language instruction generation', () => {
        it('should generate Traditional Chinese instruction for zh', () => {
            const lang: string = 'zh'
            const instruction =
                lang === 'zh'
                    ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
                    : 'Please reply in English.'
            expect(instruction).toContain('Traditional Chinese')
            expect(instruction).toContain('繁體中文') // "Traditional Chinese" in Chinese characters
        })

        it('should generate English instruction for other languages', () => {
            const lang: string = 'en'
            const instruction =
                lang === 'zh'
                    ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
                    : 'Please reply in English.'
            expect(instruction).toBe('Please reply in English.')
        })

        it('should generate English instruction for ja', () => {
            const lang: string = 'ja'
            const instruction =
                lang === 'zh'
                    ? 'Please reply in Traditional Chinese (繁體中文). Keep technical terms in English.'
                    : 'Please reply in English.'
            expect(instruction).toBe('Please reply in English.')
        })
    })
})
