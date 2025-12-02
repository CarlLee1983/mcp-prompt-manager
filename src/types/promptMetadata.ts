import { z } from 'zod'

/**
 * Prompt Metadata Schema
 * 用於驗證 YAML 檔案中內嵌的 metadata
 */
export const PromptMetadataSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.enum(['draft', 'stable', 'deprecated']),
    tags: z.array(z.string()).default([]),
    use_cases: z.array(z.string()).default([]),
})

/**
 * Prompt Metadata Type
 * 從 Zod Schema 推導出的型別
 */
export type PromptMetadata = z.infer<typeof PromptMetadataSchema>

