/**
 * Storage Driver Interface
 * Defines methods that all storage drivers must implement
 */
export interface StorageDriver {
    /**
     * Initialize the storage driver
     * e.g., clone Git repo, connect to S3, etc.
     */
    initialize(): Promise<void>

    /**
     * Recursively get all file paths under the specified directory
     * @param dir - Directory path (relative to storage root)
     * @returns Array of file paths
     */
    getFilesRecursively(dir: string): Promise<string[]>

    /**
     * Read file content
     * @param filePath - File path (relative to storage root)
     * @returns File content as string
     */
    readFile(filePath: string): Promise<string>
}

