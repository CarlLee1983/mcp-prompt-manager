import { z } from 'zod'

/**
 * Registry Schema
 * Used to validate registry.yaml file structure
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
 * Type inferred from Zod Schema
 */
export type Registry = z.infer<typeof RegistrySchema>

