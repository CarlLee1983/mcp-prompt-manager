import type { TransportAdapter } from "./adapter.js"
import { StdioTransportAdapter } from "./stdioAdapter.js"
import { HttpTransportAdapter } from "./httpAdapter.js"
import { SseTransportAdapter } from "./sseAdapter.js"
import { logger } from "../utils/logger.js"

/**
 * Transport Factory
 * Creates corresponding transport adapter based on configuration
 */
export class TransportFactory {
    /**
     * Create corresponding Transport Adapter
     * @param type - Transport type (stdio, http, sse)
     * @param options - Additional options (e.g., port, host, etc.)
     * @returns Transport Adapter instance
     * @throws {Error} When unsupported transport type is provided
     */
    static createAdapter(
        type: string,
        options?: {
            port?: number
            host?: string
            serverName?: string
            version?: string
        }
    ): TransportAdapter {
        const normalizedType = type.toLowerCase()

        switch (normalizedType) {
            case "stdio":
                logger.debug("Creating StdioTransportAdapter")
                return new StdioTransportAdapter(
                    options?.serverName,
                    options?.version
                )

            case "http":
                logger.debug(
                    { port: options?.port, host: options?.host },
                    "Creating HttpTransportAdapter"
                )
                return new HttpTransportAdapter(
                    options?.port || 3000,
                    options?.host || "localhost"
                )

            case "sse":
                logger.debug(
                    { port: options?.port, host: options?.host },
                    "Creating SseTransportAdapter"
                )
                return new SseTransportAdapter(
                    options?.port || 3001,
                    options?.host || "localhost"
                )

            default:
                throw new Error(
                    `Unsupported transport type: ${type}. Supported types: stdio, http, sse`
                )
        }
    }
}
