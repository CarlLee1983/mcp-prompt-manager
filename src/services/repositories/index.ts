import path from 'path'
import type { Repository, RepositoryConfig } from '../../types/repository.js'
import { LocalRepository } from './LocalRepository.js'
import { GitRepository } from './GitRepository.js'
import { S3Repository } from './S3Repository.js'

export class RepositoryFactory {
    static create(config: RepositoryConfig): Repository {
        const { url } = config

        if (url.startsWith('s3://')) {
            return new S3Repository(config)
        }

        const isLocalPath =
            path.isAbsolute(url) &&
            !url.startsWith('http://') &&
            !url.startsWith('https://') &&
            !url.startsWith('git@')

        if (isLocalPath) {
            return new LocalRepository(config)
        }

        // Default to Git repository
        return new GitRepository(config)
    }
}
