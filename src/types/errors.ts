/**
 * Base error class for all MCP errors
 */
export class McpError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "McpError"
    }
}

/**
 * Error thrown when repository validation fails
 */
export class RepositoryValidationError extends McpError {
    constructor(url: string, reason?: string) {
        super(
            `Repository validation failed for ${url}${reason ? `: ${reason}` : ""}`
        )
        this.name = "RepositoryValidationError"
    }
}

/**
 * Error thrown when repository synchronization fails
 */
export class RepositorySyncError extends McpError {
    constructor(url: string, attempt: number, originalError?: Error) {
        super(
            `Failed to sync repository ${url} (Attempt ${attempt})${
                originalError ? `: ${originalError.message}` : ""
            }`
        )
        this.name = "RepositorySyncError"
        this.cause = originalError
    }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends McpError {
    constructor(message: string) {
        super(message)
        this.name = "ConfigurationError"
    }
}

/**
 * Error thrown when prompt loading fails
 */
export class PromptLoadError extends McpError {
    constructor(filePath: string, originalError?: Error) {
        super(
            `Failed to load prompt from ${filePath}${
                originalError ? `: ${originalError.message}` : ""
            }`
        )
        this.name = "PromptLoadError"
        this.cause = originalError
    }
}
