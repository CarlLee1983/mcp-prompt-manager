import fs from 'fs/promises'
import path from 'path'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { Repository, RepositoryConfig } from '../../types/repository.js'
import { logger } from '../../utils/logger.js'
import { clearFileCache } from '../../utils/fileSystem.js'

export class S3Repository implements Repository {
    private config: RepositoryConfig
    private client: S3Client
    private bucket: string
    private prefix: string

    constructor(config: RepositoryConfig) {
        this.config = config

        // Parse s3 url s3://bucket/prefix
        const url = new URL(config.url)
        if (url.protocol !== 's3:') {
            throw new Error(`Invalid S3 URL: ${config.url}`)
        }

        this.bucket = url.hostname
        // Remove leading slash from pathname
        this.prefix = url.pathname.substring(1)

        // Initialize S3 client
        // Credentials will be loaded from environment variables or IAM role
        this.client = new S3Client({})
    }

    async sync(): Promise<void> {
        const { targetDir } = this.config

        logger.info({
            bucket: this.bucket,
            prefix: this.prefix,
            targetDir
        }, 'Syncing from S3 repository')

        try {
            await this.downloadDirectory(targetDir)

            // Clear cache to ensure data consistency
            clearFileCache(targetDir)
            logger.info('S3 repository sync successful')
        } catch (error) {
             const syncError =
                error instanceof Error ? error : new Error(String(error))
            logger.error({ error: syncError }, 'Failed to sync S3 repository')
            throw new Error(
                `S3 repository sync failed: ${syncError.message}`
            )
        }
    }

    private async downloadDirectory(targetDir: string): Promise<void> {
        let continuationToken: string | undefined

        do {
            const command = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: this.prefix,
                ContinuationToken: continuationToken
            })

            const response = await this.client.send(command)

            if (response.Contents) {
                for (const item of response.Contents) {
                    if (!item.Key) continue

                    // Skip if key ends with / (directory marker)
                    if (item.Key.endsWith('/')) continue

                    const relativePath = item.Key.substring(this.prefix.length)
                    // Remove leading slash from relative path if present
                    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath

                    const localPath = path.join(targetDir, cleanRelativePath)
                    const localDir = path.dirname(localPath)

                    await fs.mkdir(localDir, { recursive: true })
                    await this.downloadFile(item.Key, localPath)
                }
            }

            continuationToken = response.NextContinuationToken
        } while (continuationToken)
    }

    private async downloadFile(key: string, localPath: string): Promise<void> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            })

            const response = await this.client.send(command)

            if (response.Body instanceof Readable) {
                await pipeline(response.Body, await fs.open(localPath, 'w').then(fh => fh.createWriteStream()))
            } else {
                 throw new Error(`Unexpected body type for key: ${key}`)
            }
        } catch (error) {
            logger.warn({ key, error }, 'Failed to download file from S3')
             throw error
        }
    }
}
