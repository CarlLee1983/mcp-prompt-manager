import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
    loadPrompts,
    reloadPrompts,
    getAllPromptRuntimes,
    getPromptStats,
    getPromptRuntime,
    clearAllPrompts,
} from '../src/services/loaders.js'
import { getHealthStatus } from '../src/services/health.js'
import { PromptMetadataSchema } from '../src/types/promptMetadata.js'
import type { PromptRuntime } from '../src/types/promptRuntime.js'

describe('Prompt Metadata Tests', () => {
    let testDir: string
    let server: McpServer
    const originalEnv = process.env

    beforeEach(async () => {
        // Set test environment variables
        process.env.PROMPT_REPO_URL = '/tmp/test-repo'
        process.env.MCP_GROUPS = 'common'
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-metadata-test-'))
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        })
    })

    afterEach(() => {
        // Restore environment variables
        process.env = originalEnv
        clearAllPrompts()
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    describe('Valid Metadata -> active', () => {
        it('should correctly parse and mark as active', async () => {
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
description: 'This is a test'
version: '1.0.0'
status: 'stable'
tags:
  - 'test'
  - 'example'
use_cases:
  - 'testing'
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

            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('test-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('active')
            expect(runtime?.version).toBe('1.0.0')
            expect(runtime?.status).toBe('stable')
            expect(runtime?.tags).toEqual(['test', 'example'])
            expect(runtime?.use_cases).toEqual(['testing'])
            expect(runtime?.source).toBe('embedded')
        })
    })

    describe('Metadata Validation Failure -> warning', () => {
        it('should mark as warning when version format is incorrect', async () => {
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
version: 'invalid-version'
status: 'stable'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('test-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('warning')
        })
    })

    describe('No Metadata -> legacy', () => {
        it('should mark as legacy when missing version and status', async () => {
            const yamlContent = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'legacy-prompt.yaml'),
                yamlContent
            )

            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('legacy-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('legacy')
            expect(runtime?.version).toBe('0.0.0')
            expect(runtime?.status).toBe('legacy')
            expect(runtime?.tags).toEqual([])
            expect(runtime?.use_cases).toEqual([])
            expect(runtime?.source).toBe('legacy')
        })
    })

    describe('registry deprecated -> disabled', () => {
        it('should mark as disabled when registry mark as deprecated', async () => {
            // Create metadata prompt
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            // Create registry.yaml
            const registryContent = `
prompts:
  - id: 'test-prompt'
    deprecated: true
`

            await fs.writeFile(
                path.join(testDir, 'registry.yaml'),
                registryContent
            )

            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('test-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('disabled')
            expect(runtime?.source).toBe('registry')
        })

        it('should mark as disabled when legacy prompt is marked as deprecated in registry', async () => {
            // Create legacy prompt
            const yamlContent = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'legacy-prompt.yaml'),
                yamlContent
            )

            // Create registry.yaml
            const registryContent = `
prompts:
  - id: 'legacy-prompt'
    deprecated: true
`

            await fs.writeFile(
                path.join(testDir, 'registry.yaml'),
                registryContent
            )

            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('legacy-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('disabled')
            expect(runtime?.source).toBe('registry')
        })
    })

    describe('Status correctly updated after reload', () => {
        it('should correctly update status after reload', async () => {
            // Create new server instance to avoid duplicate registration issues
            const server1 = new McpServer({
                name: 'test-server-1',
                version: '1.0.0',
            })

            // Initial: legacy prompt
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            await loadPrompts(server1, testDir)

            let runtime = getPromptRuntime('test-prompt')
            expect(runtime?.runtime_state).toBe('legacy')

            // Update: add metadata
            const updatedYamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                updatedYamlContent
            )

            // Create new server instance to test reload
            const server2 = new McpServer({
                name: 'test-server-2',
                version: '1.0.0',
            })

            // Directly reload prompts
            await loadPrompts(server2, testDir)

            runtime = getPromptRuntime('test-prompt')
            expect(runtime?.runtime_state).toBe('active')
            expect(runtime?.version).toBe('1.0.0')
            expect(runtime?.status).toBe('stable')
        })
    })

    describe('system.health statistics are correct', () => {
        it('should correctly count prompts in various states', async () => {
            // Create multiple prompts with different states
            const activePrompt = `
id: 'active-prompt'
title: 'Active Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            const legacyPrompt = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            const warningPrompt = `
id: 'warning-prompt'
title: 'Warning Prompt'
version: '1.0.0'
status: 'invalid-status'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'active-prompt.yaml'),
                activePrompt
            )
            await fs.writeFile(
                path.join(testDir, 'legacy-prompt.yaml'),
                legacyPrompt
            )
            await fs.writeFile(
                path.join(testDir, 'warning-prompt.yaml'),
                warningPrompt
            )

            await loadPrompts(server, testDir)

            const stats = getPromptStats()
            const runtimes = getAllPromptRuntimes()
            expect(stats.total).toBe(3)
            expect(stats.active).toBe(1)
            expect(stats.legacy).toBe(1)
            expect(stats.warning).toBe(1)
            expect(stats.invalid).toBe(0)
            expect(stats.disabled).toBe(0)
        })

        it('should correctly show statistics in health status', async () => {
            const activePrompt = `
id: 'active-prompt'
title: 'Active Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'active-prompt.yaml'),
                activePrompt
            )

            await loadPrompts(server, testDir)

            const startTime = Date.now()
            const health = await getHealthStatus(startTime, testDir)

            expect(health.prompts.total).toBeGreaterThanOrEqual(1)
            expect(health.prompts.active).toBeGreaterThanOrEqual(1)
            expect(health.registry.enabled).toBe(false)
            expect(health.registry.source).toBe('none')
        })

        it('should correctly detect registry.yaml existence', async () => {
            const activePrompt = `
id: 'active-prompt'
title: 'Active Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'active-prompt.yaml'),
                activePrompt
            )

            const registryContent = `
prompts:
  - id: 'active-prompt'
    group: 'test'
    visibility: 'public'
`

            await fs.writeFile(
                path.join(testDir, 'registry.yaml'),
                registryContent
            )

            await loadPrompts(server, testDir)

            const startTime = Date.now()
            const health = await getHealthStatus(startTime, testDir)

            expect(health.registry.enabled).toBe(true)
            expect(health.registry.source).toBe('registry.yaml')
        })
    })

    describe('registry override functionality', () => {
        it('should correctly apply group and visibility from registry', async () => {
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            const registryContent = `
prompts:
  - id: 'test-prompt'
    group: 'custom-group'
    visibility: 'private'
`

            await fs.writeFile(
                path.join(testDir, 'registry.yaml'),
                registryContent
            )

            await loadPrompts(server, testDir)

            const runtime = getPromptRuntime('test-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.group).toBe('custom-group')
            expect(runtime?.visibility).toBe('private')
            expect(runtime?.source).toBe('registry')
        })
    })

    describe('Backward Compatibility', () => {
        it('should still work normally with legacy prompt', async () => {
            const yamlContent = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: 'Please review {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'legacy-prompt.yaml'),
                yamlContent
            )

            const { loaded, errors } = await loadPrompts(server, testDir)

            expect(loaded).toBe(1)
            expect(errors.length).toBe(0)

            const runtime = getPromptRuntime('legacy-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('legacy')
        })

        it('should work normally without registry.yaml', async () => {
            const yamlContent = `
id: 'test-prompt'
title: 'Test Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '{{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            const { loaded, errors } = await loadPrompts(server, testDir)

            expect(loaded).toBe(1)
            expect(errors.length).toBe(0)

            const runtime = getPromptRuntime('test-prompt')
            expect(runtime).toBeDefined()
            expect(runtime?.runtime_state).toBe('active')
        })
    })
})

