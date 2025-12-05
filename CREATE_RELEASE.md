# 建立 GitHub Release v1.0.0

Git tag `v1.0.0` 已經建立並推送到 GitHub。

## 方式一：使用 GitHub Web 介面（推薦）

1. 前往：https://github.com/CarlLee1983/mcp-prompt-manager/releases/new
2. 選擇 tag：`v1.0.0`
3. 標題：`v1.0.0`
4. 描述：複製 `RELEASE_NOTES_v1.0.0.md` 的內容
5. 點擊「Publish release」

## 方式二：使用 GitHub API（需要 Personal Access Token）

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

## 方式三：使用 GitHub CLI（如果已安裝）

```bash
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file RELEASE_NOTES_v1.0.0.md
```

## 驗證

Release 建立後，可以在以下網址查看：
https://github.com/CarlLee1983/mcp-prompt-manager/releases/tag/v1.0.0

