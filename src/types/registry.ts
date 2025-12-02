import { z } from 'zod'

/**
 * Registry Schema
 * 用於驗證 registry.yaml 檔案結構
 */
export const RegistrySchema = z.object({
    prompts: z.array(
        z.object({
            id: z.string(),
            group: z.string().optional(),
            visibility: z
                .enum(['public', 'private', 'internal'])
                .default('public'),
            deprecated: z.boolean().default(false),
        })
    ),
})

/**
 * Registry Type
 * 從 Zod Schema 推導出的型別
 */
export type Registry = z.infer<typeof RegistrySchema>

