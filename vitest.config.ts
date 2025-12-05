import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.test.ts',
                '**/*.config.ts',
                '**/index.ts', // Entry point files
            ],
            thresholds: {
                lines: 75,
                functions: 75,
                branches: 70,
                statements: 80,
            },
        },
    },
})

