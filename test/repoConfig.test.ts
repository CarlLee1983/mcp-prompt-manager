import { describe, it, expect } from 'vitest'
import path from 'path'
import {
    parseRepoUrls,
    parseSingleRepoUrl,
    validateRepoConfig,
    sortReposByPriority,
    type RepoConfig,
} from '../src/config/repoConfig.js'

describe('repoConfig', () => {
    describe('parseRepoUrls', () => {
        it('should parse single URL', () => {
            const result = parseRepoUrls('https://github.com/user/repo.git')
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                url: 'https://github.com/user/repo.git',
                priority: 0,
            })
        })

        it('should parse multiple URLs (comma separated)', () => {
            const result = parseRepoUrls(
                'https://github.com/user/repo1.git,https://github.com/user/repo2.git'
            )
            expect(result).toHaveLength(2)
            expect(result[0]).toEqual({
                url: 'https://github.com/user/repo1.git',
                priority: 0,
            })
            expect(result[1]).toEqual({
                url: 'https://github.com/user/repo2.git',
                priority: 1,
            })
        })

        it('should handle URLs with whitespace', () => {
            const result = parseRepoUrls(
                ' https://github.com/user/repo1.git , https://github.com/user/repo2.git '
            )
            expect(result).toHaveLength(2)
            expect(result[0].url).toBe('https://github.com/user/repo1.git')
            expect(result[1].url).toBe('https://github.com/user/repo2.git')
        })

        it('should filter out empty strings', () => {
            const result = parseRepoUrls(
                'https://github.com/user/repo1.git,,https://github.com/user/repo2.git'
            )
            expect(result).toHaveLength(2)
            expect(result[0].url).toBe('https://github.com/user/repo1.git')
            expect(result[1].url).toBe('https://github.com/user/repo2.git')
        })

        it('should handle empty string', () => {
            const result = parseRepoUrls('')
            expect(result).toEqual([])
        })

        it('should handle string with only whitespace', () => {
            const result = parseRepoUrls('   ')
            expect(result).toEqual([])
        })

        it('should set correct priority for each URL (in order)', () => {
            const result = parseRepoUrls(
                'https://github.com/user/repo1.git,https://github.com/user/repo2.git,https://github.com/user/repo3.git'
            )
            expect(result[0].priority).toBe(0)
            expect(result[1].priority).toBe(1)
            expect(result[2].priority).toBe(2)
        })
    })

    describe('parseSingleRepoUrl', () => {
        it('should parse single URL (no branch)', () => {
            const result = parseSingleRepoUrl('https://github.com/user/repo.git')
            expect(result).toEqual({
                url: 'https://github.com/user/repo.git',
                branch: undefined,
                priority: 0,
            })
        })

        it('should parse single URL (with branch)', () => {
            const result = parseSingleRepoUrl(
                'https://github.com/user/repo.git',
                'develop'
            )
            expect(result).toEqual({
                url: 'https://github.com/user/repo.git',
                branch: 'develop',
                priority: 0,
            })
        })

        it('should set default priority to 0', () => {
            const result = parseSingleRepoUrl('https://github.com/user/repo.git')
            expect(result.priority).toBe(0)
        })
    })

    describe('validateRepoConfig', () => {
        describe('URL Validation', () => {
            it('should accept valid HTTP URL', () => {
                const config = { url: 'http://example.com/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.url).toBe('http://example.com/repo.git')
            })

            it('should accept valid HTTPS URL', () => {
                const config = { url: 'https://github.com/user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.url).toBe('https://github.com/user/repo.git')
            })

            it('should accept valid SSH URL (git@)', () => {
                const config = { url: 'git@github.com:user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.url).toBe('git@github.com:user/repo.git')
            })

            it('should accept valid absolute path', () => {
                const absolutePath = path.resolve('/tmp/test-repo')
                const config = { url: absolutePath }
                const result = validateRepoConfig(config)
                expect(result.url).toBe(absolutePath)
            })

            it('should reject relative path', () => {
                const config = { url: './relative/path' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('should reject URL with path traversal', () => {
                const config = { url: 'https://example.com/../malicious' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('should reject URL with null characters', () => {
                const config = { url: 'https://example.com/repo\0.git' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('should reject empty URL string', () => {
                const config = { url: '' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('should reject configuration missing url field', () => {
                const config = {}
                expect(() => validateRepoConfig(config)).toThrow()
            })
        })

        describe('Branch Validation', () => {
            it('should accept valid branch name', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    branch: 'main',
                }
                const result = validateRepoConfig(config)
                expect(result.branch).toBe('main')
            })

            it('should allow optional branch', () => {
                const config = { url: 'https://github.com/user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.branch).toBeUndefined()
            })

            it('should accept empty string branch', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    branch: '',
                }
                const result = validateRepoConfig(config)
                expect(result.branch).toBe('')
            })
        })

        describe('Priority Validation', () => {
            it('should accept valid priority number', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    priority: 5,
                }
                const result = validateRepoConfig(config)
                expect(result.priority).toBe(5)
            })

            it('should allow optional priority', () => {
                const config = { url: 'https://github.com/user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.priority).toBeUndefined()
            })

            it('should accept negative priority', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    priority: -1,
                }
                const result = validateRepoConfig(config)
                expect(result.priority).toBe(-1)
            })

            it('should accept zero priority', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    priority: 0,
                }
                const result = validateRepoConfig(config)
                expect(result.priority).toBe(0)
            })
        })

        describe('Full Configuration Validation', () => {
            it('should validate configuration with all fields', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    branch: 'develop',
                    priority: 1,
                }
                const result = validateRepoConfig(config)
                expect(result).toEqual({
                    url: 'https://github.com/user/repo.git',
                    branch: 'develop',
                    priority: 1,
                })
            })

            it('should reject invalid types', () => {
                const config = { url: 123 }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('should reject null configuration', () => {
                expect(() => validateRepoConfig(null)).toThrow()
            })

            it('should reject undefined configuration', () => {
                expect(() => validateRepoConfig(undefined)).toThrow()
            })
        })
    })

    describe('sortReposByPriority', () => {
        it('should sort by priority (lower number has higher priority)', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo3.com', priority: 2 },
                { url: 'https://repo1.com', priority: 0 },
                { url: 'https://repo2.com', priority: 1 },
            ]
            const result = sortReposByPriority(configs)
            expect(result[0].priority).toBe(0)
            expect(result[1].priority).toBe(1)
            expect(result[2].priority).toBe(2)
        })

        it('should handle configuration without priority (default to 999)', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo2.com', priority: 1 },
                { url: 'https://repo1.com' },
                { url: 'https://repo3.com', priority: 0 },
            ]
            const result = sortReposByPriority(configs)
            expect(result[0].priority).toBe(0)
            expect(result[1].priority).toBe(1)
            expect(result[2].priority).toBeUndefined()
        })

        it('should handle case where no configurations have priority', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo1.com' },
                { url: 'https://repo2.com' },
                { url: 'https://repo3.com' },
            ]
            const result = sortReposByPriority(configs)
            expect(result).toHaveLength(3)
            // All priorities are 999, order should be preserved
            expect(result[0].url).toBe('https://repo1.com')
            expect(result[1].url).toBe('https://repo2.com')
            expect(result[2].url).toBe('https://repo3.com')
        })

        it('should handle negative priority', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo2.com', priority: 1 },
                { url: 'https://repo1.com', priority: -1 },
                { url: 'https://repo3.com', priority: 0 },
            ]
            const result = sortReposByPriority(configs)
            expect(result[0].priority).toBe(-1)
            expect(result[1].priority).toBe(0)
            expect(result[2].priority).toBe(1)
        })

        it('should not modify original array', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo2.com', priority: 1 },
                { url: 'https://repo1.com', priority: 0 },
            ]
            const original = [...configs]
            sortReposByPriority(configs)
            expect(configs).toEqual(original)
        })

        it('should handle empty array', () => {
            const result = sortReposByPriority([])
            expect(result).toEqual([])
        })

        it('should handle single configuration', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo1.com', priority: 5 },
            ]
            const result = sortReposByPriority(configs)
            expect(result).toHaveLength(1)
            expect(result[0].priority).toBe(5)
        })

        it('should handle configurations with same priority', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo2.com', priority: 1 },
                { url: 'https://repo1.com', priority: 1 },
                { url: 'https://repo3.com', priority: 1 },
            ]
            const result = sortReposByPriority(configs)
            expect(result).toHaveLength(3)
            // When priorities are same, order should be stable
            expect(result.every((r) => r.priority === 1)).toBe(true)
        })
    })
})

