# MCP Prompt Manager (Git-Driven)

<div align="center">

**Git-driven Model Context Protocol (MCP) Server for managing and providing Prompt templates**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/CarlLee1983/mcp-prompt-manager)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen.svg)](https://github.com/CarlLee1983/mcp-prompt-manager)

[English](README.md) | [繁體中文](README.zh-TW.md)

</div>

## 📋 Introduction

This is a Git-driven Model Context Protocol (MCP) Server designed for managing and providing Prompt templates. It allows you to store Prompts in a separate Git Repository and use them directly in AI editors like Cursor, Claude Desktop, etc., through the MCP protocol.

**Key Benefits:**
- 🔄 Team Collaboration: Ensure unified Prompt versions across teams through Git version control
- 🎯 Dynamic Templates: Support Handlebars syntax to create reusable dynamic Prompts
- 🚀 Zero-Downtime Reload: Hot-reload support to update Prompts without restarting
- 🔍 Smart Management: Built-in Prompt version management, state tracking, and group filtering
- 📊 Complete Monitoring: System health status and Prompt statistics

## ✨ Features

- **Git Sync**: Prompts are synced directly from the specified Git Repository, ensuring teams use unified Prompt versions.
- **Handlebars Templates**: Support powerful Handlebars syntax to create dynamic, reusable Prompt templates.
- **Partials Support**: Support Handlebars Partials for splitting and reusing Prompt fragments (e.g., role settings, output formats).
- **Local Cache**: Automatically cache Git Repo content to local `.prompts_cache` directory for faster reads.
- **Cache Expiration Strategy**: Automatically clean up expired cache items periodically to prevent memory leaks and ensure data consistency.
- **Group Filtering**: Support filtering prompts by group, loading only what you need.
- **Error Handling**: Complete error statistics and reporting for issue tracking.
- **Retry Mechanism**: Automatic retry for Git operations to improve reliability.
- **Type Safety**: Use Zod to validate configuration and prompt definitions for type safety.
- **Professional Logging**: Use pino logging system with structured logs and multiple log levels.

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

The easiest way to get started is using Docker:

```bash
# 1. Clone the repository
git clone <project URL>
cd mcp-prompt-manager

# 2. Copy environment variables example
cp .env.docker.example .env

# 3. Edit .env and set your Git repository URL
# PROMPT_REPO_URL=https://github.com/yourusername/your-prompts-repo.git

# 4. Start with Docker Compose
docker-compose up -d

# 5. View logs
docker-compose logs -f
```

For detailed Docker deployment instructions, see [DOCKER.md](DOCKER.md).

### Option 2: Local Installation

### 1. Installation

First, clone this project and install dependencies:

```bash
git clone <project URL>
cd mcp-prompt-manager
npm install
# or use pnpm (recommended)
pnpm install
```

> Note: Installs are enforced with pnpm; npm/yarn will fail because of the preinstall check.

### 2. Configure Environment Variables

Copy the example configuration file and create `.env`:

```bash
cp .env.example .env
```

Edit the `.env` file to set your Prompt Git Repository path or URL:

```bash
# Git Repository source (required)
# Local path example
PROMPT_REPO_URL=/Users/yourname/Desktop/my-local-prompts

# Or remote Git URL examples
# PROMPT_REPO_URL=https://github.com/yourusername/my-prompts.git
# PROMPT_REPO_URL=git@github.com:yourusername/my-prompts.git

# Output language setting (optional, default: en)
MCP_LANGUAGE=en  # or zh

# Group filter setting (optional, defaults to loading only common group when not set)
# Example: MCP_GROUPS="laravel,vue,react"
# Note: When not set, the system will explicitly prompt in logs about using default groups
MCP_GROUPS=laravel,vue

# Custom storage directory (optional, default: .prompts_cache)
STORAGE_DIR=/custom/path

# Git branch (optional, default: main)
GIT_BRANCH=main

# Git retry count (optional, default: 3)
GIT_MAX_RETRIES=3

# Cache cleanup interval (optional, default: 10000 milliseconds)
# Set the interval time (in milliseconds) for periodic cleanup of expired cache items
# Default is 10 seconds (CACHE_TTL * 2) to ensure expired items are cleaned up promptly
# Recommended values: 5000-30000 milliseconds, adjust based on usage frequency
CACHE_CLEANUP_INTERVAL=10000

# Log level (optional)
# Options: fatal, error, warn, info, debug, trace, silent
# Notes:
# - stderr only outputs warn/error/fatal level logs (to avoid being marked as error)
# - info/debug/trace level logs only output to file (if LOG_FILE is set)
# - If LOG_FILE is not set, info level logs are completely suppressed (to avoid confusion)
# - Production environment defaults to warn (only warnings and errors), development defaults to info
# - Setting silent completely disables log output
LOG_LEVEL=info

# Log file path (optional, strongly recommended)
# After setting this variable, all level logs will be written to file (JSON format)
# stderr still only outputs warn/error/fatal (to avoid being marked as error)
# Can be absolute or relative path (relative to project root)
# Examples:
# LOG_FILE=/tmp/mcp-prompt-manager.log
# LOG_FILE=logs/mcp.log
# Note: File is written in append mode, will not overwrite existing content
# Recommendation: Set this variable to view complete logs (including info level)
LOG_FILE=logs/mcp.log
```

### 3. Build

```bash
npm run build
# or
pnpm run build
```

## 🛠️ Usage

### Testing with Inspector

We provide a convenient command to start the MCP Inspector for testing:

#### Basic Usage

**Important**: Inspector runs the compiled `dist/index.js`, so if you've modified the source code, you need to compile first:

```bash
# 1. Compile first (if source code was modified)
pnpm run build

# 2. Start Inspector
pnpm run inspector
```

#### Quick Development Mode

If you're developing, you can use a combined command that automatically compiles before starting Inspector:

```bash
pnpm run inspector:dev
```

This automatically runs `build` and then starts Inspector, ensuring you're testing the latest compiled code.

#### Inspector Features

Inspector launches a web interface where you can:

- View all loaded prompts
- Test prompt output
- Check error messages
- Verify environment variable settings

### Using in Cursor

#### Configuration File Location

**macOS:**

```
~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json
```

**Windows:**

```
%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json
```

**Linux:**

```
~/.config/Cursor/User/globalStorage/cursor.mcp/mcp.json
```

#### Configuration Steps

1. **Find the configuration file**:
    - Method 1: In Cursor, press `Cmd/Ctrl + Shift + P`, search for "MCP: Add server"
    - Method 2: Directly edit the `mcp.json` file at the path above

2. **Edit the configuration file**:

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "/Users/yourname/Desktop/my-local-prompts",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

3. **Important Configuration Notes**:
    - `command`: Use `node` to execute the compiled JavaScript file
    - `args`: Must be an **absolute path** pointing to `dist/index.js`
    - `env`: Environment variables (optional, if already set in `.env`)

4. **Verify Configuration**:
    - Restart Cursor
    - In Cursor, press `Cmd/Ctrl + Shift + P`, search for "MCP: Show servers"
    - Confirm that `mcp-prompt-manager` shows as connected

> **Note**:
>
> - Replace `/path/to/mcp-prompt-manager` with the actual absolute path of this project
> - If environment variables are already set in `.env`, the `env` block can be omitted, but specifying directly in JSON is usually more robust
> - If the configuration file doesn't exist, you need to create the `mcp.json` file first

### Using in Claude Desktop

#### Configuration File Location

**macOS:**

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**

```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**

```
~/.config/Claude/claude_desktop_config.json
```

#### Configuration Steps

1. **Create or edit the configuration file**:

If the file doesn't exist, create it first:

```bash
# macOS/Linux
mkdir -p ~/Library/Application\ Support/Claude
touch ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. **Edit the configuration file**:

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "/Users/yourname/Desktop/my-local-prompts",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

3. **Verify Configuration**:
    - Completely close Claude Desktop (ensure all windows are closed)
    - Restart Claude Desktop
    - In conversations, Claude should be able to use your defined prompts

> **Note**:
>
> - Configuration file must be valid JSON format
> - Paths must use absolute paths
> - After modifying the configuration file, you must completely restart Claude Desktop

### Using in VS Code (via Extension)

VS Code can use MCP Server through MCP extensions.

#### Configuration Steps

1. **Install MCP Extension**:
    - Search for "MCP" or "Model Context Protocol" in VS Code Extension Marketplace
    - Install the corresponding extension

2. **Configure MCP Server**:
    - Open VS Code settings (`Cmd/Ctrl + ,`)
    - Search for "MCP" related settings
    - Or edit `settings.json`:

```json
{
    "mcp.servers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "/path/to/your/repo",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

### Using in Continue

Continue is an open-source AI code assistant that supports MCP.

#### Configuration File Location

**macOS:**

```
~/.continue/config.json
```

**Windows:**

```
%APPDATA%\Continue\config.json
```

**Linux:**

```
~/.config/Continue/config.json
```

#### Configuration Steps

Edit `config.json`:

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "/path/to/your/repo",
                "MCP_LANGUAGE": "zh",
                "MCP_GROUPS": "laravel,vue"
            }
        }
    }
}
```

### Using in Aider

Aider is an AI code editor that supports MCP.

#### Configuration Method

In Aider's configuration file (usually `~/.aider/config.json` or via environment variables):

```json
{
    "mcp_servers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "/path/to/your/repo"
            }
        }
    }
}
```

### Using in Custom Applications (Programmatic)

If you're developing your own application and want to integrate the MCP Server, you can use the MCP SDK:

#### TypeScript/JavaScript Example

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { spawn } from "child_process"

// Create MCP Client
const client = new Client(
    {
        name: "my-app",
        version: "1.0.0",
    },
    {
        capabilities: {},
    }
)

// Create transport (using stdio)
const transport = new StdioClientTransport({
    command: "node",
    args: ["/path/to/mcp-prompt-manager/dist/index.js"],
    env: {
        PROMPT_REPO_URL: "/path/to/repo",
        MCP_LANGUAGE: "en",
    },
})

// Connect
await client.connect(transport)

// List available prompts
const prompts = await client.listPrompts()
console.log("Available prompts:", prompts)

// Get specific prompt
const prompt = await client.getPrompt({
    name: "code-review",
    arguments: {
        code: "const x = 1",
        language: "TypeScript",
    },
})
```

#### Python Example

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Configure server parameters
    server_params = StdioServerParameters(
        command="node",
        args=["/path/to/mcp-prompt-manager/dist/index.js"],
        env={
            "PROMPT_REPO_URL": "/path/to/repo",
            "MCP_LANGUAGE": "en"
        }
    )

    # Create session
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize
            await session.initialize()

            # List prompts
            prompts = await session.list_prompts()
            print(f"Available prompts: {prompts}")

            # Get prompt
            prompt = await session.get_prompt(
                name="code-review",
                arguments={
                    "code": "const x = 1",
                    "language": "TypeScript"
                }
            )
            print(f"Prompt result: {prompt}")
```

### MCP Client Quick Reference

| Client             | Configuration File Location                                                                           | Config Format | Notes                |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ------------- | --------------------- |
| **Cursor**         | `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json` (macOS)                | `mcpServers`  | Supports UI config    |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)                            | `mcpServers`  | Requires full restart |
| **VS Code**        | `settings.json`                                                                                       | `mcp.servers` | Requires MCP extension |
| **Continue**       | `~/.continue/config.json`                                                                             | `mcpServers`  | Open-source AI assistant |
| **Aider**          | `~/.aider/config.json`                                                                                 | `mcp_servers` | AI code editor        |

> **Note**: The `~` in paths represents the user home directory, which expands to:
>
> - macOS/Linux: `/Users/username` or `/home/username`
> - Windows: `C:\Users\username`

### Universal Configuration Format

All MCP-compatible clients follow the same configuration format:

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/absolute/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "your-repo-url-or-path",
                "MCP_LANGUAGE": "en",
                "MCP_GROUPS": "common",
                "LOG_LEVEL": "info"
            }
        }
    }
}
```

#### Configuration Field Descriptions

- **`command`**: Execution command (usually `node`)
- **`args`**: Command argument array, must include the absolute path to the compiled `dist/index.js`
- **`env`**: Environment variable object (optional)
    - `PROMPT_REPO_URL`: Git repository URL or local path (required)
    - `MCP_LANGUAGE`: Output language, `en` or `zh` (optional, default `en`)
    - `MCP_GROUPS`: Groups to load, comma-separated (optional, defaults to loading only `common` group when not set, system will prompt in logs)
    - `STORAGE_DIR`: Local cache directory (optional)
    - `GIT_BRANCH`: Git branch (optional, default `main`)
    - `GIT_MAX_RETRIES`: Git retry count (optional, default `3`)
    - `CACHE_CLEANUP_INTERVAL`: Cache cleanup interval in milliseconds (optional, default `10000`)
    - `LOG_LEVEL`: Log level (optional, default `info`)

#### Important Notes

1. **Absolute Paths**: Paths in `args` must be absolute paths, cannot use relative paths
2. **JSON Format**: Ensure JSON format is correct, no comma after the last item
3. **Environment Variable Priority**: `env` in JSON overrides settings in `.env` file
4. **Restart Application**: After modifying configuration, you must completely restart the application for changes to take effect

### Verifying MCP Server is Running Properly

#### Method 1: Using MCP Inspector

```bash
cd /path/to/mcp-prompt-manager

# If source code was modified, compile first
pnpm run build

# Start Inspector (or use inspector:dev for auto-compile)
pnpm run inspector
# or
pnpm run inspector:dev
```

This launches a web interface where you can:

- View all loaded prompts
- Test prompt output
- Check error messages

> **Note**: Inspector runs `dist/index.js`, so after modifying source code, you must run `build` first to see the latest changes.

#### Method 2: Check Logs

Add environment variables in the configuration file to view detailed logs:

```json
{
    "mcpServers": {
        "mcp-prompt-manager": {
            "command": "node",
            "args": ["/path/to/mcp-prompt-manager/dist/index.js"],
            "env": {
                "PROMPT_REPO_URL": "/path/to/repo",
                "LOG_LEVEL": "debug"
            }
        }
    }
}
```

Then check the client's log output (Cursor's output panel or Claude Desktop's logs).

#### Method 3: Check File System

Verify Git repository has been synced successfully:

```bash
ls -la /path/to/mcp-prompt-manager/.prompts_cache
```

You should see files cloned from the Git repository.

### Common Configuration Issues

#### Issue 1: Configuration File Not Found

**Solution**:

- Confirm the application has been started at least once (will automatically create configuration directory)
- Manually create the configuration file and directory
- Check if the path is correct (note case sensitivity and spaces)

#### Issue 2: JSON Format Error

**Solution**:

- Use JSON validation tools to check format (e.g., [JSONLint](https://jsonlint.com/))
- Ensure all strings use double quotes
- Ensure no comma after the last item

#### Issue 3: Server Cannot Start

**Solution**:

1. Confirm `dist/index.js` file exists
2. Confirm path is absolute
3. Confirm Node.js is installed and version >= 18
4. Check if environment variables are correct
5. Check client error logs

#### Issue 4: No Prompts Found

**Solution**:

1. Confirm `PROMPT_REPO_URL` is correct
2. Check if `MCP_GROUPS` setting includes the groups you want
   - **Note**: If `MCP_GROUPS` is not set, the system defaults to loading only the `common` group
   - Check log messages to confirm if default groups are being used
   - Set `MCP_GROUPS=laravel,vue` etc. to load other groups
3. Confirm Git repository contains `.yaml` or `.yml` files
4. Use `LOG_LEVEL=debug` to view detailed logs and confirm which groups are loaded

## 📂 Prompt Repository Structure

Your Prompt Repository (where `PROMPT_REPO_URL` points to) should have the following structure:

```text
my-prompts/
├── partials/              # Store Handlebars partials (.hbs)
│   ├── role-expert.hbs
│   └── output-format.hbs
├── common/                # common group (always loaded)
│   ├── common-prompt.yaml
│   └── partials/
│       └── common-partial.hbs
├── laravel/               # laravel group (must be specified in MCP_GROUPS)
│   └── laravel-prompt.yaml
├── vue/                   # vue group (must be specified in MCP_GROUPS)
│   └── vue-prompt.yaml
├── root-prompt.yaml       # Root directory (always loaded)
└── another-prompt.yml
```

### Group Filtering Rules

- **Root directory** (`/`): Always loaded
- **common group** (`common/`): Always loaded
- **Other groups**: Only loaded when specified in `MCP_GROUPS` environment variable

#### Default Behavior

When `MCP_GROUPS` is **not set**:
- System automatically loads the `common` group (and root directory prompts)
- Startup logs will explicitly prompt about using default groups
- Logs will include messages suggesting to set `MCP_GROUPS` to load more groups

#### Examples

- `MCP_GROUPS=laravel,vue` → Load root, common, laravel, vue
- `MCP_GROUPS=` or not set → Only load root and common (system will prompt about using default)

### Prompt Definition File Example (`.yaml`)

```yaml
id: "code-review"
title: "Code Review"
description: "Help me review code"
args:
    code:
        type: "string"
        description: "Code to review"
    language:
        type: "string"
        description: "Programming language"
template: |
    {{> role-expert }}

    You are a senior {{language}} engineer.
    Please review the following code:
```

{{ code }}

```

```

### Parameter Types

Prompts support three parameter types:

- `string`: String type (default)
- `number`: Number type
- `boolean`: Boolean type

### Registry Feature (Optional)

You can create a `registry.yaml` file in the root directory of your Prompt Repository to centrally manage prompt visibility and deprecation status.

#### Registry File Format

```yaml
prompts:
  - id: "code-review"
    group: "common"
    visibility: "public"  # public, private, internal
    deprecated: false
  - id: "old-prompt"
    visibility: "private"
    deprecated: true
```

#### Registry Field Descriptions

- **`id`**: Prompt ID (required)
- **`group`**: Group name (optional)
- **`visibility`**: Visibility setting
  - `public`: Public (default)
  - `private`: Private
  - `internal`: Internal use
- **`deprecated`**: Whether deprecated (default `false`)

#### Registry Purpose

- **Centralized Management**: Manage all prompts' visibility and deprecation status in a single file
- **Override Defaults**: Can override default settings in prompt definition files
- **Version Control**: Track prompt lifecycle through Git

> **Note**: `registry.yaml` is optional. If it doesn't exist, the system will use default values from prompt definition files.

### Prompt Runtime State

Each prompt has a runtime state (`runtime_state`) indicating the prompt's current availability:

- **`active`**: Active state, prompt works normally and can be used as an MCP Tool
- **`legacy`**: Legacy state, prompt is still available but marked as old version, recommend using new version
- **`invalid`**: Invalid state, prompt definition has issues (e.g., missing required fields, template errors, etc.), cannot be used
- **`disabled`**: Disabled, prompt is explicitly disabled (e.g., marked as deprecated in registry)
- **`warning`**: Warning state, prompt can work but has some warnings (e.g., version too old)

### Prompt Source

Each prompt has a source (`source`) tag indicating where the metadata comes from:

- **`embedded`**: Metadata embedded in prompt definition file (using `metadata:` block)
- **`registry`**: Settings from `registry.yaml`
- **`legacy`**: Legacy mode, no metadata, uses default values

### Prompt Status

Each prompt has a status (`status`) indicating the prompt's development stage:

- **`draft`**: Draft, under development
- **`stable`**: Stable version, can be used normally
- **`deprecated`**: Deprecated, not recommended for use
- **`legacy`**: Legacy version, still available but recommend upgrading

## 🔧 MCP Tools and Resources

This project provides multiple MCP tools and resources for managing and querying Prompts.

### MCP Tools

#### 1. `mcp.reload` / `mcp.reload_prompts`

Reload all Prompts without restarting the server (hot-reload).

- **Function**: Pull latest changes from Git repository, clear cache, reload all Handlebars partials and prompts
- **Parameters**: None
- **Usage Example**:
  ```json
  {
    "tool": "mcp.reload",
    "arguments": {}
  }
  ```

#### 2. `mcp.stats` / `mcp.prompt.stats`

Get Prompts statistics.

- **Function**: Returns statistics for all prompts, including counts by runtime state (active, legacy, invalid, disabled, warning)
- **Parameters**: None
- **Return Content**:
  - `total`: Total count
  - `active`: Active state count
  - `legacy`: Legacy state count
  - `invalid`: Invalid state count
  - `disabled`: Disabled count
  - `warning`: Warning state count

#### 3. `mcp.list` / `mcp.prompt.list`

List all Prompts with multiple filter options.

- **Function**: Lists all prompt runtimes with complete metadata information
- **Parameters** (optional):
  - `status`: Filter by status (`draft`, `stable`, `deprecated`, `legacy`)
  - `group`: Filter by group name
  - `tag`: Filter by tag (prompts must contain this tag)
  - `runtime_state`: Filter by runtime state (`active`, `legacy`, `invalid`, `disabled`, `warning`)
- **Usage Example**:
  ```json
  {
    "tool": "mcp.list",
    "arguments": {
      "group": "laravel",
      "runtime_state": "active"
    }
  }
  ```

#### 4. `mcp.inspect`

Inspect detailed runtime information for a specific Prompt.

- **Function**: Get complete runtime metadata by Prompt ID, including state, source, version, tags, and use cases
- **Parameters**:
  - `id`: Prompt ID (required)
- **Usage Example**:
  ```json
  {
    "tool": "mcp.inspect",
    "arguments": {
      "id": "code-review"
    }
  }
  ```

#### 5. `mcp.repo.switch`

Switch to a different Prompt repository and reload (zero-downtime).

- **Function**: Switch to a new Git repository and reload all prompts
- **Parameters**:
  - `repo_url`: Repository URL (required)
  - `branch`: Branch name (optional)
- **Usage Example**:
  ```json
  {
    "tool": "mcp.repo.switch",
    "arguments": {
      "repo_url": "/path/to/new/repo",
      "branch": "main"
    }
  }
  ```

#### 6. `preview_prompt`

Preview/render a prompt template with given arguments without executing it (debug utility).

- **Function**: Renders a prompt template with given arguments to show the final text without sending it to an LLM. Use this to verify template logic.
- **Parameters**:
  - `promptId`: Prompt ID (required, e.g., `'laravel:code-review'`)
  - `args`: JSON object containing the arguments/variables for the template (required)
- **Returns**:
  - `success`: Boolean indicating success or failure
  - `renderedText`: The rendered prompt text
  - `highlightedText`: The rendered text with variables highlighted in Markdown bold
  - `statistics`: Object containing `renderedLength` (character count) and `estimatedTokens` (estimated token count)
  - `warnings`: Array of schema validation warnings (e.g., missing recommended fields)
- **Usage Example**:
  ```json
  {
    "tool": "preview_prompt",
    "arguments": {
      "promptId": "laravel:code-review",
      "args": {
        "code": "function test() { return true; }",
        "language": "php"
      }
    }
  }
  ```
- **Advanced Features**:
  - **Schema Validation**: Strict validation of arguments against prompt's Zod schema
  - **Token Estimation**: Estimates token count (supports both English and Chinese text)
  - **Variable Highlighting**: Highlights dynamically replaced variables with Markdown bold formatting
  - **Schema Warnings**: Detects and reports missing required or recommended fields

### MCP Resources

#### 1. `system://health`

System health status resource.

- **URI**: `system://health`
- **MIME Type**: `application/json`
- **Content**: Includes the following information:
  - `git`: Git repository information (URL, path, HEAD commit)
  - `prompts`: Prompts statistics (total, counts by state, loaded count, group list)
  - `registry`: Registry status (enabled, source)
  - `cache`: Cache information (size, cleanup interval)
  - `system`: System information (uptime, memory usage)

#### 2. `prompts://list`

Prompts list resource.

- **URI**: `prompts://list`
- **MIME Type**: `application/json`
- **Content**: Complete metadata list of all prompts, including:
  - `id`: Prompt ID
  - `title`: Title
  - `version`: Version
  - `status`: Status
  - `runtime_state`: Runtime state
  - `source`: Source
  - `tags`: Tags array
  - `use_cases`: Use cases array
  - `group`: Group name
  - `visibility`: Visibility

### Tool Usage Recommendations

- **During Development**: Use `mcp.reload` to quickly reload prompts without restarting the server
- **During Debugging**: Use `mcp.inspect` to check detailed information for specific prompts, or use `preview_prompt` to test template rendering
- **During Monitoring**: Use `mcp.stats` and `system://health` resource to monitor system status
- **During Querying**: Use `mcp.list` with filter conditions to find specific prompts
- **During Testing**: Use `preview_prompt` to verify template logic, check token counts, and see variable replacements before actual execution

## 💻 Development Guide

### Project Structure

```
mcp-prompt-manager/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── env.ts            # Environment variable configuration and validation
│   ├── services/
│   │   ├── control.ts        # MCP control tool handlers
│   │   ├── git.ts            # Git sync service
│   │   ├── health.ts         # Health status service
│   │   └── loaders.ts        # Prompt and Partials loader
│   ├── types/
│   │   ├── prompt.ts         # Prompt type definitions
│   │   ├── promptMetadata.ts # Prompt metadata types
│   │   ├── promptRuntime.ts  # Prompt runtime types
│   │   └── registry.ts       # Registry type definitions
│   └── utils/
│       ├── fileSystem.ts     # File system utilities (with cache)
│       └── logger.ts         # Logging utilities
├── test/                      # Test files
│   ├── config.test.ts
│   ├── loaders.test.ts
│   ├── promptMetadata.test.ts
│   ├── utils.test.ts
│   └── integration.test.ts  # Integration tests
├── dist/                      # Compiled output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Common Commands

```bash
# Compile TypeScript
npm run build
# or
pnpm run build

# Start MCP Inspector for debugging
# Note: Need to run build first, or use inspector:dev for auto-compile
pnpm run build && pnpm run inspector
# or use development mode (auto-compile)
pnpm run inspector:dev

# Run tests
npm run test
# or
pnpm test

# Run tests (once)
npm run test:run
# or
pnpm test:run

# Open test UI
npm run test:ui
# or
pnpm test:ui

# Format code
npm run format
# or
pnpm format

# Check code format
npm run format:check
# or
pnpm format:check
```

### Development Workflow

1. Modify code in the `src/` directory.
2. Run `pnpm run build` to recompile (or use `pnpm run inspector:dev` to auto-compile and test).
3. Run `pnpm run test` to run tests.
4. Use `pnpm run inspector:dev` to verify changes (will auto-compile and start Inspector).
5. Restart MCP Server in Cursor or Claude Desktop to apply changes.

> **Important Notes**:
>
> - The `inspector` command runs `dist/index.js` (compiled file)
> - After modifying source code, you must run `build` first to see the latest changes
> - Using `inspector:dev` can auto-compile and start, suitable for development

## 🧪 Testing

The project includes a complete test suite:

- **Unit Tests**: Multiple test files covering all core functionality
- **Integration Tests**: End-to-end testing for prompt loading and MCP tools
- **Total**: 107 tests, all passing

Run tests:

```bash
# Watch mode
pnpm test

# Run once
pnpm test:run

# Open UI
pnpm test:ui
```

### Test Coverage

This project maintains high code quality through comprehensive test coverage with the following thresholds:

- **Statements**: ≥ 80%
- **Lines**: ≥ 75%
- **Functions**: ≥ 75%
- **Branches**: ≥ 70%

> **Note**: Coverage reports use `@vitest/coverage-v8` which requires Node.js 19+. Coverage thresholds are enforced to maintain code quality. If coverage falls below thresholds, tests will fail to ensure quality standards.

#### Viewing Coverage Reports

1. **Local Development**: Run `pnpm test:coverage` to generate coverage reports, or use `pnpm test:coverage:view` to automatically open the HTML coverage report in your browser.

2. **CI/CD**: Run `pnpm test:coverage:ci` to generate coverage reports and enforce thresholds. The CI pipeline will fail if coverage thresholds are not met, ensuring code quality standards are maintained before merging or releasing.

3. **Coverage Reports**: Coverage reports are generated in the `coverage/` directory with multiple formats:
   - `coverage/index.html` - Interactive HTML report
   - `coverage/coverage-final.json` - JSON format for CI integration
   - `coverage/lcov.info` - LCOV format for coverage services

#### Coverage Commands

```bash
# Generate coverage report (local development)
pnpm test:coverage

# Generate coverage report with threshold enforcement (CI)
pnpm test:coverage:ci

# Generate coverage report and open HTML report
pnpm test:coverage:view
```

## 🔧 Configuration

### Environment Variables

| Variable Name            | Required | Default Value    | Description                                    |
| ------------------------ | -------- | ---------------- | ---------------------------------------------- |
| `PROMPT_REPO_URL`       | ✅       | -                | Git repository URL or local path               |
| `MCP_LANGUAGE`          | ❌       | `en`             | Output language (`en` or `zh`)                 |
| `MCP_GROUPS`            | ❌       | `common`         | Groups to load (comma-separated), system will prompt about default behavior when not set |
| `STORAGE_DIR`           | ❌       | `.prompts_cache` | Local cache directory                          |
| `GIT_BRANCH`            | ❌       | `main`           | Git branch name                                |
| `GIT_MAX_RETRIES`       | ❌       | `3`              | Maximum retry count for Git operations        |
| `CACHE_CLEANUP_INTERVAL` | ❌       | `10000`          | Cache cleanup interval (milliseconds), periodic cleanup of expired cache items |
| `LOG_LEVEL`             | ❌       | `warn` (prod) / `info` (dev) | Log level, production defaults to warnings and errors only |

### Cache Expiration Strategy

The system uses a TTL-based periodic cleanup mechanism to manage file list cache, ensuring memory efficiency.

#### Cache Mechanism

- **Cache TTL**: 5 seconds (hardcoded)
- **Cleanup Interval**: Default 10 seconds (`CACHE_TTL * 2`), adjustable via `CACHE_CLEANUP_INTERVAL` environment variable
- **Auto Cleanup**: Cleanup mechanism starts automatically when application starts
- **Graceful Shutdown**: Cleanup timer stops automatically when application closes

#### How It Works

1. **Cache Creation**: When `getFilesRecursively()` is called, scan results are cached for 5 seconds
2. **Periodic Cleanup**: Every 10 seconds (or configured interval), automatically scans and removes expired cache items
3. **Memory Management**: Prevents cache from growing indefinitely, avoiding memory leaks

#### Configuration Examples

```bash
# Set shorter cleanup interval (for testing)
CACHE_CLEANUP_INTERVAL=2000  # Cleanup every 2 seconds

# Set longer cleanup interval (for production, reduce cleanup frequency)
CACHE_CLEANUP_INTERVAL=30000  # Cleanup every 30 seconds
```

#### Monitor Cache Status

You can view cache cleanup status through logs (requires setting `LOG_LEVEL=debug`):

```
[DEBUG] Cache cleanup mechanism started { interval: 10000 }
[DEBUG] Cache cleanup completed { cleaned: 2 }
```

#### Verify Cache Mechanism

See [CACHE_VERIFICATION.md](./CACHE_VERIFICATION.md) for complete verification methods and testing guide.

### Security

- ✅ Input Validation: All environment variables are validated with Zod
- ✅ Path Security: Prevents path traversal attacks
- ✅ Group Validation: Group name format validation (only letters, numbers, underscores, dashes allowed)

## 📝 Logging

The project uses [pino](https://github.com/pinojs/pino) as the logging system, supporting structured logging.

### Log Levels

- `fatal`: Fatal errors that cause program exit
- `error`: Error messages
- `warn`: Warning messages
- `info`: General information
- `debug`: Debug messages
- `trace`: Trace messages
- `silent`: Completely disable log output

**Default Behavior**:
- **Production Environment** (`NODE_ENV` not set or not `development`): Defaults to `warn`, only outputs warnings and errors
- **Development Environment** (`NODE_ENV=development`): Defaults to `info`, outputs all info level and above logs
- Can override default value via `LOG_LEVEL` environment variable

### Setting Log Level

```bash
# Set in .env
LOG_LEVEL=debug

# Or set in environment variables
export LOG_LEVEL=debug
```

## 🐛 Troubleshooting

### Issue: Git Sync Failed

**Solution**:

1. Check if `PROMPT_REPO_URL` is correct
2. Confirm network connection is normal
3. Check if Git credentials are correct
4. Check logs for detailed error messages

### Issue: No Prompts Loaded

**Solution**:

1. Check if `MCP_GROUPS` setting is correct
2. Confirm prompt files are in the correct directory structure
3. Check if YAML file format is correct
4. Check error messages in logs

### Issue: Partials Cannot Be Used

**Solution**:

1. Confirm partial file extension is `.hbs`
2. Check if partial file content is correct
3. Confirm using `{{> partial-name }}` syntax in templates

## 📦 Key Dependencies

- **@modelcontextprotocol/sdk**: MCP SDK, provides MCP Server core functionality
- **handlebars**: Handlebars template engine, supports dynamic Prompt generation
- **simple-git**: Git operations library for syncing Git repositories
- **js-yaml**: YAML parser for parsing Prompt definition files
- **zod**: TypeScript-first schema validation library for configuration and type validation
- **pino**: High-performance structured logging library
- **dotenv**: Environment variable loading utility

## 📚 Related Resources

- [Model Context Protocol Official Documentation](https://modelcontextprotocol.io/)
- [Handlebars Documentation](https://handlebarsjs.com/)
- [Zod Documentation](https://zod.dev/)
- [Simple Git Documentation](https://github.com/steveukx/git-js)
- [Pino Documentation](https://getpino.io/)

## 📄 License

ISC

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

---

**Version**: 1.0.0  
**Last Updated**: 2024-11-30
