import type { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * Tool registration parameters
 */
export interface RegisterToolParams {
    name: string
    title: string
    description: string
    inputSchema: z.ZodTypeAny
    handler: (args: Record<string, unknown>) => Promise<{
        content: Array<{ type: "text"; text: string }>
        structuredContent?: Record<string, unknown>
        isError?: boolean
        [key: string]: unknown
    }>
}

/**
 * Prompt registration parameters
 */
export interface RegisterPromptParams {
    name: string
    inputSchema: z.ZodRawShape
    handler: (args: Record<string, unknown>) => Promise<{
        messages: Array<{
            role: "user" | "assistant"
            content: { type: "text"; text: string }
        }>
        [key: string]: unknown
    }>
}

/**
 * Resource registration parameters
 */
export interface RegisterResourceParams {
    uri: string
    name: string
    description: string
    mimeType?: string
    handler: () => Promise<{
        contents: Array<{
            uri: string
            mimeType: string
            text: string
        }>
    }>
}

/**
 * Transport Adapter Interface
 * Defines unified interface for different transport types
 */
export interface TransportAdapter {
    /**
     * Get transport type
     * @returns Transport type string
     */
    getType(): string

    /**
     * Connect transport
     * @throws {Error} When connection fails
     */
    connect(): Promise<void>

    /**
     * Disconnect transport
     */
    disconnect(): Promise<void>

    /**
     * Register tool
     * @param params - Tool registration parameters
     * @returns Tool reference (can be used for removal)
     */
    registerTool(params: RegisterToolParams): { remove: () => void }

    /**
     * Register prompt
     * @param params - Prompt registration parameters
     */
    registerPrompt(params: RegisterPromptParams): void

    /**
     * Register resource
     * @param params - Resource registration parameters
     */
    registerResource(params: RegisterResourceParams): void

    /**
     * Get underlying MCP Server instance (if applicable)
     * @returns MCP Server or null
     */
    getServer(): McpServer | null
}
