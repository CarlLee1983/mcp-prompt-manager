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

describe('Prompt Metadata 測試', () => {
    let testDir: string
    let server: McpServer
    const originalEnv = process.env

    beforeEach(async () => {
        // 設定測試環境變數
        process.env.PROMPT_REPO_URL = '/tmp/test-repo'
        process.env.MCP_GROUPS = 'common'
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-metadata-test-'))
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        })
    })

    afterEach(() => {
        // 還原環境變數
        process.env = originalEnv
        clearAllPrompts()
    })

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true })
    })

    describe('Metadata 合法 → active', () => {
        it('應該正確解析並標記為 active', async () => {
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
description: '這是一個測試'
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
    description: '程式碼'
template: '請審查 {{code}}'
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

    describe('Metadata 驗證失敗 → warning', () => {
        it('應該標記為 warning 當 version 格式錯誤', async () => {
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
version: 'invalid-version'
status: 'stable'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
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

    describe('無 metadata → legacy', () => {
        it('應該標記為 legacy 當沒有 version 和 status', async () => {
            const yamlContent = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
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

    describe('registry deprecated → disabled', () => {
        it('應該標記為 disabled 當 registry 標記為 deprecated', async () => {
            // 建立 metadata prompt
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            // 建立 registry.yaml
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

        it('應該標記為 disabled 當 legacy prompt 在 registry 中標記為 deprecated', async () => {
            // 建立 legacy prompt
            const yamlContent = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'legacy-prompt.yaml'),
                yamlContent
            )

            // 建立 registry.yaml
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

    describe('reload 後狀態正確更新', () => {
        it('應該在 reload 後正確更新狀態', async () => {
            // 建立新的 server 實例以避免重複註冊問題
            const server1 = new McpServer({
                name: 'test-server-1',
                version: '1.0.0',
            })

            // 初始：legacy prompt
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                yamlContent
            )

            await loadPrompts(server1, testDir)

            let runtime = getPromptRuntime('test-prompt')
            expect(runtime?.runtime_state).toBe('legacy')

            // 更新：加入 metadata
            const updatedYamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
version: '1.0.0'
status: 'stable'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
`

            await fs.writeFile(
                path.join(testDir, 'test-prompt.yaml'),
                updatedYamlContent
            )

            // 建立新的 server 實例來測試重新載入
            const server2 = new McpServer({
                name: 'test-server-2',
                version: '1.0.0',
            })

            // 直接重新載入 prompts
            await loadPrompts(server2, testDir)

            runtime = getPromptRuntime('test-prompt')
            expect(runtime?.runtime_state).toBe('active')
            expect(runtime?.version).toBe('1.0.0')
            expect(runtime?.status).toBe('stable')
        })
    })

    describe('system.health 統計正確', () => {
        it('應該正確統計各種狀態的 prompt', async () => {
            // 建立多個不同狀態的 prompts
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

        it('應該在 health status 中正確顯示統計', async () => {
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

        it('應該正確偵測 registry.yaml 存在', async () => {
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

    describe('registry override 功能', () => {
        it('應該正確套用 registry 的 group 和 visibility', async () => {
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
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

    describe('向後相容性', () => {
        it('應該仍然可以正常使用 legacy prompt', async () => {
            const yamlContent = `
id: 'legacy-prompt'
title: 'Legacy Prompt'
args:
  code:
    type: 'string'
template: '請審查 {{code}}'
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

        it('應該在沒有 registry.yaml 時正常運作', async () => {
            const yamlContent = `
id: 'test-prompt'
title: '測試 Prompt'
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

