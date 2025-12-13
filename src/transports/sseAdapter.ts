import type { TransportAdapter } from "./adapter.js"
import type {
    RegisterToolParams,
    RegisterPromptParams,
    RegisterResourceParams,
} from "./adapter.js"
import { logger } from "../utils/logger.js"

/**
 * SSE (Server-Sent Events) Transport Adapter
 * Implements Server-Sent Events transport, supports real-time prompt update push
 *
 * Note: This implementation requires additional HTTP server dependencies (e.g., Express or Fastify)
 * Currently provides basic framework, full implementation requires adding dependencies
 */
export class SseTransportAdapter implements TransportAdapter {
    private readonly port: number
    private readonly host: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private server: any = null // HTTP server instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private clients: Set<any> = new Set() // SSE client connection set

    constructor(port: number = 3001, host: string = "localhost") {
        this.port = port
        this.host = host
    }

    getType(): string {
        return "sse"
    }

    getServer(): null {
        // SSE adapter does not use MCP Server
        return null
    }

    async connect(): Promise<void> {
        // TODO: Implement SSE server startup logic
        // Need to add Express or Fastify dependency
        logger.warn(
            { port: this.port, host: this.host },
            "SSE transport adapter is not fully implemented. Please add HTTP server dependency (e.g., Express or Fastify)."
        )

        await Promise.reject(
            new Error(
                "SSE transport adapter is not fully implemented. Please add HTTP server dependency."
            )
        )
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async disconnect(): Promise<void> {
        // Close all client connections
        for (const _client of this.clients) {
            try {
                // TODO: Close client connection
            } catch (error) {
                logger.warn({ error }, "Error closing SSE client connection")
            }
        }
        this.clients.clear()

        if (this.server) {
            // TODO: Close HTTP server
            logger.info("SSE transport disconnected")
        }
    }

    registerTool(params: RegisterToolParams): { remove: () => void } {
        // TODO: Implement SSE endpoint registration
        // Example: POST /sse/tools/{name} or via WebSocket-like connection
        logger.debug({ toolName: params.name }, "Registering SSE tool endpoint")
        return {
            remove: () => {
                logger.debug(
                    { toolName: params.name },
                    "Removing SSE tool endpoint"
                )
            },
        }
    }

    registerPrompt(params: RegisterPromptParams): void {
        // TODO: Implement SSE endpoint registration
        logger.debug(
            { promptName: params.name },
            "Registering SSE prompt endpoint"
        )
    }

    registerResource(params: RegisterResourceParams): void {
        // TODO: Implement SSE endpoint registration
        logger.debug(
            { resourceUri: params.uri },
            "Registering SSE resource endpoint"
        )
    }

    /**
     * Broadcast event to all connected clients
     * @param event - Event name
     * @param data - Event data
     */
    broadcast(event: string, _data: unknown): void {
        // TODO: Implement SSE broadcast logic
        logger.debug(
            { event, clientCount: this.clients.size },
            "Broadcasting SSE event"
        )
    }
}
