# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-30

### Added

#### Core Features
- Git-driven prompt repository synchronization
- Handlebars template engine support for dynamic prompts
- Handlebars partials support for reusable prompt fragments
- Local cache system with automatic expiration
- Group-based prompt filtering
- Zero-downtime hot-reload support
- Watch mode for automatic file and Git changes detection
- Prompt version management and state tracking
- Registry system for centralized prompt management
- System health monitoring and statistics

#### MCP Tools
- `mcp_reload` / `mcp_reload_prompts`: Hot-reload all prompts without restarting
- `mcp_stats` / `mcp_prompt_stats`: Get prompt statistics
- `mcp_list` / `mcp_prompt_list`: List all prompts with filtering options
- `mcp_inspect`: Inspect detailed information for a specific prompt
- `mcp_repo_switch`: Switch to a different prompt repository
- `preview_prompt`: Preview/render prompt templates with given arguments (debug utility)
  - Schema validation warnings
  - Token count estimation
  - Variable highlighting with Markdown

#### MCP Resources
- `system://health`: System health status resource
- `prompts://list`: Complete prompts list resource

#### Performance Optimizations
- Template pre-compilation at load time
- Prompt caching system (CachedPrompt)
- File system caching with TTL-based expiration
- Singleton pattern for SourceManager

#### Developer Experience
- Comprehensive test suite (107 tests, all passing)
- TypeScript with full type safety
- Structured logging with pino
- MCP Inspector integration for debugging
- Complete documentation (English and Traditional Chinese)

#### Configuration
- Environment variable validation with Zod
- Support for multiple repository URLs
- System repository support for common group prompts
- Flexible group filtering
- Configurable cache cleanup intervals
- Multiple log levels and file logging support

### Security
- Input validation for all environment variables
- Path traversal attack prevention
- Group name format validation

### Documentation
- Complete README in English and Traditional Chinese
- Usage examples for multiple MCP clients (Cursor, Claude Desktop, VS Code, Continue, Aider)
- Configuration guide
- Troubleshooting guide
- Development guide

---

[1.0.0]: https://github.com/CarlLee1983/mcp-prompt-manager/releases/tag/v1.0.0

