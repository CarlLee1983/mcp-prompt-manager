import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { STORAGE_DIR, ACTIVE_GROUPS, IS_DEFAULT_GROUPS } from './config/env.js'
import { logger } from './utils/logger.js'
import { syncRepo } from './services/git.js'
import { loadPartials, loadPrompts } from './services/loaders.js'

// 初始化 MCP Server
const server = new McpServer({
    name: 'mcp-prompt-manager',
    version: '1.0.0',
})

/**
 * 主程式入口
 * 負責初始化並啟動 MCP Server
 */
async function main() {
    try {
        logger.info('Starting MCP Prompt Manager')

        // 1. 同步 Git 倉庫
        await syncRepo()

        // 2. 載入 Handlebars Partials
        const partialsCount = await loadPartials(STORAGE_DIR)
        logger.info({ count: partialsCount }, 'Partials loaded')

        // 3. 載入並註冊 Prompts
        // 在載入前提示用戶（如果是預設值）
        if (IS_DEFAULT_GROUPS) {
            logger.info(
                {
                    activeGroups: ACTIVE_GROUPS,
                    hint: 'Set MCP_GROUPS environment variable to load additional groups',
                },
                'Using default prompt groups'
            )
        }

        const { loaded, errors } = await loadPrompts(server, STORAGE_DIR)

        if (errors.length > 0) {
            logger.warn(
                {
                    loaded,
                    failed: errors.length,
                    errors: errors.map((e) => ({
                        file: e.file,
                        message: e.error.message,
                    })),
                },
                'Some prompts failed to load'
            )
        } else {
            logger.info({ loaded }, 'All prompts loaded successfully')
        }

        if (loaded === 0) {
            logger.warn(
                'No prompts were loaded. Check your configuration and repository.'
            )
        }

        // 4. 啟動 MCP Server
        const transport = new StdioServerTransport()
        await server.connect(transport)
        logger.info('MCP Server is running!')
    } catch (error) {
        const fatalError =
            error instanceof Error ? error : new Error(String(error))
        logger.fatal({ error: fatalError }, 'Fatal error occurred')
        process.exit(1)
    }
}

// 啟動應用程式
main()
