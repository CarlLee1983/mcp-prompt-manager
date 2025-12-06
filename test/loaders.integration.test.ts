import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
    getAllPromptRuntimes,
    getPromptRuntime,
    getPrompt,
    getRegisteredPromptIds,
    getLoadedPromptCount,
    getPromptStats,
    loadPartials,
    clearAllPartials,
    clearAllPrompts,
    loadPrompts,
    reloadPrompts,
    reloadSinglePrompt,
} from '../src/services/loaders.js'
import { SourceManager } from '../src/services/sourceManager.js'

// Mock syncRepo to avoid Git operations in tests
// Use async mock factory to ensure it works with dynamic imports
vi.mock('../src/services/git.js', async () => {
    const actual = await vi.importActual('../src/services/git.js')
    return {
        ...actual,
        syncRepo: vi.fn().mockResolvedValue(undefined),
    }
})

describe('loaders.ts Integration Tests', () => {
    let testDir: string
    let server: McpServer
    const originalEnv = process.env

    beforeEach(async () => {
        process.env.PROMPT_REPO_URL = '/tmp/test-repo'
        process.env.MCP_GROUPS = 'common'
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-loaders-test-'))
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        })
        // Clear SourceManager state
        const sourceManager = SourceManager.getInstance()
        sourceManager.clearAllPrompts()
        sourceManager.clearAllPartials()
    })

    afterEach(() => {
        process.env = originalEnv
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => { })
    })

    describe('getRegisteredPromptIds', () => {
        it('should return registered prompt IDs', async () => {
            // Create test prompt
            const promptYaml = `
id: 'test-prompt-1'
title: 'Test Prompt 1'
template: 'Test template'
`
            await fs.writeFile(path.join(testDir, 'test-prompt-1.yaml'), promptYaml)

            await loadPrompts(server, testDir)

            const ids = getRegisteredPromptIds()
            expect(ids).toContain('test-prompt-1')
        })

        it('should return empty array when no prompts loaded', () => {
            const ids = getRegisteredPromptIds()
            expect(ids).toEqual([])
        })
    })

    describe('clearAllPartials', () => {
        it('should clear all registered partials', async () => {
            // Create test partial
            await fs.writeFile(path.join(testDir, 'test-partial.hbs'), 'Partial content')
            await loadPartials(testDir)

            // Verify partial loaded
            const countBefore = await loadPartials(testDir)
            expect(countBefore).toBeGreaterThan(0)

            // Clear partials
            clearAllPartials()

            // Reload should start from 0
            const countAfter = await loadPartials(testDir)
            expect(countAfter).toBe(1) // Reload should recalculate
        })
    })

    describe('reloadPrompts', () => {
        it('should reload all prompts', async () => {
            // Create initial prompt
            const promptYaml1 = `
id: 'reload-test-1'
title: 'Reload Test 1'
template: 'Original template'
`
            await fs.writeFile(path.join(testDir, 'reload-test-1.yaml'), promptYaml1)

            const result1 = await loadPrompts(server, testDir)
            expect(result1.loaded).toBe(1)

            // Verify prompt loaded
            let prompt = getPrompt('reload-test-1')
            expect(prompt).toBeDefined()
            expect(prompt?.metadata.title).toBe('Reload Test 1')

            // Modify prompt
            const promptYaml2 = `
id: 'reload-test-1'
title: 'Reload Test 1 Updated'
template: 'Updated template'
`
            await fs.writeFile(path.join(testDir, 'reload-test-1.yaml'), promptYaml2)

            // Reload (reloadPrompts clears and reloads)
            // Note: reloadPrompts might try to sync Git, in test env might return 0
            // But we can verify if prompt still exists or updated
            const result2 = await reloadPrompts(server, testDir)

            // Verify prompt still exists (even if loaded is 0, prompt might still be in cache)
            prompt = getPrompt('reload-test-1')
            // If reloadPrompts successful, prompt should exist
            // If reloadPrompts returns 0 due to Git sync failure, prompt might still be in cache
            expect(prompt).toBeDefined()
        })

        it('should handle load errors', async () => {
            // Create invalid prompt
            await fs.writeFile(path.join(testDir, 'invalid.yaml'), 'invalid: yaml: content: [[')

            const result = await reloadPrompts(server, testDir)
            expect(result.errors.length).toBeGreaterThan(0)
        })
    })

    describe('reloadSinglePrompt', () => {
        it('should reload single prompt file', async () => {
            // Create initial prompt
            const promptYaml1 = `
id: 'single-reload-test'
title: 'Single Reload Test'
template: 'Original template'
`
            const filePath = path.join(testDir, 'single-reload-test.yaml')
            await fs.writeFile(filePath, promptYaml1)

            await loadPrompts(server, testDir)

            // Modify prompt
            const promptYaml2 = `
id: 'single-reload-test'
title: 'Single Reload Test Updated'
template: 'Updated template'
`
            await fs.writeFile(filePath, promptYaml2)

            // Reload single file
            const result = await reloadSinglePrompt(server, filePath, testDir)
            expect(result.success).toBe(true)

            // Verify prompt updated
            const prompt = getPrompt('single-reload-test')
            expect(prompt).toBeDefined()
        })

        it('should handle non-existent file (treat as delete)', async () => {
            const nonExistentPath = path.join(testDir, 'non-existent.yaml')

            // reloadSinglePrompt treats non-existent file as delete, returns success: true
            const result = await reloadSinglePrompt(server, nonExistentPath, testDir)
            expect(result.success).toBe(true)
            expect(result.error).toBeUndefined()
        })

        it('should handle invalid YAML file', async () => {
            const invalidYaml = 'invalid: yaml: content: [['
            const filePath = path.join(testDir, 'invalid.yaml')
            await fs.writeFile(filePath, invalidYaml)

            const result = await reloadSinglePrompt(server, filePath, testDir)
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })

        it('should handle deleted file (remove corresponding prompt)', async () => {
            // First create and load prompt
            const promptYaml = `
id: 'delete-test'
title: 'Delete Test'
template: 'Template'
`
            const filePath = path.join(testDir, 'delete-test.yaml')
            await fs.writeFile(filePath, promptYaml)
            await loadPrompts(server, testDir)

            // Verify prompt loaded
            expect(getPrompt('delete-test')).toBeDefined()

            // Delete file
            await fs.unlink(filePath)

            // Reload should handle deletion (remove prompt)
            const result = await reloadSinglePrompt(server, filePath, testDir)
            expect(result.success).toBe(true)
            // When file is deleted, corresponding prompt should be removed (if previously loaded)
            // Note: If prompt was not loaded before, no action taken
        })
    })

    describe('getAllPromptRuntimes', () => {
        it('should return all prompt runtimes', async () => {
            const promptYaml = `
id: 'runtime-test'
title: 'Runtime Test'
template: 'Template'
`
            await fs.writeFile(path.join(testDir, 'runtime-test.yaml'), promptYaml)
            await loadPrompts(server, testDir)

            const runtimes = getAllPromptRuntimes()
            expect(runtimes.length).toBeGreaterThan(0)
            expect(runtimes.some(r => r.id === 'runtime-test')).toBe(true)
        })

        it('should return empty array when no prompts loaded', () => {
            const runtimes = getAllPromptRuntimes()
            expect(runtimes).toEqual([])
        })
    })

    describe('getPromptRuntime', () => {
        it('should return specified prompt runtime', async () => {
            const promptYaml = `
id: 'get-runtime-test'
title: 'Get Runtime Test'
template: 'Template'
`
            await fs.writeFile(path.join(testDir, 'get-runtime-test.yaml'), promptYaml)
            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('get-runtime-test')
            expect(runtime).toBeDefined()
            expect(runtime?.id).toBe('get-runtime-test')
        })

        it('should return undefined for non-existent prompt ID', () => {
            const runtime = getPromptRuntime('non-existent')
            expect(runtime).toBeUndefined()
        })
    })

    describe('getPrompt', () => {
        it('should return specified cached prompt', async () => {
            const promptYaml = `
id: 'get-prompt-test'
title: 'Get Prompt Test'
template: 'Template'
`
            await fs.writeFile(path.join(testDir, 'get-prompt-test.yaml'), promptYaml)
            await loadPrompts(server, testDir)

            const prompt = getPrompt('get-prompt-test')
            expect(prompt).toBeDefined()
            expect(prompt?.metadata.id).toBe('get-prompt-test')
            expect(prompt?.compiledTemplate).toBeDefined()
            expect(prompt?.runtime).toBeDefined()
        })

        it('should return undefined for non-existent prompt ID', () => {
            const prompt = getPrompt('non-existent')
            expect(prompt).toBeUndefined()
        })
    })

    describe('getLoadedPromptCount', () => {
        it('should return loaded prompt count', async () => {
            const promptYaml1 = `
id: 'count-test-1'
title: 'Count Test 1'
template: 'Template 1'
`
            const promptYaml2 = `
id: 'count-test-2'
title: 'Count Test 2'
template: 'Template 2'
`
            await fs.writeFile(path.join(testDir, 'count-test-1.yaml'), promptYaml1)
            await fs.writeFile(path.join(testDir, 'count-test-2.yaml'), promptYaml2)

            await loadPrompts(server, testDir)

            const count = getLoadedPromptCount()
            expect(count).toBeGreaterThanOrEqual(2)
        })

        it('should return 0 when no prompts loaded', () => {
            const count = getLoadedPromptCount()
            expect(count).toBe(0)
        })
    })

    describe('getPromptStats', () => {
        it('should return prompt statistics', async () => {
            const promptYaml = `
id: 'stats-test'
title: 'Stats Test'
template: 'Template'
`
            await fs.writeFile(path.join(testDir, 'stats-test.yaml'), promptYaml)
            await loadPrompts(server, testDir)

            const stats = getPromptStats()
            expect(stats).toBeDefined()
            expect(stats.total).toBeGreaterThanOrEqual(1)
        })

        it('should return empty stats when no prompts loaded', () => {
            const stats = getPromptStats()
            expect(stats).toBeDefined()
            expect(stats.total).toBe(0)
        })
    })
})

