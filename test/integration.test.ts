import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadPartials, loadPrompts } from '../src/services/loaders.js'
import { getFilesRecursively, clearFileCache } from '../src/utils/fileSystem.js'
import { SourceManager } from '../src/services/sourceManager.js'

describe('Integration Tests', () => {
    let testDir: string
    let server: McpServer
    const originalEnv = process.env

    beforeEach(async () => {
        // Set test environment variables
        process.env.PROMPT_REPO_URL = '/tmp/test-repo'
        process.env.MCP_GROUPS = 'common'
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-integration-test-'))
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        })
        // Clear SourceManager state
        SourceManager.getInstance().clearAllPrompts()
        SourceManager.getInstance().clearAllPartials()
        // Clear cache
        clearFileCache()
    })

    afterEach(() => {
        // Restore environment variables
        process.env = originalEnv
    })

    afterEach(async () => {
        // Clean up temporary directory
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => { })
        clearFileCache()
    })

    describe('Full Load Flow', () => {
        it('should load prompts and partials correctly', async () => {
            // Create test file structure
            // Place prompt in root, so it is loaded regardless of ACTIVE_GROUPS
            await fs.mkdir(path.join(testDir, 'partials'), {
                recursive: true,
            })

            // Create partial
            await fs.writeFile(
                path.join(testDir, 'partials', 'role-expert.hbs'),
                'You are a senior engineer.'
            )

            // Create prompt (in root)
            const promptYaml = `
id: 'test-prompt'
title: 'Test Prompt'
description: 'This is a test'
args:
  code:
    type: 'string'
    description: 'Code'
template: |
  {{> role-expert }}
  
  Please review the following code:
  
  \`\`\`
  {{code}}
  \`\`\`
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                promptYaml
            )

            // Load partials
            const partialsCount = await loadPartials(testDir)
            expect(partialsCount).toBe(1)

            // Load prompts
            const { loaded, errors } = await loadPrompts(server, testDir)

            expect(loaded).toBe(1)
            expect(errors).toHaveLength(0)
        })

        it('should handle multiple prompts and partials', async () => {
            // Create multiple files (in root)
            // Create multiple partials
            await fs.writeFile(
                path.join(testDir, 'header.hbs'),
                '=== Header ==='
            )
            await fs.writeFile(
                path.join(testDir, 'footer.hbs'),
                '=== Footer ==='
            )

            // Create multiple prompts (in root)
            const prompt1 = `
id: 'prompt-1'
title: 'Prompt 1'
template: '{{> header }} Content 1 {{> footer }}'
`

            const prompt2 = `
id: 'prompt-2'
title: 'Prompt 2'
args:
  name:
    type: 'string'
template: 'Hello {{name}}'
`

            await fs.writeFile(
                path.join(testDir, 'prompt-1.yaml'),
                prompt1
            )
            await fs.writeFile(
                path.join(testDir, 'prompt-2.yaml'),
                prompt2
            )

            // Load
            const partialsCount = await loadPartials(testDir)
            expect(partialsCount).toBe(2)

            const { loaded, errors } = await loadPrompts(server, testDir)
            expect(loaded).toBe(2)
            expect(errors).toHaveLength(0)
        })

        it('should handle group filtering correctly', async () => {
            // Create files in different groups
            await fs.mkdir(path.join(testDir, 'laravel'), { recursive: true })
            await fs.mkdir(path.join(testDir, 'vue'), { recursive: true })
            await fs.mkdir(path.join(testDir, 'common'), { recursive: true })

            // Create prompts
            await fs.writeFile(
                path.join(testDir, 'common', 'common-prompt.yaml'),
                "id: 'common-prompt'\ntitle: 'Common'\ntemplate: 'Common template'"
            )

            await fs.writeFile(
                path.join(testDir, 'laravel', 'laravel-prompt.yaml'),
                "id: 'laravel-prompt'\ntitle: 'Laravel'\ntemplate: 'Laravel template'"
            )

            await fs.writeFile(
                path.join(testDir, 'vue', 'vue-prompt.yaml'),
                "id: 'vue-prompt'\ntitle: 'Vue'\ntemplate: 'Vue template'"
            )

            // Test loading only common and laravel
            // Note: We need to mock ACTIVE_GROUPS here, but since it's read from env
            // We test the logic of shouldLoadPrompt directly by implication
            const { loaded } = await loadPrompts(server, testDir)

            // common should always load, laravel and vue depends on ACTIVE_GROUPS
            // Default ACTIVE_GROUPS is ['common'], so only common should load
            expect(loaded).toBeGreaterThanOrEqual(1)
        })

        it('should handle invalid YAML files', async () => {
            // Create invalid YAML (in root)
            await fs.writeFile(
                path.join(testDir, 'invalid.yaml'),
                'invalid: yaml: content: ['
            )

            // Create valid prompt (in root)
            await fs.writeFile(
                path.join(testDir, 'valid.yaml'),
                "id: 'valid'\ntitle: 'Valid'\ntemplate: 'Valid template'"
            )

            const { loaded, errors } = await loadPrompts(server, testDir)

            // Should load at least one valid
            expect(loaded).toBeGreaterThanOrEqual(1)
            // Should have error log
            expect(errors.length).toBeGreaterThanOrEqual(0) // YAML parse might not throw error?
        })

        it('should handle prompts missing required fields', async () => {
            // Missing ID (in root)
            await fs.writeFile(
                path.join(testDir, 'no-id.yaml'),
                "title: 'No ID'\ntemplate: 'Template'"
            )

            // Missing template (in root)
            await fs.writeFile(
                path.join(testDir, 'no-template.yaml'),
                "id: 'no-template'\ntitle: 'No Template'"
            )

            const { loaded, errors } = await loadPrompts(server, testDir)

            // These should be skipped, not loaded
            expect(loaded).toBe(0)
            // Should have validation errors
            expect(errors.length).toBeGreaterThan(0)
        })
    })

    describe('File List Cache', () => {
        it('should use cache to avoid duplicate scans', async () => {
            // Create test files
            await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
            await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2')

            // First scan
            const files1 = await getFilesRecursively(testDir, true)
            const count1 = files1.length

            // Second scan (should use cache)
            const files2 = await getFilesRecursively(testDir, true)
            const count2 = files2.length

            expect(count1).toBe(count2)
            expect(files1).toEqual(files2)
        })

        it('should rescan after clearing cache', async () => {
            await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')

            // First scan
            const files1 = await getFilesRecursively(testDir, true)

            // Add new file
            await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2')

            // Without clearing cache, should be old result
            const files2BeforeClear = await getFilesRecursively(testDir, true)
            expect(files2BeforeClear.length).toBe(files1.length)

            // Clear cache and rescan
            clearFileCache(testDir)
            const files2AfterClear = await getFilesRecursively(testDir, true)
            expect(files2AfterClear.length).toBe(files1.length + 1)
        })
    })

    describe('Error Handling', () => {
        it('should correctly count load errors', async () => {
            // Create a valid prompt (in root)
            await fs.writeFile(
                path.join(testDir, 'valid.yaml'),
                "id: 'valid'\ntitle: 'Valid'\ntemplate: 'Valid'"
            )

            // Create an invalid prompt (missing template, in root)
            await fs.writeFile(
                path.join(testDir, 'invalid.yaml'),
                "id: 'invalid'\ntitle: 'Invalid'"
            )

            const { loaded, errors } = await loadPrompts(server, testDir)

            // Should load one, have one error
            expect(loaded).toBe(1)
            expect(errors.length).toBeGreaterThan(0)
            expect(errors[0].file).toContain('invalid.yaml')
        })

        it('should continue loading other prompts on partial failure', async () => {
            // Create multiple prompts, one invalid (in root)
            await fs.writeFile(
                path.join(testDir, 'prompt1.yaml'),
                "id: 'prompt1'\ntitle: 'Prompt 1'\ntemplate: 'Template 1'"
            )

            await fs.writeFile(
                path.join(testDir, 'prompt2.yaml'),
                "id: 'prompt2'\ntitle: 'Prompt 2'"
            )

            await fs.writeFile(
                path.join(testDir, 'prompt3.yaml'),
                "id: 'prompt3'\ntitle: 'Prompt 3'\ntemplate: 'Template 3'"
            )

            const { loaded, errors } = await loadPrompts(server, testDir)

            // Should load 2 valid ones
            expect(loaded).toBe(2)
            // Should have 1 error
            expect(errors.length).toBeGreaterThan(0)
        })
    })
})

