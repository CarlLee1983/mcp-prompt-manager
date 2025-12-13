import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

export default tseslint.config(
    // Global ignores - replaces .eslintignore
    {
        ignores: [
            "node_modules/",
            "dist/",
            "coverage/",
            ".prompts_cache/",
            "*.config.js",
            "*.config.mjs",
            "*.config.ts",
            "scripts/",
            ".github/",
        ],
    },

    // Base ESLint recommended rules
    eslint.configs.recommended,

    // TypeScript ESLint recommended rules
    ...tseslint.configs.recommendedTypeChecked,

    // Prettier config (disables conflicting rules)
    eslintConfigPrettier,

    // Custom configuration for TypeScript files
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/restrict-template-expressions": [
                "error",
                {
                    allowNumber: true,
                    allowBoolean: true,
                    allowAny: false,
                    allowNullish: true,
                },
            ],
        },
    }
)
