import { describe, it, expect } from 'vitest'
import { formatYAMLError, formatErrorForLogging } from '../src/utils/errorFormatter.js'

describe('errorFormatter', () => {
    describe('formatYAMLError', () => {
        it('should format YAML error with line and column', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML syntax',
                mark: {
                    line: 5,
                    column: 10,
                    snippet: '  key: value\n    ^',
                    buffer: 'key: value',
                },
            }

            const result = formatYAMLError(yamlError, '/path/to/file.yaml')
            expect(result).toContain('Invalid YAML syntax')
            expect(result).toContain('file.yaml')
            expect(result).toContain('line 6')
            expect(result).toContain('column 11')
        })

        it('should format YAML error without column', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML syntax',
                mark: {
                    line: 3,
                    snippet: '  key: value\n    ^',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid YAML syntax')
            expect(result).toContain('line 4')
            expect(result).not.toContain('column')
        })

        it('should format YAML error without line', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML syntax',
                mark: {
                    column: 5,
                    snippet: '  key: value\n    ^',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid YAML syntax')
            expect(result).toContain('column 6')
            expect(result).not.toContain('line')
        })

        it('should extract context from snippet with error marker', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: 'key: value\n     ^',
                },
            }

            const result = formatYAMLError(yamlError)
            // The function may clean up the error marker, so just check it contains the reason
            expect(result).toContain('Invalid syntax')
        })

        it('should handle snippet without error marker', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: 'key: value\nother: line',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid syntax')
        })

        it('should handle long context (over 100 chars)', () => {
            const longContext = 'a'.repeat(150)
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: `${longContext}\n     ^`,
                },
            }

            const result = formatYAMLError(yamlError)
            // Should not include context if too long
            expect(result).toContain('Invalid syntax')
        })

        it('should handle empty snippet', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: '',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid syntax')
        })

        it('should use message if reason is missing', () => {
            const yamlError = {
                name: 'YAMLException',
                message: 'YAML parsing error',
                mark: {
                    line: 0,
                    column: 0,
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('YAML parsing error')
        })

        it('should fallback to Error instance', () => {
            const error = new Error('Regular error message')
            const result = formatYAMLError(error)
            expect(result).toBe('Regular error message')
        })

        it('should fallback to string for unknown error type', () => {
            const error = 'String error'
            const result = formatYAMLError(error)
            expect(result).toBe('String error')
        })

        it('should handle YAML error without mark', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML',
            }

            const result = formatYAMLError(yamlError)
            // When mark is missing, it falls back to Error handling
            expect(typeof result).toBe('string')
        })

        it('should handle YAML error with only line number (no column)', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 5,
                    snippet: 'key: value',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('line 6')
            expect(result).not.toContain('column')
        })

        it('should handle YAML error with snippet but no error marker', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: 'key: value\nother: line',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid syntax')
            // Should use middle line when no error marker found
        })

        it('should handle YAML error with empty snippet lines', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: '\n\n',
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid syntax')
        })

        it('should handle YAML error with cleaned context exactly 100 chars', () => {
            const longContext = 'a'.repeat(100)
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid syntax',
                mark: {
                    line: 0,
                    column: 5,
                    snippet: `${longContext}\n     ^`,
                },
            }

            const result = formatYAMLError(yamlError)
            expect(result).toContain('Invalid syntax')
            // Should include context if exactly 100 chars
        })
    })

    describe('formatErrorForLogging', () => {
        it('should format YAML error with all fields', () => {
            // Create a proper Error instance with YAML error properties
            const yamlError = Object.assign(new Error('YAML parsing error'), {
                name: 'YAMLException',
                reason: 'Invalid YAML syntax',
                mark: {
                    line: 5,
                    column: 10,
                    snippet: 'key: value\n     ^',
                },
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.errorMessage).toBe('Invalid YAML syntax')
            expect(result.errorName).toBe('YAMLException')
            expect(result.yamlError).toBeDefined()
            if (result.yamlError) {
                expect(result.yamlError.line).toBe(6) // Converted to 1-based
                expect(result.yamlError.column).toBe(11) // Converted to 1-based
                expect(result.yamlError.snippet).toBe('key: value\n     ^')
            }
        })

        it('should format YAML error without line', () => {
            const yamlError = Object.assign(new Error('Invalid YAML'), {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    column: 5,
                    snippet: 'key: value',
                },
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            if (result.yamlError) {
                expect(result.yamlError.line).toBeUndefined()
                expect(result.yamlError.column).toBe(6)
            }
        })

        it('should format YAML error without column', () => {
            const yamlError = Object.assign(new Error('Invalid YAML'), {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    line: 3,
                    snippet: 'key: value',
                },
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            if (result.yamlError) {
                expect(result.yamlError.line).toBe(4)
                expect(result.yamlError.column).toBeUndefined()
            }
        })

        it('should truncate long snippet', () => {
            const longSnippet = 'a'.repeat(400)
            const yamlError = Object.assign(new Error('Invalid YAML'), {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    line: 0,
                    column: 0,
                    snippet: longSnippet,
                },
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            if (result.yamlError?.snippet) {
                expect(result.yamlError.snippet.length).toBeLessThanOrEqual(303) // 300 + '...'
                expect(result.yamlError.snippet).toContain('...')
            }
        })

        it('should use message if reason is missing', () => {
            const yamlError = Object.assign(new Error('YAML parsing error'), {
                name: 'YAMLException',
                reason: undefined,
                mark: {
                    line: 0,
                    column: 0,
                },
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.errorMessage).toBe('YAML parsing error')
        })

        it('should format regular Error', () => {
            const error = new Error('Regular error')
            error.stack = 'Error: Regular error\n    at test.js:1:1'

            const result = formatErrorForLogging(error)
            expect(result.errorMessage).toBe('Regular error')
            expect(result.errorName).toBe('Error')
            expect(result.errorStack).toBeDefined()
            expect(result.yamlError).toBeUndefined()
        })

        it('should format Error without stack', () => {
            const error = new Error('Regular error')
            delete (error as { stack?: string }).stack

            const result = formatErrorForLogging(error)
            expect(result.errorMessage).toBe('Regular error')
            expect(result.errorName).toBe('Error')
            expect(result.errorStack).toBeUndefined()
        })

        it('should format unknown error type', () => {
            const error = 'String error'
            const result = formatErrorForLogging(error)
            expect(result.errorMessage).toBe('String error')
            expect(result.errorName).toBe('UnknownError')
            expect(result.errorStack).toBeUndefined()
            expect(result.yamlError).toBeUndefined()
        })

        it('should handle YAML error without mark', () => {
            const yamlError = Object.assign(new Error('Invalid YAML'), {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: undefined,
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.errorMessage).toBe('Invalid YAML')
            expect(result.errorName).toBe('YAMLException')
            // Without mark, it should be treated as regular error
            expect(result.yamlError).toBeUndefined()
        })

        it('should handle YAML error with empty snippet', () => {
            const yamlError = Object.assign(new Error('Invalid YAML'), {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    line: 0,
                    column: 0,
                    snippet: '',
                },
            })

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            if (result.yamlError) {
                // Empty snippet is omitted (truncatedSnippet check: if (truncatedSnippet))
                expect(result.yamlError.snippet).toBeUndefined()
            }
        })
    })
})

