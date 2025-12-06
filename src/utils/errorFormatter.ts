/**
 * Error formatting utilities
 * Formats errors for better readability in logs
 */
import path from "path"

interface YAMLException {
    name: string
    reason: string
    mark?: {
        line?: number
        column?: number
        snippet?: string
        buffer?: string
    }
    message?: string
}

/**
 * Format YAML parsing error for better readability
 * Creates a concise, single-line error message suitable for JSON output
 * @param error - YAMLException or Error
 * @param filePath - File path where error occurred
 * @returns Formatted error message (single line, suitable for JSON)
 */
export function formatYAMLError(error: unknown, filePath?: string): string {
    const yamlError = error as YAMLException

    if (yamlError.name === "YAMLException" && yamlError.mark) {
        const { line, column, snippet } = yamlError.mark
        const reason =
            yamlError.reason || yamlError.message || "YAML parsing error"

        // Create concise single-line message
        const lineNum = line !== undefined ? `line ${line + 1}` : ""
        const colNum = column !== undefined ? `column ${column + 1}` : ""
        const location = [lineNum, colNum].filter(Boolean).join(", ")

        // Extract key line from snippet (the line with the error)
        let context = ""
        if (snippet) {
            const lines = snippet.split("\n")
            // Find the line with the error marker (^)
            const errorLine =
                lines.find((l) => l.includes("^")) ||
                lines[Math.floor(lines.length / 2)]
            if (errorLine) {
                // Clean up the error line (remove ^ marker and extra spaces)
                const cleaned = errorLine.replace(/\^+/g, "").trim()
                if (cleaned.length > 0 && cleaned.length < 100) {
                    context = `: "${cleaned}"`
                }
            }
        }

        const fileInfo = filePath ? ` in ${path.basename(filePath)}` : ""
        return `${reason}${fileInfo}${location ? ` (${location})` : ""}${context}`
    }

    // Fallback for non-YAML errors
    if (error instanceof Error) {
        return error.message
    }

    return String(error)
}

/**
 * Format error for logging (extracts key information)
 * @param error - Error object
 * @returns Object with formatted error information
 */
export function formatErrorForLogging(error: unknown): {
    errorMessage: string
    errorName: string
    errorStack?: string
    yamlError?: {
        reason: string
        line?: number
        column?: number
        snippet?: string
    }
} {
    if (error instanceof Error) {
        const yamlError = error as unknown as YAMLException

        // Check if it's a YAML error
        if (yamlError.name === "YAMLException" && yamlError.mark) {
            const { line, column, snippet } = yamlError.mark
            const reason =
                yamlError.reason || yamlError.message || "YAML parsing error"

            // Limit snippet length
            const maxSnippetLength = 300
            const truncatedSnippet =
                snippet && snippet.length > maxSnippetLength
                    ? snippet.substring(0, maxSnippetLength) + "..."
                    : snippet

            const result: {
                errorMessage: string
                errorName: string
                errorStack?: string
                yamlError?: {
                    reason: string
                    line?: number
                    column?: number
                    snippet?: string
                }
            } = {
                errorMessage: reason,
                errorName: yamlError.name,
            }

            if (error.stack) {
                result.errorStack = error.stack
            }

            const yamlErrorInfo: {
                reason: string
                line?: number
                column?: number
                snippet?: string
            } = {
                reason,
            }

            if (line !== undefined) {
                yamlErrorInfo.line = line + 1 // Convert to 1-based
            }
            if (column !== undefined) {
                yamlErrorInfo.column = column + 1 // Convert to 1-based
            }
            if (truncatedSnippet) {
                yamlErrorInfo.snippet = truncatedSnippet
            }

            result.yamlError = yamlErrorInfo
            return result
        }

        // Regular error
        const result: {
            errorMessage: string
            errorName: string
            errorStack?: string
        } = {
            errorMessage: error.message,
            errorName: error.name,
        }

        if (error.stack) {
            result.errorStack = error.stack
        }

        return result
    }

    // Unknown error type
    return {
        errorMessage: String(error),
        errorName: "UnknownError",
    }
}
