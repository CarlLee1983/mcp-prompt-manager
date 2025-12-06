# GitHub Release 建立指南

本文件說明如何建立 GitHub Release，包含手動方式和自動化方案。

## 目錄

- [手動建立 Release](#手動建立-release)
    - [方式一：使用 GitHub Web 介面（推薦）](#方式一使用-github-web-介面推薦)
    - [方式二：使用 GitHub API](#方式二使用-github-api)
    - [方式三：使用 GitHub CLI](#方式三使用-github-cli)
- [自動化方案](#自動化方案)
    - [方案一：semantic-release（推薦）](#方案一semantic-release推薦)
    - [方案二：release-drafter](#方案二release-drafter)
- [發版步驟](#發版步驟)

---

## 手動建立 Release

### 方式一：使用 GitHub Web 介面（推薦）

1. 前往：https://github.com/CarlLee1983/mcp-prompt-manager/releases/new
2. 選擇 tag：例如 `v1.0.0`
3. 標題：例如 `v1.0.0`
4. 描述：複製 `RELEASE_NOTES_v1.0.0.md` 的內容（如果存在）
5. 點擊「Publish release」

### 方式二：使用 GitHub API

如果您有 GitHub Personal Access Token，可以使用以下指令：

```bash
# 設定您的 GitHub token（需要 repo 權限）
export GITHUB_TOKEN=your_github_token_here

# 建立 Release
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/CarlLee1983/mcp-prompt-manager/releases \
  -d @- << EOF
{
  "tag_name": "v1.0.0",
  "name": "v1.0.0",
  "body": "$(cat RELEASE_NOTES_v1.0.0.md | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')",
  "draft": false,
  "prerelease": false
}
EOF
```

### 方式三：使用 GitHub CLI

```bash
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file RELEASE_NOTES_v1.0.0.md
```

---

## 自動化方案

### 方案一：semantic-release（推薦）

**semantic-release** 是一個全自動的版本管理和發布工具，基於 [Conventional Commits](https://www.conventionalcommits.org/) 規範自動決定版本號、生成 CHANGELOG 和建立 GitHub Release。

#### 優點

- ✅ 全自動化：無需手動管理版本號
- ✅ 基於 Conventional Commits 自動決定版本（major/minor/patch）
- ✅ 自動生成 CHANGELOG
- ✅ 自動建立 GitHub Release
- ✅ 支援多種插件（npm、GitHub、GitLab 等）

#### 安裝與配置

1. **安裝依賴**：

```bash
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git
```

2. **建立 `.releaserc.json` 配置檔案**：

```json
{
    "branches": [
        "main",
        {
            "name": "beta",
            "prerelease": true
        }
    ],
    "plugins": [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        [
            "@semantic-release/changelog",
            {
                "changelogFile": "CHANGELOG.md"
            }
        ],
        "@semantic-release/npm",
        [
            "@semantic-release/git",
            {
                "assets": ["CHANGELOG.md", "package.json"],
                "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
            }
        ],
        "@semantic-release/github"
    ]
}
```

3. **建立 GitHub Actions Workflow**（`.github/workflows/release.yml`）：

```yaml
name: Release

on:
    push:
        branches:
            - main

jobs:
    release:
        name: Release
        runs-on: ubuntu-latest
        permissions:
            contents: write
            issues: write
            pull-requests: write
        steps:
            - name: Checkout
              uses: actions/checkout@v4
              with:
                  fetch-depth: 0
                  token: ${{ secrets.GITHUB_TOKEN }}

            - name: Setup Node.js
              uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: "npm"

            - name: Install dependencies
              run: npm ci

            - name: Build
              run: npm run build

            - name: Run tests
              run: npm test

            - name: Release
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
              run: npx semantic-release
```

4. **設定 GitHub Secrets**（如果需要發布到 npm）：

- `GITHUB_TOKEN`：自動提供，無需設定
- `NPM_TOKEN`：如果需要發布到 npm，需要在 GitHub Secrets 中設定

#### 使用方式

1. **提交符合 Conventional Commits 規範的 commit**：

```bash
# Patch release (1.0.0 -> 1.0.1)
git commit -m "fix: resolve cache issue"

# Minor release (1.0.0 -> 1.1.0)
git commit -m "feat: add new preview_prompt tool"

# Major release (1.0.0 -> 2.0.0)
git commit -m "feat!: breaking change in API"
```

2. **推送到 main 分支**：

```bash
git push origin main
```

3. **semantic-release 會自動**：
    - 分析 commits
    - 決定版本號
    - 生成 CHANGELOG
    - 建立 Git tag
    - 建立 GitHub Release
    - 更新 package.json 版本

#### Conventional Commits 規範

- `fix:` → Patch release (1.0.0 → 1.0.1)
- `feat:` → Minor release (1.0.0 → 1.1.0)
- `feat!:` 或 `BREAKING CHANGE:` → Major release (1.0.0 → 2.0.0)
- `perf:`, `refactor:`, `docs:`, `style:`, `test:`, `chore:` → 不影響版本號（除非有 `!`）

---

### 方案二：release-drafter

**release-drafter** 是一個 GitHub Action，用於自動草擬 Release notes，基於 PR 標籤和分類自動生成 Release 內容。

#### 優點

- ✅ 自動草擬 Release notes
- ✅ 基於 PR 標籤分類（feature、bugfix、breaking 等）
- ✅ 支援多種模板格式
- ✅ 可與手動發布流程結合

#### 安裝與配置

1. **建立 `.github/release-drafter.yml` 配置檔案**：

```yaml
name-template: "v$RESOLVED_VERSION"
tag-template: "v$RESOLVED_VERSION"

categories:
    - title: "🚀 Features"
      labels:
          - "feature"
          - "enhancement"
    - title: "🐛 Bug Fixes"
      labels:
          - "fix"
          - "bugfix"
    - title: "💥 Breaking Changes"
      labels:
          - "breaking"
    - title: "📚 Documentation"
      labels:
          - "documentation"
          - "docs"
    - title: "🔧 Maintenance"
      labels:
          - "chore"
          - "maintenance"
          - "dependencies"

change-template: "- $TITLE @$AUTHOR (#$NUMBER)"
change-title-escapes: '\<*_&'
version-resolver:
    major:
        labels:
            - "breaking"
    minor:
        labels:
            - "feature"
            - "enhancement"
    patch:
        labels:
            - "fix"
            - "bugfix"
            - "patch"

autolabeler:
    - label: "feature"
      branch:
          - '/^feature\\/.*/'
    - label: "fix"
      branch:
          - '/^fix\\/.*/'
    - label: "breaking"
      branch:
          - '/^breaking\\/.*/'
```

2. **建立 GitHub Actions Workflow**（`.github/workflows/release-drafter.yml`）：

```yaml
name: Release Drafter

on:
    push:
        branches:
            - main
    pull_request:
        types: [opened, reopened, synchronize]

permissions:
    contents: read
    pull-requests: read

jobs:
    update-release-draft:
        runs-on: ubuntu-latest
        steps:
            - name: Update Release Draft
              uses: release-drafter/release-drafter@v6
              with:
                  config-name: release-drafter.yml
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

3. **建立手動發布 Workflow**（`.github/workflows/publish-release.yml`）：

```yaml
name: Publish Release

on:
    workflow_dispatch:
        inputs:
            version:
                description: "Release version (e.g., 1.0.0)"
                required: true
                type: string

jobs:
    publish:
        runs-on: ubuntu-latest
        permissions:
            contents: write
        steps:
            - name: Checkout
              uses: actions/checkout@v4
              with:
                  fetch-depth: 0

            - name: Create Release
              uses: softprops/action-gh-release@v2
              with:
                  tag_name: v${{ github.event.inputs.version }}
                  name: Release v${{ github.event.inputs.version }}
                  body_path: .github/RELEASE_DRAFT.md
                  draft: false
                  prerelease: false
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 使用方式

1. **在 PR 中使用標籤**：
    - 為 PR 添加標籤（如 `feature`、`fix`、`breaking`）
    - release-drafter 會自動更新草稿 Release notes

2. **查看草稿 Release**：
    - 前往：https://github.com/CarlLee1983/mcp-prompt-manager/releases
    - 查看 "Draft" 狀態的 Release

3. **發布 Release**：
    - 手動點擊 "Publish release"
    - 或使用 GitHub Actions 的 "Publish Release" workflow

---

## 發版步驟

### 使用 semantic-release（自動化）

```bash
# 1. 確保在 main 分支且是最新狀態
git checkout main
git pull origin main

# 2. 確保所有變更已提交
git status

# 3. 提交符合 Conventional Commits 規範的 commit
git commit -m "feat: add new feature"
# 或
git commit -m "fix: resolve bug"
# 或
git commit -m "feat!: breaking change"

# 4. 推送到 main 分支
git push origin main

# 5. semantic-release 會自動：
#    - 分析 commits
#    - 決定版本號
#    - 生成 CHANGELOG
#    - 建立 Git tag
#    - 建立 GitHub Release
#    - 更新 package.json
```

### 使用 release-drafter（半自動化）

```bash
# 1. 確保在 main 分支且是最新狀態
git checkout main
git pull origin main

# 2. 建立並推送 tag
git tag v1.0.0
git push origin v1.0.0

# 3. 前往 GitHub Releases 頁面
# 4. 查看草稿 Release（由 release-drafter 自動生成）
# 5. 編輯並發布 Release
```

### 手動發布（完全手動）

```bash
# 1. 確保在 main 分支且是最新狀態
git checkout main
git pull origin main

# 2. 更新版本號（使用 npm version）
npm version patch  # 或 minor, major
# 這會自動：
#    - 更新 package.json 版本
#    - 建立 commit
#    - 建立 Git tag

# 3. 推送到遠端（包含 tags）
git push --follow-tags

# 4. 建立 GitHub Release（使用上述三種方式之一）
#    - GitHub Web 介面
#    - GitHub API
#    - GitHub CLI
```

### 使用 npm version（推薦手動方式）

```bash
# 1. 確保在 main 分支且是最新狀態
git checkout main
git pull origin main

# 2. 確保所有變更已提交
git status

# 3. 更新版本號
npm version patch -m "chore: bump version to %s"  # 1.0.0 -> 1.0.1
# 或
npm version minor -m "chore: bump version to %s"  # 1.0.0 -> 1.1.0
# 或
npm version major -m "chore: bump version to %s"  # 1.0.0 -> 2.0.0

# 4. 推送到遠端（包含 tags）
git push --follow-tags

# 5. 建立 GitHub Release（使用上述三種方式之一）
```

---

## 驗證

Release 建立後，可以在以下網址查看：
https://github.com/CarlLee1983/mcp-prompt-manager/releases

## 參考資源

- [semantic-release 官方文檔](https://semantic-release.gitbook.io/)
- [release-drafter 官方文檔](https://github.com/release-drafter/release-drafter)
- [Conventional Commits 規範](https://www.conventionalcommits.org/)
- [npm version 命令文檔](https://docs.npmjs.com/cli/v10/commands/npm-version)
