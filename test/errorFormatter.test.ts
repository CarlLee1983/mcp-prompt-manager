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
            expect(result).toContain('key: value')
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
            expect(result).toContain('Invalid YAML')
        })
    })

    describe('formatErrorForLogging', () => {
        it('should format YAML error with all fields', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML syntax',
                message: 'YAML parsing error',
                mark: {
                    line: 5,
                    column: 10,
                    snippet: 'key: value\n     ^',
                },
            } as Error

            const result = formatErrorForLogging(yamlError)
            expect(result.errorMessage).toBe('Invalid YAML syntax')
            expect(result.errorName).toBe('YAMLException')
            expect(result.yamlError).toBeDefined()
            expect(result.yamlError?.line).toBe(6) // Converted to 1-based
            expect(result.yamlError?.column).toBe(11) // Converted to 1-based
            expect(result.yamlError?.snippet).toBe('key: value\n     ^')
        })

        it('should format YAML error without line', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    column: 5,
                    snippet: 'key: value',
                },
            } as Error

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            expect(result.yamlError?.line).toBeUndefined()
            expect(result.yamlError?.column).toBe(6)
        })

        it('should format YAML error without column', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    line: 3,
                    snippet: 'key: value',
                },
            } as Error

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            expect(result.yamlError?.line).toBe(4)
            expect(result.yamlError?.column).toBeUndefined()
        })

        it('should truncate long snippet', () => {
            const longSnippet = 'a'.repeat(400)
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    line: 0,
                    column: 0,
                    snippet: longSnippet,
                },
            } as Error

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError?.snippet).toBeDefined()
            expect(result.yamlError?.snippet?.length).toBeLessThanOrEqual(303) // 300 + '...'
            expect(result.yamlError?.snippet).toContain('...')
        })

        it('should use message if reason is missing', () => {
            const yamlError = {
                name: 'YAMLException',
                message: 'YAML parsing error',
                mark: {
                    line: 0,
                    column: 0,
                },
            } as Error

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
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML',
            } as Error

            const result = formatErrorForLogging(yamlError)
            expect(result.errorMessage).toBe('Invalid YAML')
            expect(result.errorName).toBe('YAMLException')
            expect(result.yamlError).toBeUndefined()
        })

        it('should handle YAML error with empty snippet', () => {
            const yamlError = {
                name: 'YAMLException',
                reason: 'Invalid YAML',
                mark: {
                    line: 0,
                    column: 0,
                    snippet: '',
                },
            } as Error

            const result = formatErrorForLogging(yamlError)
            expect(result.yamlError).toBeDefined()
            expect(result.yamlError?.snippet).toBe('')
        })
    })
})

