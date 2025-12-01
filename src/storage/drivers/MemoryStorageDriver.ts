import type { StorageDriver } from "../StorageDriver.js"
import { logger } from "../../utils/logger.js"

/**
 * Memory Storage Driver
 * Reads files from memory, supports testing and dynamic loading
 */
export class MemoryStorageDriver implements StorageDriver {
    private files: Map<string, string> = new Map()

    /**
     * Dynamically add file to memory storage
     * @param filePath - File path (relative to root)
     * @param content - File content
     */
    addFile(filePath: string, content: string): void {
        // Normalize path (remove leading /, use / as separator)
        const normalizedPath = filePath.replace(/^\/+/, "").replace(/\\/g, "/")
        this.files.set(normalizedPath, content)
        logger.debug({ filePath: normalizedPath }, "File added to memory storage")
    }

    /**
     * Remove file
     * @param filePath - File path
     */
    removeFile(filePath: string): void {
        const normalizedPath = filePath.replace(/^\/+/, "").replace(/\\/g, "/")
        this.files.delete(normalizedPath)
        logger.debug({ filePath: normalizedPath }, "File removed from memory storage")
    }

    /**
     * Clear all files
     */
    clear(): void {
        this.files.clear()
        logger.debug("Memory storage cleared")
    }

    async initialize(): Promise<void> {
        logger.info({ fileCount: this.files.size }, "Memory storage initialized")
    }

    async getFilesRecursively(dir: string): Promise<string[]> {
        // Normalize directory path
        const normalizedDir = dir.replace(/^\/+/, "").replace(/\\/g, "/")
        const dirPrefix = normalizedDir ? `${normalizedDir}/` : ""

        const matchingFiles: string[] = []

        for (const filePath of this.files.keys()) {
            // Include file if path starts with directory prefix
            if (filePath.startsWith(dirPrefix) || (!normalizedDir && !filePath.includes("/"))) {
                matchingFiles.push(filePath)
            }
        }

        logger.debug(
            { dir, fileCount: matchingFiles.length },
            "Files retrieved from memory storage"
        )
        return matchingFiles
    }

    async readFile(filePath: string): Promise<string> {
        // Normalize path
        const normalizedPath = filePath.replace(/^\/+/, "").replace(/\\/g, "/")

        const content = this.files.get(normalizedPath)
        if (content === undefined) {
            throw new Error(`File not found in memory storage: ${filePath}`)
        }

        return content
    }
}

