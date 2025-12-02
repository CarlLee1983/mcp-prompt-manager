import fs from 'fs/promises'
import path from 'path'

const HIDDEN_FILE_PREFIX = '.'

// File list cache
const fileCache = new Map<string, { files: string[]; timestamp: number }>()
const CACHE_TTL = 5000 // Cache validity period: 5 seconds

/**
 * Recursively read all files in a directory (with caching)
 * @param dir - Directory path to scan
 * @param useCache - Whether to use cache (default: true)
 * @returns Array of file paths
 * @throws {Error} When directory does not exist or cannot be read
 */
export async function getFilesRecursively(
    dir: string,
    useCache: boolean = true
): Promise<string[]> {
    const now = Date.now()
    const cached = fileCache.get(dir)

    // Check if cache is valid
    if (useCache && cached && now - cached.timestamp < CACHE_TTL) {
        return cached.files
    }

    // Scan file system
    let results: string[] = []
    const list = await fs.readdir(dir)
    for (const file of list) {
        if (file.startsWith(HIDDEN_FILE_PREFIX)) continue // Ignore .git and hidden files
        const filePath = path.resolve(dir, file)
        const stat = await fs.stat(filePath)
        if (stat && stat.isDirectory()) {
            results = results.concat(
                await getFilesRecursively(filePath, useCache)
            )
        } else {
            results.push(filePath)
        }
    }

    // Update cache
    if (useCache) {
        fileCache.set(dir, { files: results, timestamp: now })
    }

    return results
}

/**
 * Clear cache for specified directory
 * @param dir - Directory path (optional, if not provided clears all cache)
 */
export function clearFileCache(dir?: string): void {
    if (dir) {
        fileCache.delete(dir)
    } else {
        fileCache.clear()
    }
}

/**
 * Ensure directory exists and has read/write permissions
 * @param dir - Directory path
 * @throws {Error} When directory cannot be accessed
 */
export async function ensureDirectoryAccess(dir: string): Promise<void> {
    try {
        await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK)
    } catch (error) {
        throw new Error(`No access to directory ${dir}: ${error}`)
    }
}
