import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { TransportAdapter } from './adapter.js'
import type {
    RegisterToolParams,
    RegisterPromptParams,
    RegisterResourceParams,
} from './adapter.js'
import { logger } from '../utils/logger.js'

/**
 * Stdio Transport Adapter
 * Wraps MCP Server's stdio transport
 */
export class StdioTransportAdapter implements TransportAdapter {
    private readonly server: McpServer
    private transport: StdioServerTransport | null = null

    constructor(serverName: string = 'mcp-prompt-manager', version: string = '1.0.0') {
        this.server = new McpServer({
            name: serverName,
            version,
        })
    }

    getType(): string {
        return 'stdio'
    }

    getServer(): McpServer {
        return this.server
    }

    async connect(): Promise<void> {
        if (this.transport) {
            logger.warn('Transport already connected')
            return
        }

        this.transport = new StdioServerTransport()
        await this.server.connect(this.transport)
        logger.info('Stdio transport connected')
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async disconnect(): Promise<void> {
        // Stdio transport usually doesn't need explicit disconnection
        // It will automatically disconnect when process ends
        logger.info('Stdio transport disconnected')
    }

    registerTool(params: RegisterToolParams): { remove: () => void } {
        return this.server.registerTool(
            params.name,
            {
                title: params.title,
                description: params.description,
                inputSchema: params.inputSchema,
            },
            async (args: unknown, _extra?: unknown) => {
                // Type conversion: MCP SDK's args is unknown, need to convert to Record<string, unknown>
                const typedArgs =
                    typeof args === 'object' && args !== null
                        ? (args as Record<string, unknown>)
                        : {}
                const result = await params.handler(typedArgs)
                // Ensure return format matches MCP SDK requirements
                return {
                    ...result,
                    structuredContent:
                        result.structuredContent,
                }
            }
        )
    }

    registerPrompt(params: RegisterPromptParams): void {
        this.server.prompt(
            params.name,
            params.inputSchema,
            async (args: unknown, _extra?: unknown) => {
                // Type conversion: MCP SDK's args is unknown, need to convert to Record<string, unknown>
                const typedArgs =
                    typeof args === 'object' && args !== null
                        ? (args as Record<string, unknown>)
                        : {}
                const result = await params.handler(typedArgs)
                // Ensure return format matches MCP SDK requirements
                return result as {
                    messages: Array<{
                        role: 'user' | 'assistant'
                        content: { type: 'text'; text: string }
                    }>
                    [key: string]: unknown
                }
            }
        )
    }

    registerResource(params: RegisterResourceParams): void {
        this.server.registerResource(
            params.name,
            params.uri,
            {
                title: params.name,
                description: params.description,
                mimeType: params.mimeType || 'application/json',
            },
            params.handler
        )
    }
}

