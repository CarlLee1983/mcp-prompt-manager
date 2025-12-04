import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SourceManager, type LoadError } from './sourceManager.js'
import type { PromptRuntime } from '../types/promptRuntime.js'

// --- Exported Functions (Delegating to SourceManager) ---

/**
 * Get all PromptRuntime objects
 */
export function getAllPromptRuntimes(): PromptRuntime[] {
    return SourceManager.getInstance().getAllPromptRuntimes()
}

/**
 * Get PromptRuntime by ID
 */
export function getPromptRuntime(id: string): PromptRuntime | undefined {
    return SourceManager.getInstance().getPromptRuntime(id)
}

/**
 * Get list of registered prompt IDs
 */
export function getRegisteredPromptIds(): string[] {
    return SourceManager.getInstance().getRegisteredPromptIds()
}

/**
 * Get count of loaded prompts
 */
export function getLoadedPromptCount(): number {
    return SourceManager.getInstance().getLoadedPromptCount()
}

/**
 * Get Prompt statistics
 */
export function getPromptStats() {
    return SourceManager.getInstance().getPromptStats()
}

/**
 * Load Handlebars Partials
 */
export async function loadPartials(storageDir?: string): Promise<number> {
    return SourceManager.getInstance().loadPartials(storageDir)
}

/**
 * Clear all registered Handlebars partials
 */
export function clearAllPartials(): void {
    SourceManager.getInstance().clearAllPartials()
}

/**
 * Clear all registered prompts and tools
 */
export function clearAllPrompts(): void {
    SourceManager.getInstance().clearAllPrompts()
}

/**
 * Load and register Prompts to MCP Server
 */
export async function loadPrompts(
    server: McpServer,
    storageDir?: string,
    systemStorageDir?: string
): Promise<{ loaded: number; errors: LoadError[]; loadedToolIds?: Set<string> }> {
    return SourceManager.getInstance().loadPrompts(server, storageDir, systemStorageDir)
}

/**
 * Reload all prompts from Git repository (Zero-downtime)
 */
export async function reloadPrompts(
    server: McpServer,
    storageDir?: string,
    systemStorageDir?: string
): Promise<{ loaded: number; errors: LoadError[] }> {
    return SourceManager.getInstance().reloadPrompts(server, storageDir, systemStorageDir)
}

/**
 * Reload a single prompt file
 */
export async function reloadSinglePrompt(
    server: McpServer,
    filePath: string,
    storageDir?: string
): Promise<{ success: boolean; error?: Error }> {
    return SourceManager.getInstance().reloadSinglePrompt(server, filePath, storageDir)
}
