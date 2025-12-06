import path from "path"
import type { RepositoryStrategy } from "./strategy.js"
import { GitRepositoryStrategy } from "./gitStrategy.js"
import { LocalRepositoryStrategy } from "./localStrategy.js"
import { logger } from "../utils/logger.js"

/**
 * Repository Factory
 * Automatically determines and creates corresponding strategy instances based on repository URL
 */
export class RepositoryFactory {
    /**
     * Create corresponding Repository Strategy
     * @param repoUrl - Repository URL or local path
     * @param defaultBranch - Default branch name (only for Git repository)
     * @param maxRetries - Maximum number of retries (only for Git repository)
     * @returns Repository Strategy instance
     * @throws {Error} When unable to determine repository type
     */
    static createStrategy(
        repoUrl: string,
        defaultBranch: string = "main",
        maxRetries: number = 3
    ): RepositoryStrategy {
        // Validate URL format
        if (repoUrl.includes("..") || repoUrl.includes("\0")) {
            throw new Error("Invalid REPO_URL: path traversal detected")
        }

        // Check if it's a local path
        const isLocalPath =
            path.isAbsolute(repoUrl) &&
            !repoUrl.startsWith("http://") &&
            !repoUrl.startsWith("https://") &&
            !repoUrl.startsWith("git@")

        if (isLocalPath) {
            logger.debug({ repoUrl }, "Creating LocalRepositoryStrategy")
            return new LocalRepositoryStrategy(repoUrl)
        }

        // Check if it's a Git repository
        const isGitRepo =
            repoUrl.startsWith("http://") ||
            repoUrl.startsWith("https://") ||
            repoUrl.startsWith("git@")

        if (isGitRepo) {
            logger.debug({ repoUrl }, "Creating GitRepositoryStrategy")
            return new GitRepositoryStrategy(repoUrl, defaultBranch, maxRetries)
        }

        throw new Error(
            `Unable to determine repository type for: ${repoUrl}. Must be a Git URL (http/https/git@) or absolute local path.`
        )
    }
}
