# 🎉 Release v1.0.0

First stable release of MCP Prompt Manager - A Git-driven MCP Server for managing and providing Prompt templates with Handlebars support.

## ✨ Features

### Core Features
- ✅ Git-driven prompt repository synchronization
- ✅ Handlebars template engine support for dynamic prompts
- ✅ Handlebars partials support for reusable prompt fragments
- ✅ Local cache system with automatic expiration
- ✅ Group-based prompt filtering
- ✅ Zero-downtime hot-reload support
- ✅ Watch mode for automatic file and Git changes detection
- ✅ Prompt version management and state tracking
- ✅ Registry system for centralized prompt management
- ✅ System health monitoring and statistics

### MCP Tools
- `mcp_reload` / `mcp_reload_prompts`: Hot-reload all prompts without restarting
- `mcp_stats` / `mcp_prompt_stats`: Get prompt statistics
- `mcp_list` / `mcp_prompt_list`: List all prompts with filtering options
- `mcp_inspect`: Inspect detailed information for a specific prompt
- `mcp_repo_switch`: Switch to a different prompt repository
- `preview_prompt`: Preview/render prompt templates with given arguments (debug utility)
  - Schema validation warnings
  - Token count estimation
  - Variable highlighting with Markdown

### MCP Resources
- `system://health`: System health status resource
- `prompts://list`: Complete prompts list resource

### Performance Optimizations
- Template pre-compilation at load time
- Prompt caching system (CachedPrompt)
- File system caching with TTL-based expiration
- Singleton pattern for SourceManager

### Developer Experience
- Comprehensive test suite (107 tests, all passing)
- TypeScript with full type safety
- Structured logging with pino
- MCP Inspector integration for debugging
- Complete documentation (English and Traditional Chinese)

### Configuration
- Environment variable validation with Zod
- Support for multiple repository URLs
- System repository support for common group prompts
- Flexible group filtering
- Configurable cache cleanup intervals
- Multiple log levels and file logging support

## 🔒 Security
- Input validation for all environment variables
- Path traversal attack prevention
- Group name format validation

## 📝 Documentation
- Complete README in English and Traditional Chinese
- Usage examples for multiple MCP clients (Cursor, Claude Desktop, VS Code, Continue, Aider)
- Configuration guide
- Troubleshooting guide
- Development guide
- `.env.example` configuration template
- `CHANGELOG.md` with detailed change history

## 🚀 Getting Started

1. Install the package:
```bash
npm install -g mcp-prompt-manager
# or
pnpm add -g mcp-prompt-manager
```

2. Configure your environment:
```bash
cp .env.example .env
# Edit .env with your prompt repository URL
```

3. Start the MCP server and use it with your favorite MCP client!

## 📊 Statistics
- **Total Tests**: 107 (all passing)
- **MCP Tools**: 6 management tools + dynamic prompt tools
- **MCP Resources**: 2
- **Documentation**: English + Traditional Chinese
- **Type Coverage**: 100% TypeScript

## 🙏 Thank You

Thank you for using MCP Prompt Manager! If you encounter any issues or have suggestions, please open an issue on GitHub.

---

**Full Changelog**: https://github.com/CarlLee1983/mcp-prompt-manager/compare/initial...v1.0.0

