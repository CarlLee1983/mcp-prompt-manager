import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SourceManager } from '../src/services/sourceManager.js'

describe('SourceManager & Optimization Tests', () => {
    let testDir: string
    let server: McpServer
    const originalEnv = process.env

    beforeEach(async () => {
        process.env.PROMPT_REPO_URL = '/tmp/test-repo'
        process.env.MCP_GROUPS = 'common'
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-sourcemanager-test-'))
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        })
        // Clear singleton state (if possible, or just rely on clearAllPrompts)
        SourceManager.getInstance().clearAllPrompts()
    })

    afterEach(() => {
        process.env = originalEnv
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    it('should be a singleton', () => {
        const instance1 = SourceManager.getInstance()
        const instance2 = SourceManager.getInstance()
        expect(instance1).toBe(instance2)
    })

    it('should cache compiled templates after loading', async () => {
        const yamlContent = `
id: 'cached-prompt'
title: 'Cached Prompt'
version: '1.0.0'
status: 'stable'
args:
  name:
    type: 'string'
template: 'Hello {{name}}!'
`
        await fs.writeFile(path.join(testDir, 'cached-prompt.yaml'), yamlContent)

        const sourceManager = SourceManager.getInstance()
        await sourceManager.loadPrompts(server, testDir)

        const cachedPrompt = sourceManager.getPrompt('cached-prompt')
        expect(cachedPrompt).toBeDefined()
        expect(cachedPrompt?.metadata.id).toBe('cached-prompt')
        expect(cachedPrompt?.compiledTemplate).toBeDefined()
        expect(typeof cachedPrompt?.compiledTemplate).toBe('function')

        // Test execution of compiled template
        const result = cachedPrompt?.compiledTemplate({ name: 'World' })
        expect(result).toBe('Hello World!')
    })

    it('should update cache on reload', async () => {
        const sourceManager = SourceManager.getInstance()

        // Initial load
        const initialContent = `
id: 'reload-prompt'
title: 'Reload Prompt'
version: '1.0.0'
status: 'stable'
template: 'Version 1'
`
        await fs.writeFile(path.join(testDir, 'reload-prompt.yaml'), initialContent)
        await sourceManager.loadPrompts(server, testDir)

        let cachedPrompt = sourceManager.getPrompt('reload-prompt')
        expect(cachedPrompt?.compiledTemplate({})).toBe('Version 1')

        // Update file
        const updatedContent = `
id: 'reload-prompt'
title: 'Reload Prompt'
version: '1.0.1'
status: 'stable'
template: 'Version 2'
`
        await fs.writeFile(path.join(testDir, 'reload-prompt.yaml'), updatedContent)

        // Reload
        await sourceManager.reloadPrompts(server, testDir)

        cachedPrompt = sourceManager.getPrompt('reload-prompt')
        expect(cachedPrompt?.compiledTemplate({})).toBe('Version 2')
        expect(cachedPrompt?.runtime.version).toBe('1.0.1')
    })
})
