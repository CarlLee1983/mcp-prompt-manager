import { z } from "zod"

/**
 * Prompt Metadata Schema
 * Used to validate embedded metadata in YAML files
 */
export const PromptMetadataSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.enum(["draft", "stable", "deprecated"]),
    tags: z.array(z.string()).default([]),
    use_cases: z.array(z.string()).default([]),
    dependencies: z
        .object({
            partials: z.array(z.string()).default([]),
        })
        .optional(),
})

/**
 * Prompt Metadata Type
 * Type inferred from Zod Schema
 */
export type PromptMetadata = z.infer<typeof PromptMetadataSchema>
