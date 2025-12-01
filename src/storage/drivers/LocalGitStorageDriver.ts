import fs from "fs/promises"
import path from "path"
import type { StorageDriver } from "../StorageDriver.js"
import { getFilesRecursively as getFilesRecursivelyFS } from "../../utils/fileSystem.js"
import { STORAGE_DIR } from "../../config/env.js"
import { logger } from "../../utils/logger.js"

/**
 * Local Git Storage Driver
 * Reads from local Git repository without syncing
 */
export class LocalGitStorageDriver implements StorageDriver {
    private baseDir: string

    constructor(baseDir?: string) {
        this.baseDir = baseDir ?? STORAGE_DIR
    }

    async initialize(): Promise<void> {
        // Check if directory exists
        try {
            await fs.access(this.baseDir, fs.constants.R_OK)
            logger.info({ baseDir: this.baseDir }, "Local Git storage initialized")
        } catch (error) {
            throw new Error(
                `Local Git storage directory not accessible: ${this.baseDir}. Error: ${error}`
            )
        }
    }

    async getFilesRecursively(dir: string): Promise<string[]> {
        const targetDir = dir ? path.resolve(this.baseDir, dir) : this.baseDir
        const files = await getFilesRecursivelyFS(targetDir)
        // Convert absolute paths to relative paths from baseDir, and normalize to use / as separator
        return files.map((file) => {
            const relative = path.relative(this.baseDir, file)
            return relative.replace(/\\/g, "/")
        })
    }

    async readFile(filePath: string): Promise<string> {
        const fullPath = path.resolve(this.baseDir, filePath)
        try {
            const content = await fs.readFile(fullPath, "utf-8")
            return content
        } catch (error) {
            throw new Error(
                `Failed to read file ${filePath} from local storage: ${error}`
            )
        }
    }
}

