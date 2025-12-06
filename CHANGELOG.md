# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-XX

### Added

#### Deployment & Infrastructure

-   Docker support with multi-stage builds and production-ready configuration
-   Docker Compose files for development and production environments
-   Kubernetes Helm chart for container orchestration
-   Docker entrypoint script for loading repository URL secrets from files
-   Dev Container configuration for consistent development environment

#### Cache System Enhancements

-   Multi-provider cache abstraction layer (Local, Redis-ready)
-   Enhanced local cache with LRU eviction mechanism
-   Cache statistics and monitoring (hits, misses, evictions, expirations)
-   Configurable TTL (Time-To-Live) support for cache entries
-   Periodic cache cleanup with configurable intervals
-   Top keys tracking and average access count metrics

#### Watch Mode & Monitoring

-   Watch mode with Git polling for remote repositories
-   Automatic file change detection for local repositories
-   Enhanced YAML error reporting for prompt loading

#### Developer Experience

-   Marketplace installation instructions and `mcp.json.example` configuration template
-   Node.js and pnpm engine requirements in `package.json`
-   Comprehensive test coverage improvements (from ~55% to 87%+)
-   GitFactory for `simple-git` dependency injection
-   Enhanced ESLint configuration with TypeScript strict mode
-   Pre-commit hooks with Husky and lint-staged
-   Makefile for common development tasks
-   GitHub Actions CI/CD workflow with multi-version Node.js testing
-   CodeQL security scanning workflow
-   Dependabot configuration for automated dependency updates

#### Documentation

-   Docker deployment guide (`DOCKER.md`)
-   Security policy (`SECURITY.md`)
-   Contribution guidelines (`CONTRIBUTING.md`)
-   GitHub Release automation guide (`CREATE_RELEASE.md`)
-   Coverage analysis documentation
-   Enhanced README with marketplace installation section
-   Issue and pull request templates

#### Testing

-   Comprehensive test suite expansion (463+ tests)
-   Unit tests for Git and Local repository strategies
-   Integration tests for loaders and source manager
-   Error formatter tests for improved YAML error handling
-   Test coverage thresholds and reporting

### Changed

#### Configuration

-   Deferred validation of `PROMPT_REPO_URL` and `PROMPT_REPO_URLS` to `getRepoConfigs()` for improved module loading
-   Enhanced Zod schema optional field detection
-   Standardized string literal quotes to double quotes across codebase

#### Code Quality

-   Improved type inference with `as const` assertions
-   Enhanced ESLint suppressions and error handling
-   Refactored comments and documentation for clarity

### Fixed

-   Fixed infinite recursion in test mocks by using original `fs.stat`
-   Fixed default `simpleGit` options handling when undefined
-   Fixed test environment variable handling for `MCP_GROUPS`

### Security

-   Enhanced security notes in README with `.env` file warnings
-   Secret management best practices documentation
-   CodeQL security scanning integration

---

## [1.0.0] - 2024-12-30

### Added

#### Core Features

-   Git-driven prompt repository synchronization
-   Handlebars template engine support for dynamic prompts
-   Handlebars partials support for reusable prompt fragments
-   Local cache system with automatic expiration
-   Group-based prompt filtering
-   Zero-downtime hot-reload support
-   Watch mode for automatic file and Git changes detection
-   Prompt version management and state tracking
-   Registry system for centralized prompt management
-   System health monitoring and statistics

#### MCP Tools

-   `mcp_reload` / `mcp_reload_prompts`: Hot-reload all prompts without restarting
-   `mcp_stats` / `mcp_prompt_stats`: Get prompt statistics
-   `mcp_list` / `mcp_prompt_list`: List all prompts with filtering options
-   `mcp_inspect`: Inspect detailed information for a specific prompt
-   `mcp_repo_switch`: Switch to a different prompt repository
-   `preview_prompt`: Preview/render prompt templates with given arguments (debug utility)
    -   Schema validation warnings
    -   Token count estimation
    -   Variable highlighting with Markdown

#### MCP Resources

-   `system://health`: System health status resource
-   `prompts://list`: Complete prompts list resource

#### Performance Optimizations

-   Template pre-compilation at load time
-   Prompt caching system (CachedPrompt)
-   File system caching with TTL-based expiration
-   Singleton pattern for SourceManager

#### Developer Experience

-   Comprehensive test suite (107 tests, all passing)
-   TypeScript with full type safety
-   Structured logging with pino
-   MCP Inspector integration for debugging
-   Complete documentation (English and Traditional Chinese)

#### Configuration

-   Environment variable validation with Zod
-   Support for multiple repository URLs
-   System repository support for common group prompts
-   Flexible group filtering
-   Configurable cache cleanup intervals
-   Multiple log levels and file logging support

### Security

-   Input validation for all environment variables
-   Path traversal attack prevention
-   Group name format validation

### Documentation

-   Complete README in English and Traditional Chinese
-   Usage examples for multiple MCP clients (Cursor, Claude Desktop, VS Code, Continue, Aider)
-   Configuration guide
-   Troubleshooting guide
-   Development guide

---

[1.1.0]: https://github.com/CarlLee1983/mcp-prompt-manager/releases/tag/v1.1.0
[1.0.0]: https://github.com/CarlLee1983/mcp-prompt-manager/releases/tag/v1.0.0
