import { simpleGit, type SimpleGitOptions } from "simple-git"
import fs from "fs/promises"
import path from "path"
import {
    REPO_URL,
    STORAGE_DIR,
    GIT_BRANCH,
    GIT_MAX_RETRIES,
} from "../config/env.js"
import { logger } from "../utils/logger.js"
import { ensureDirectoryAccess, clearFileCache } from "../utils/fileSystem.js"

/**
 * Git 同步 Repo
 * 會自動清除檔案列表緩存以確保數據一致性
 * @param maxRetries - 最大重試次數（預設從環境變數讀取）
 * @throws {Error} 當 Git 操作失敗時
 */
export async function syncRepo(
    maxRetries: number = GIT_MAX_RETRIES
): Promise<void> {
    if (!REPO_URL) {
        throw new Error("❌ Error: PROMPT_REPO_URL is missing.")
    }

    logger.info({ repoUrl: REPO_URL }, "Git syncing from repository")

    const exists = await fs.stat(STORAGE_DIR).catch(() => null)
    const gitOptions: Partial<SimpleGitOptions> = {
        baseDir: STORAGE_DIR,
        binary: "git",
        maxConcurrentProcesses: 6,
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (exists) {
                const isRepo = await fs
                    .stat(path.join(STORAGE_DIR, ".git"))
                    .catch(() => null)
                if (isRepo) {
                    // 確保目錄可訪問
                    await ensureDirectoryAccess(STORAGE_DIR)

                    const git = simpleGit(gitOptions)
                    
                    // 先 fetch 獲取遠端更新
                    await git.fetch()
                    
                    // 檢查當前分支
                    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])
                    const branchName = currentBranch.trim() || GIT_BRANCH
                    
                    // 嘗試 pull with rebase（優先策略）
                    try {
                        await git.pull(["--rebase"])
                        logger.info({ branch: branchName }, "Git pull with rebase successful")
                    } catch (rebaseError) {
                        // 如果 rebase 失敗（可能是因為有分歧），使用 reset 強制同步到遠端
                        logger.warn(
                            { branch: branchName, error: rebaseError },
                            "Git pull with rebase failed, resetting to remote branch"
                        )
                        const remoteBranch = `origin/${branchName}`
                        await git.reset(["--hard", remoteBranch])
                        logger.info({ branch: branchName }, "Git reset to remote branch successful")
                    }
                    
                    // 清除緩存以確保數據一致性
                    clearFileCache(STORAGE_DIR)
                    logger.info("Git sync successful")
                    return
                } else {
                    // 目錄存在但不是 git repo，重新 clone
                    logger.warn(
                        "Directory exists but is not a git repository, re-cloning"
                    )
                    await fs.rm(STORAGE_DIR, { recursive: true, force: true })
                    await fs.mkdir(STORAGE_DIR, { recursive: true })
                    await cloneRepository(REPO_URL, STORAGE_DIR, GIT_BRANCH)
                    // 清除緩存以確保數據一致性
                    clearFileCache(STORAGE_DIR)
                    logger.info("Git re-cloned successful")
                    return
                }
            } else {
                // 目錄不存在，首次 clone
                await fs.mkdir(STORAGE_DIR, { recursive: true })
                await cloneRepository(REPO_URL, STORAGE_DIR, GIT_BRANCH)
                // 清除緩存以確保數據一致性
                clearFileCache(STORAGE_DIR)
                logger.info("Git first clone successful")
                return
            }
        } catch (error) {
            lastError =
                error instanceof Error ? error : new Error(String(error))
            logger.warn(
                { attempt, maxRetries, error: lastError },
                "Git sync attempt failed"
            )

            if (attempt < maxRetries) {
                const delay = 1000 * attempt // 指數退避
                logger.info(
                    { delay, nextAttempt: attempt + 1 },
                    "Retrying git sync"
                )
                await new Promise((resolve) => setTimeout(resolve, delay))
                continue
            }
        }
    }

    // 所有重試都失敗
    logger.error({ error: lastError }, "Git sync failed after all retries")
    throw new Error(
        `Git sync failed after ${maxRetries} attempts: ${lastError?.message}`
    )
}

/**
 * Clone Git 倉庫到指定目錄
 * @param repoUrl - 倉庫 URL（支援 HTTP/HTTPS/SSH）
 * @param targetDir - 目標目錄（必須是絕對路徑）
 * @param branch - 分支名稱（可選，預設使用倉庫預設分支）
 * @throws {Error} 當 clone 操作失敗時
 */
async function cloneRepository(
    repoUrl: string,
    targetDir: string,
    branch?: string
): Promise<void> {
    const git = simpleGit()
    const cloneOptions = branch ? ["-b", branch] : []
    await git.clone(repoUrl, targetDir, cloneOptions)
}
