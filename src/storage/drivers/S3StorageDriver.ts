import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import type { StorageDriver } from "../StorageDriver.js"
import { logger } from "../../utils/logger.js"
import {
    S3_BUCKET_NAME,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_BASE_URL,
    S3_PREFIX,
} from "../../config/env.js"

/**
 * S3 Storage Driver
 * Supports two modes:
 * 1. URL mode: Read directly via public S3 URL (suitable for public buckets)
 * 2. SDK mode: Read using AWS SDK with credentials (suitable for private buckets)
 */
export class S3StorageDriver implements StorageDriver {
    private bucketName: string
    private region: string
    private prefix: string
    private s3Client: S3Client | null = null
    private useSDK: boolean
    private baseUrl: string | null = null

    constructor() {
        if (!S3_BUCKET_NAME) {
            throw new Error("S3_BUCKET_NAME is required for S3 storage driver")
        }

        this.bucketName = S3_BUCKET_NAME
        this.region = S3_REGION || "us-east-1"
        this.prefix = S3_PREFIX || ""

        // Determine whether to use SDK or URL mode
        // If credentials are provided, use SDK mode (supports private buckets)
        this.useSDK = !!(S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)

        if (this.useSDK) {
            // SDK mode: Create S3 Client
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: S3_ACCESS_KEY_ID!,
                    secretAccessKey: S3_SECRET_ACCESS_KEY!,
                },
            })
            logger.info(
                { bucket: this.bucketName, region: this.region },
                "S3 Storage Driver initialized in SDK mode (supports private buckets)"
            )
        } else {
            // URL mode: Use public URL
            this.baseUrl =
                S3_BASE_URL && S3_BASE_URL !== ""
                    ? S3_BASE_URL
                    : `https://${this.bucketName}.s3.${this.region}.amazonaws.com`
            logger.info(
                { bucket: this.bucketName, baseUrl: this.baseUrl },
                "S3 Storage Driver initialized in URL mode (public bucket)"
            )
        }
    }

    async initialize(): Promise<void> {
        // Initialization is already done in constructor
        logger.info(
            {
                bucket: this.bucketName,
                mode: this.useSDK ? "SDK" : "URL",
                prefix: this.prefix || "(none)",
            },
            "S3 storage driver ready"
        )
    }

    async getFilesRecursively(dir: string): Promise<string[]> {
        if (this.useSDK) {
            return this.getFilesRecursivelySDK(dir)
        } else {
            return this.getFilesRecursivelyURL(dir)
        }
    }

    /**
     * List files recursively using SDK mode
     */
    private async getFilesRecursivelySDK(dir: string): Promise<string[]> {
        if (!this.s3Client) {
            throw new Error("S3 client not initialized")
        }

        const files: string[] = []
        const dirPrefix = dir ? `${dir}/` : ""
        const fullPrefix = this.prefix ? `${this.prefix}/${dirPrefix}` : dirPrefix

        let continuationToken: string | undefined = undefined

        do {
            const command: ListObjectsV2Command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: fullPrefix,
                ContinuationToken: continuationToken,
            })

            const response = await this.s3Client.send(command)

            if (response.Contents) {
                for (const object of response.Contents) {
                    if (object.Key && !object.Key.endsWith("/")) {
                        // Remove prefix and dir prefix to get relative path
                        let relativePath = object.Key
                        // Remove prefix if exists
                        if (this.prefix) {
                            const prefixWithSlash = `${this.prefix}/`
                            if (relativePath.startsWith(prefixWithSlash)) {
                                relativePath = relativePath.substring(
                                    prefixWithSlash.length
                                )
                            }
                        }
                        // If dir is specified, only return files under that directory (relative to dir)
                        if (dir) {
                            const dirWithSlash = `${dir}/`
                            if (relativePath.startsWith(dirWithSlash)) {
                                relativePath = relativePath.substring(
                                    dirWithSlash.length
                                )
                            } else if (!relativePath.startsWith(dir)) {
                                // Not in specified directory, skip
                                continue
                            }
                        }
                        // Normalize to use / as separator
                        files.push(relativePath)
                    }
                }
            }

            continuationToken = response.NextContinuationToken
        } while (continuationToken)

        logger.debug(
            { dir, fileCount: files.length },
            "Files retrieved from S3 (SDK mode)"
        )
        return files
    }

    /**
     * List files using URL mode (requires file list or other method)
     * Note: URL mode cannot directly list objects, file paths must be known in advance
     * Returns empty array, file list must be provided through other means in actual usage
     */
    private async getFilesRecursivelyURL(dir: string): Promise<string[]> {
        // URL mode cannot directly list S3 objects
        // Need to get file list through other means (e.g., pre-configured file list)
        logger.warn(
            { dir },
            "URL mode does not support listing files. Please provide file list or use SDK mode."
        )
        return []
    }

    async readFile(filePath: string): Promise<string> {
        if (this.useSDK) {
            return this.readFileSDK(filePath)
        } else {
            return this.readFileURL(filePath)
        }
    }

    /**
     * Read file using SDK mode (supports private buckets)
     */
    private async readFileSDK(filePath: string): Promise<string> {
        if (!this.s3Client) {
            throw new Error("S3 client not initialized")
        }

        const fullKey = this.prefix ? `${this.prefix}/${filePath}` : filePath

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: fullKey,
            })

            const response = await this.s3Client.send(command)

            if (!response.Body) {
                throw new Error(`Empty response body for file: ${filePath}`)
            }

            // Convert stream to string
            const chunks: Uint8Array[] = []
            // @ts-ignore - Body may be ReadableStream
            for await (const chunk of response.Body) {
                chunks.push(chunk)
            }

            const buffer = Buffer.concat(chunks)
            const content = buffer.toString("utf-8")

            logger.debug({ filePath, size: content.length }, "File read from S3 (SDK mode)")
            return content
        } catch (error) {
            throw new Error(
                `Failed to read file ${filePath} from S3: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    /**
     * Read file using URL mode (public bucket)
     */
    private async readFileURL(filePath: string): Promise<string> {
        if (!this.baseUrl) {
            throw new Error("Base URL not configured for URL mode")
        }

        const fullKey = this.prefix ? `${this.prefix}/${filePath}` : filePath
        const url = `${this.baseUrl}/${fullKey}`

        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch ${url}: ${response.status} ${response.statusText}`
                )
            }

            const content = await response.text()
            logger.debug({ filePath, size: content.length }, "File read from S3 (URL mode)")
            return content
        } catch (error) {
            throw new Error(
                `Failed to read file ${filePath} from S3 URL: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}

