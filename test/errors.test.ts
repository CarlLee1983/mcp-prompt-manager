
import { describe, it, expect } from 'vitest'
import {
    McpError,
    RepositoryValidationError,
    RepositorySyncError,
    ConfigurationError,
    PromptLoadError,
} from '../src/types/errors.js'

describe('Custom Errors', () => {
    describe('McpError', () => {
        it('should verify name property', () => {
            const error = new McpError('Test error')
            expect(error.name).toBe('McpError')
            expect(error.message).toBe('Test error')
            expect(error).toBeInstanceOf(Error)
        })
    })

    describe('RepositoryValidationError', () => {
        it('should format message correctly with reason', () => {
            const error = new RepositoryValidationError('http://example.com', 'Invalid format')
            expect(error.name).toBe('RepositoryValidationError')
            expect(error.message).toBe('Repository validation failed for http://example.com: Invalid format')
            expect(error).toBeInstanceOf(McpError)
        })

        it('should format message correctly without reason', () => {
            const error = new RepositoryValidationError('http://example.com')
            expect(error.name).toBe('RepositoryValidationError')
            expect(error.message).toBe('Repository validation failed for http://example.com')
        })
    })

    describe('RepositorySyncError', () => {
        it('should format message correctly with original error', () => {
            const originalError = new Error('Network timeout')
            const error = new RepositorySyncError('http://example.com', 2, originalError)

            expect(error.name).toBe('RepositorySyncError')
            expect(error.message).toBe('Failed to sync repository http://example.com (Attempt 2): Network timeout')
            expect(error.cause).toBe(originalError)
            expect(error).toBeInstanceOf(McpError)
        })

        it('should format message correctly without original error', () => {
            const error = new RepositorySyncError('http://example.com', 1)

            expect(error.name).toBe('RepositorySyncError')
            expect(error.message).toBe('Failed to sync repository http://example.com (Attempt 1)')
            expect(error.cause).toBeUndefined()
        })
    })

    describe('ConfigurationError', () => {
        it('should verify name property', () => {
            const error = new ConfigurationError('Invalid config')
            expect(error.name).toBe('ConfigurationError')
            expect(error.message).toBe('Invalid config')
            expect(error).toBeInstanceOf(McpError)
        })
    })

    describe('PromptLoadError', () => {
        it('should format message correctly with original error', () => {
            const originalError = new Error('File not found')
            const error = new PromptLoadError('/path/to/prompt.yaml', originalError)

            expect(error.name).toBe('PromptLoadError')
            expect(error.message).toBe('Failed to load prompt from /path/to/prompt.yaml: File not found')
            expect(error.cause).toBe(originalError)
            expect(error).toBeInstanceOf(McpError)
        })

        it('should format message correctly without original error', () => {
            const error = new PromptLoadError('/path/to/prompt.yaml')

            expect(error.name).toBe('PromptLoadError')
            expect(error.message).toBe('Failed to load prompt from /path/to/prompt.yaml')
            expect(error.cause).toBeUndefined()
        })
    })
})
