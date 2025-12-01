import type { StorageDriver } from "./StorageDriver.js"
import { LocalGitStorageDriver } from "./drivers/LocalGitStorageDriver.js"
import { GitHubStorageDriver } from "./drivers/GitHubStorageDriver.js"
import { MemoryStorageDriver } from "./drivers/MemoryStorageDriver.js"
import { S3StorageDriver } from "./drivers/S3StorageDriver.js"
import { PROMPT_STORAGE, STORAGE_DIR } from "../config/env.js"
import { logger } from "../utils/logger.js"

/**
 * Storage Driver Factory
 * Creates the appropriate Storage Driver based on environment variables
 */
export function createStorageDriver(): StorageDriver {
    const storageType = PROMPT_STORAGE || "local"

    logger.info({ storageType }, "Creating storage driver")

    switch (storageType) {
        case "github":
            return new GitHubStorageDriver(STORAGE_DIR)

        case "local":
            return new LocalGitStorageDriver(STORAGE_DIR)

        case "memory":
            return new MemoryStorageDriver()

        case "s3":
            return new S3StorageDriver()

        default:
            throw new Error(
                `Unknown storage type: ${storageType}. Supported types: github, local, memory, s3`
            )
    }
}

