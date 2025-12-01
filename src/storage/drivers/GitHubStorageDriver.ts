import path from "path"
import type { StorageDriver } from "../StorageDriver.js"
import { LocalGitStorageDriver } from "./LocalGitStorageDriver.js"
import { syncRepo } from "../../services/git.js"
import { STORAGE_DIR } from "../../config/env.js"
import { logger } from "../../utils/logger.js"

/**
 * GitHub Storage Driver
 * Clones GitHub repository and reads from local file system
 */
export class GitHubStorageDriver implements StorageDriver {
    private localDriver: LocalGitStorageDriver

    constructor(baseDir?: string) {
        const dir = baseDir ?? STORAGE_DIR
        this.localDriver = new LocalGitStorageDriver(dir)
    }

    async initialize(): Promise<void> {
        logger.info("Initializing GitHub storage driver")
        // Sync Git repository
        await syncRepo()
        // Initialize using local driver
        await this.localDriver.initialize()
        logger.info("GitHub storage driver initialized")
    }

    async getFilesRecursively(dir: string): Promise<string[]> {
        return this.localDriver.getFilesRecursively(dir)
    }

    async readFile(filePath: string): Promise<string> {
        return this.localDriver.readFile(filePath)
    }
}

