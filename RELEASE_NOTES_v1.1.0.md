# 🎉 Release v1.1.0

This release adds significant deployment capabilities, enhanced caching system, improved developer experience, and comprehensive testing coverage.

## ✨ What's New

### 🐳 Docker & Kubernetes Support

-   **Docker Support**: Complete Docker setup with multi-stage builds, production-ready configuration, and Docker Compose files
-   **Kubernetes Deployment**: Helm chart for easy Kubernetes deployment
-   **Dev Container**: VS Code Dev Container configuration for consistent development environment

### 🚀 Enhanced Cache System

-   **Multi-Provider Cache**: Abstraction layer supporting local cache and Redis (ready for future multi-host deployments)
-   **LRU Eviction**: Intelligent cache eviction based on access patterns
-   **Cache Statistics**: Comprehensive metrics including hits, misses, evictions, and expirations
-   **TTL Support**: Configurable Time-To-Live for cache entries
-   **Periodic Cleanup**: Automatic cleanup of expired cache entries

### 📊 Testing & Quality

-   **Test Coverage**: Increased from ~55% to **87%+** with 463+ tests
-   **CI/CD**: GitHub Actions workflow with multi-version Node.js testing (16.x, 18.x, 20.x)
-   **Code Quality**: Enhanced ESLint configuration, pre-commit hooks, and TypeScript strict mode
-   **Security**: CodeQL scanning and Dependabot for dependency updates

### 🛠️ Developer Experience

-   **Marketplace Ready**: Installation instructions and `mcp.json.example` for marketplace deployment
-   **Engine Requirements**: Explicit Node.js and pnpm version requirements
-   **Documentation**: Comprehensive guides for Docker, security, and contributions
-   **GitFactory**: Dependency injection for `simple-git` with Zod validation

### 📝 Documentation

-   Docker deployment guide
-   Security policy
-   Contribution guidelines
-   GitHub Release automation guide
-   Enhanced README with marketplace installation section

## 🔧 Improvements

-   Enhanced YAML error reporting for prompt loading
-   Improved type inference and code quality
-   Standardized code style across codebase
-   Better error handling in tests and production code

## 🐛 Bug Fixes

-   Fixed infinite recursion in test mocks
-   Fixed `simpleGit` options handling
-   Fixed test environment variable handling

## 📊 Statistics

-   **Total Tests**: 463+ (all passing)
-   **Test Coverage**: 87%+ (up from ~55%)
-   **MCP Tools**: 8 management tools + dynamic prompt tools
-   **MCP Resources**: 2
-   **Documentation**: English + Traditional Chinese

## 🚀 Getting Started

### Docker Deployment (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/CarlLee1983/mcp-prompt-manager.git
cd mcp-prompt-manager

# 2. Copy environment variables
cp .env.docker.example .env

# 3. Edit .env and set your Git repository URL
# PROMPT_REPO_URL=https://github.com/yourusername/your-prompts-repo.git

# 4. Start with Docker Compose
docker-compose up -d
```

For detailed instructions, see [DOCKER.md](./DOCKER.md).

### Marketplace Installation

If installing from an MCP marketplace (e.g., [mcp.so](https://mcp.so/)), see the [Marketplace Installation](./README.md#option-1-marketplace-installation-easiest) section in the README.

## 📦 Upgrade from v1.0.0

This is a **minor version update** with backward-compatible changes. No breaking changes.

### Recommended Steps

1. **Update dependencies**:

    ```bash
    pnpm install
    ```

2. **Rebuild the project**:

    ```bash
    pnpm build
    ```

3. **Review new configuration options**:

    - Check `package.json` for new `engines` requirements
    - Review Docker configuration if using containerized deployment
    - Check cache configuration options in `.env.example`

4. **Test your setup**:
    ```bash
    pnpm test:run
    ```

## 🙏 Thank You

Thank you for using MCP Prompt Manager! If you encounter any issues or have suggestions, please open an issue on GitHub.

---

**Full Changelog**: https://github.com/CarlLee1983/mcp-prompt-manager/compare/v1.0.0...v1.1.0
