import {
    getRepoUrl,
    getGitBranch,
    STORAGE_DIR,
} from '../config/env.js'
import { RepositoryFactory } from './repositories/index.js'

export async function syncRepo(): Promise<void> {
    const repoUrl = getRepoUrl()
    const gitBranch = getGitBranch()
    
    if (!repoUrl) {
        throw new Error('❌ Error: PROMPT_REPO_URL is missing.')
    }

    const repository = RepositoryFactory.create({
        url: repoUrl,
        branch: gitBranch,
        targetDir: STORAGE_DIR
    })

    await repository.sync()
}
