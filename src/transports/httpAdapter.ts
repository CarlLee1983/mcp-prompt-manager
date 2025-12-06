import type { TransportAdapter } from "./adapter.js"
import type {
    RegisterToolParams,
    RegisterPromptParams,
    RegisterResourceParams,
} from "./adapter.js"
import { logger } from "../utils/logger.js"

/**
 * HTTP Transport Adapter
 * Implements HTTP REST API transport
 *
 * Note: This implementation requires additional HTTP server dependencies (e.g., Express or Fastify)
 * Currently provides basic framework, full implementation requires adding dependencies
 */
export class HttpTransportAdapter implements TransportAdapter {
    private readonly port: number
    private readonly host: string
    private server: any = null // HTTP server instance (type needs to be defined based on actual framework used)

    constructor(port: number = 3000, host: string = "localhost") {
        this.port = port
        this.host = host
    }

    getType(): string {
        return "http"
    }

    getServer(): null {
        // HTTP adapter does not use MCP Server
        return null
    }

    async connect(): Promise<void> {
        // TODO: Implement HTTP server startup logic
        // Need to add Express or Fastify dependency
        logger.warn(
            { port: this.port, host: this.host },
            "HTTP transport adapter is not fully implemented. Please add HTTP server dependency (e.g., Express or Fastify)."
        )
        // eslint-disable-next-line @typescript-eslint/await-thenable
        await Promise.reject(
            new Error(
                "HTTP transport adapter is not fully implemented. Please add HTTP server dependency."
            )
        )
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async disconnect(): Promise<void> {
        if (this.server) {
            // TODO: Close HTTP server
            logger.info("HTTP transport disconnected")
        }
    }

    registerTool(params: RegisterToolParams): { remove: () => void } {
        // TODO: Implement HTTP endpoint registration
        // Example: POST /tools/{name}
        logger.debug(
            { toolName: params.name },
            "Registering HTTP tool endpoint"
        )
        return {
            remove: () => {
                logger.debug(
                    { toolName: params.name },
                    "Removing HTTP tool endpoint"
                )
            },
        }
    }

    registerPrompt(params: RegisterPromptParams): void {
        // TODO: Implement HTTP endpoint registration
        // Example: POST /prompts/{name}
        logger.debug(
            { promptName: params.name },
            "Registering HTTP prompt endpoint"
        )
    }

    registerResource(params: RegisterResourceParams): void {
        // TODO: Implement HTTP endpoint registration
        // Example: GET /resources/{uri}
        logger.debug(
            { resourceUri: params.uri },
            "Registering HTTP resource endpoint"
        )
    }
}
