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
        it('應該解析單一 URL', () => {
            const result = parseRepoUrls('https://github.com/user/repo.git')
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                url: 'https://github.com/user/repo.git',
                priority: 0,
            })
        })

        it('應該解析多個 URL（逗號分隔）', () => {
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

        it('應該處理帶空格的 URL', () => {
            const result = parseRepoUrls(
                ' https://github.com/user/repo1.git , https://github.com/user/repo2.git '
            )
            expect(result).toHaveLength(2)
            expect(result[0].url).toBe('https://github.com/user/repo1.git')
            expect(result[1].url).toBe('https://github.com/user/repo2.git')
        })

        it('應該過濾空字串', () => {
            const result = parseRepoUrls(
                'https://github.com/user/repo1.git,,https://github.com/user/repo2.git'
            )
            expect(result).toHaveLength(2)
            expect(result[0].url).toBe('https://github.com/user/repo1.git')
            expect(result[1].url).toBe('https://github.com/user/repo2.git')
        })

        it('應該處理空字串', () => {
            const result = parseRepoUrls('')
            expect(result).toEqual([])
        })

        it('應該處理只有空白的字串', () => {
            const result = parseRepoUrls('   ')
            expect(result).toEqual([])
        })

        it('應該為每個 URL 設定正確的優先級（按順序）', () => {
            const result = parseRepoUrls(
                'https://github.com/user/repo1.git,https://github.com/user/repo2.git,https://github.com/user/repo3.git'
            )
            expect(result[0].priority).toBe(0)
            expect(result[1].priority).toBe(1)
            expect(result[2].priority).toBe(2)
        })
    })

    describe('parseSingleRepoUrl', () => {
        it('應該解析單一 URL（無分支）', () => {
            const result = parseSingleRepoUrl('https://github.com/user/repo.git')
            expect(result).toEqual({
                url: 'https://github.com/user/repo.git',
                branch: undefined,
                priority: 0,
            })
        })

        it('應該解析單一 URL（含分支）', () => {
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

        it('應該設定預設優先級為 0', () => {
            const result = parseSingleRepoUrl('https://github.com/user/repo.git')
            expect(result.priority).toBe(0)
        })
    })

    describe('validateRepoConfig', () => {
        describe('URL 驗證', () => {
            it('應該接受有效的 HTTP URL', () => {
                const config = { url: 'http://example.com/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.url).toBe('http://example.com/repo.git')
            })

            it('應該接受有效的 HTTPS URL', () => {
                const config = { url: 'https://github.com/user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.url).toBe('https://github.com/user/repo.git')
            })

            it('應該接受有效的 SSH URL（git@）', () => {
                const config = { url: 'git@github.com:user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.url).toBe('git@github.com:user/repo.git')
            })

            it('應該接受有效的絕對路徑', () => {
                const absolutePath = path.resolve('/tmp/test-repo')
                const config = { url: absolutePath }
                const result = validateRepoConfig(config)
                expect(result.url).toBe(absolutePath)
            })

            it('應該拒絕相對路徑', () => {
                const config = { url: './relative/path' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('應該拒絕包含路徑遍歷的 URL', () => {
                const config = { url: 'https://example.com/../malicious' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('應該拒絕包含 null 字元的 URL', () => {
                const config = { url: 'https://example.com/repo\0.git' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('應該拒絕空字串 URL', () => {
                const config = { url: '' }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('應該拒絕缺少 url 欄位的配置', () => {
                const config = {}
                expect(() => validateRepoConfig(config)).toThrow()
            })
        })

        describe('分支驗證', () => {
            it('應該接受有效的分支名稱', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    branch: 'main',
                }
                const result = validateRepoConfig(config)
                expect(result.branch).toBe('main')
            })

            it('應該允許分支為可選', () => {
                const config = { url: 'https://github.com/user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.branch).toBeUndefined()
            })

            it('應該接受空字串分支', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    branch: '',
                }
                const result = validateRepoConfig(config)
                expect(result.branch).toBe('')
            })
        })

        describe('優先級驗證', () => {
            it('應該接受有效的優先級數字', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    priority: 5,
                }
                const result = validateRepoConfig(config)
                expect(result.priority).toBe(5)
            })

            it('應該允許優先級為可選', () => {
                const config = { url: 'https://github.com/user/repo.git' }
                const result = validateRepoConfig(config)
                expect(result.priority).toBeUndefined()
            })

            it('應該接受負數優先級', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    priority: -1,
                }
                const result = validateRepoConfig(config)
                expect(result.priority).toBe(-1)
            })

            it('應該接受零優先級', () => {
                const config = {
                    url: 'https://github.com/user/repo.git',
                    priority: 0,
                }
                const result = validateRepoConfig(config)
                expect(result.priority).toBe(0)
            })
        })

        describe('完整配置驗證', () => {
            it('應該驗證包含所有欄位的配置', () => {
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

            it('應該拒絕無效的類型', () => {
                const config = { url: 123 }
                expect(() => validateRepoConfig(config)).toThrow()
            })

            it('應該拒絕 null 配置', () => {
                expect(() => validateRepoConfig(null)).toThrow()
            })

            it('應該拒絕 undefined 配置', () => {
                expect(() => validateRepoConfig(undefined)).toThrow()
            })
        })
    })

    describe('sortReposByPriority', () => {
        it('應該按優先級排序（數字越小優先級越高）', () => {
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

        it('應該處理沒有優先級的配置（預設為 999）', () => {
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

        it('應該處理所有配置都沒有優先級的情況', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo1.com' },
                { url: 'https://repo2.com' },
                { url: 'https://repo3.com' },
            ]
            const result = sortReposByPriority(configs)
            expect(result).toHaveLength(3)
            // 所有優先級都是 999，順序應該保持不變
            expect(result[0].url).toBe('https://repo1.com')
            expect(result[1].url).toBe('https://repo2.com')
            expect(result[2].url).toBe('https://repo3.com')
        })

        it('應該處理負數優先級', () => {
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

        it('應該不修改原始陣列', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo2.com', priority: 1 },
                { url: 'https://repo1.com', priority: 0 },
            ]
            const original = [...configs]
            sortReposByPriority(configs)
            expect(configs).toEqual(original)
        })

        it('應該處理空陣列', () => {
            const result = sortReposByPriority([])
            expect(result).toEqual([])
        })

        it('應該處理單一配置', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo1.com', priority: 5 },
            ]
            const result = sortReposByPriority(configs)
            expect(result).toHaveLength(1)
            expect(result[0].priority).toBe(5)
        })

        it('應該處理相同優先級的配置', () => {
            const configs: RepoConfig[] = [
                { url: 'https://repo2.com', priority: 1 },
                { url: 'https://repo1.com', priority: 1 },
                { url: 'https://repo3.com', priority: 1 },
            ]
            const result = sortReposByPriority(configs)
            expect(result).toHaveLength(3)
            // 相同優先級時，順序應該保持穩定
            expect(result.every((r) => r.priority === 1)).toBe(true)
        })
    })
})

