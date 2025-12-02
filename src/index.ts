import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { STORAGE_DIR, ACTIVE_GROUPS, IS_DEFAULT_GROUPS } from './config/env.js'
import { logger } from './utils/logger.js'
import { syncRepo } from './services/git.js'
import { loadPartials, loadPrompts } from './services/loaders.js'

// Initialize MCP Server
const server = new McpServer({
    name: 'mcp-prompt-manager',
    version: '1.0.0',
})

/**
 * Main entry point
 * Initializes and starts the MCP Server
 */
async function main() {
    try {
        logger.info('Starting MCP Prompt Manager')

        // 1. Sync Git repository
        await syncRepo()

        // 2. Load Handlebars Partials
        const partialsCount = await loadPartials(STORAGE_DIR)
        logger.info({ count: partialsCount }, 'Partials loaded')

        // 3. Load and register Prompts
        // Notify user before loading (if using default values)
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

        // 4. Start MCP Server
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

// Start the application
main()
