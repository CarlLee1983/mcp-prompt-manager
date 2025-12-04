import { z } from 'zod'
import path from 'path'

/**
 * Repo configuration item
 */
export interface RepoConfig {
    url: string
    branch?: string | undefined
    priority?: number | undefined // Priority, lower number means higher priority
}

/**
 * Repo configuration validation schema
 */
const RepoConfigSchema = z.object({
    url: z
        .string()
        .min(1)
        .refine(
            (url) => {
                // Validate URL format or local path
                if (url.includes('..') || url.includes('\0')) {
                    return false
                }
                try {
                    if (
                        url.startsWith('http://') ||
                        url.startsWith('https://') ||
                        url.startsWith('git@')
                    ) {
                        return true
                    }
                    // Local paths must be absolute paths
                    return path.isAbsolute(url)
                } catch {
                    return false
                }
            },
            {
                message:
                    'Invalid repo URL: must be a valid URL or absolute path',
            }
        ),
    branch: z.string().optional(),
    priority: z.number().optional(),
})

/**
 * Parse multiple repo URLs (comma-separated)
 * @param repoUrls - Comma-separated repo URLs
 * @returns Array of Repo configurations
 */
export function parseRepoUrls(repoUrls: string): RepoConfig[] {
    if (!repoUrls || repoUrls.trim().length === 0) {
        return []
    }

    const urls = repoUrls
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)

    return urls.map((url, index) => ({
        url,
        priority: index, // Default priority set by order
    }))
}

/**
 * Parse single repo URL (backward compatibility)
 * @param repoUrl - Single repo URL
 * @param branch - Branch name (optional)
 * @returns Repo configuration
 */
export function parseSingleRepoUrl(
    repoUrl: string,
    branch?: string
): RepoConfig {
    return {
        url: repoUrl,
        branch,
        priority: 0,
    }
}

/**
 * Validate and parse Repo configuration
 * @param config - Repo configuration object
 * @returns Validated Repo configuration
 * @throws {Error} When configuration validation fails
 */
export function validateRepoConfig(config: unknown): RepoConfig {
    return RepoConfigSchema.parse(config)
}

/**
 * Sort Repo configurations (by priority)
 * @param configs - Array of Repo configurations
 * @returns Sorted array of Repo configurations
 */
export function sortReposByPriority(configs: RepoConfig[]): RepoConfig[] {
    return [...configs].sort((a, b) => {
        const priorityA = a.priority ?? 999
        const priorityB = b.priority ?? 999
        return priorityA - priorityB
    })
}

