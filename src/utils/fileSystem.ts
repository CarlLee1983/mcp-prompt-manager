import fs from 'fs/promises'
import path from 'path'

const HIDDEN_FILE_PREFIX = '.'

// 檔案列表緩存
const fileCache = new Map<string, { files: string[]; timestamp: number }>()
const CACHE_TTL = 5000 // 緩存有效期 5 秒

/**
 * 遞迴讀取目錄中的所有檔案（帶緩存）
 * @param dir - 要掃描的目錄路徑
 * @param useCache - 是否使用緩存（預設 true）
 * @returns 檔案路徑陣列
 * @throws {Error} 當目錄不存在或無法讀取時
 */
export async function getFilesRecursively(
    dir: string,
    useCache: boolean = true
): Promise<string[]> {
    const now = Date.now()
    const cached = fileCache.get(dir)

    // 檢查緩存是否有效
    if (useCache && cached && now - cached.timestamp < CACHE_TTL) {
        return cached.files
    }

    // 掃描檔案系統
    let results: string[] = []
    const list = await fs.readdir(dir)
    for (const file of list) {
        if (file.startsWith(HIDDEN_FILE_PREFIX)) continue // 忽略 .git 和隱藏檔案
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

    // 更新緩存
    if (useCache) {
        fileCache.set(dir, { files: results, timestamp: now })
    }

    return results
}

/**
 * 清除指定目錄的緩存
 * @param dir - 目錄路徑（可選，不提供則清除所有緩存）
 */
export function clearFileCache(dir?: string): void {
    if (dir) {
        fileCache.delete(dir)
    } else {
        fileCache.clear()
    }
}

/**
 * 確保目錄存在且有讀寫權限
 * @param dir - 目錄路徑
 * @throws {Error} 當目錄無法訪問時
 */
export async function ensureDirectoryAccess(dir: string): Promise<void> {
    try {
        await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK)
    } catch (error) {
        throw new Error(`No access to directory ${dir}: ${error}`)
    }
}
