# Docker 部署指南

本指南說明如何使用 Docker 部署 MCP Prompt Manager。

## 目錄

- [快速開始](#快速開始)
- [配置說明](#配置說明)
- [部署模式](#部署模式)
- [健康檢查](#健康檢查)
- [故障排除](#故障排除)

## 快速開始

### 使用 Docker Compose（開發環境）

1. **複製環境變數範例文件**：

```bash
cp .env.docker.example .env
```

2. **編輯 `.env` 文件**，設定必要的環境變數：

```bash
# 必填：Git 倉庫 URL
PROMPT_REPO_URL=https://github.com/yourusername/your-prompts-repo.git

# 選擇傳輸模式
TRANSPORT_TYPE=http
```

3. **啟動服務**：

```bash
docker-compose up -d
```

4. **查看日誌**：

```bash
docker-compose logs -f
```

5. **停止服務**：

```bash
docker-compose down
```

### 使用 Docker Compose（生產環境）

1. **設定環境變數**：

```bash
export PROMPT_REPO_URL=https://github.com/yourusername/your-prompts-repo.git
export TRANSPORT_TYPE=http
# ... 其他環境變數
```

2. **啟動服務**：

```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. **查看日誌**：

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### 使用 Docker 直接運行

1. **構建鏡像**：

```bash
docker build -t mcp-prompt-manager:latest .
```

2. **運行容器**：

```bash
docker run -d \
  --name mcp-prompt-manager \
  -p 3000:3000 \
  -e PROMPT_REPO_URL=https://github.com/yourusername/your-prompts-repo.git \
  -e TRANSPORT_TYPE=http \
  -v prompts_cache:/app/.prompts_cache \
  mcp-prompt-manager:latest
```

## 配置說明

### 環境變數配置

所有環境變數都可以通過以下方式設定：

1. **`.env` 文件**（開發環境推薦）
2. **Docker Compose `environment` 區塊**（生產環境推薦）
3. **Docker `-e` 參數**（直接運行時）

詳細的環境變數說明請參考 [`.env.docker.example`](.env.docker.example)。

### 卷掛載說明

#### 開發環境

```yaml
volumes:
  - ./.prompts_cache:/app/.prompts_cache  # 持久化快取
  - ./.env:/app/.env:ro                   # 只讀環境變數文件
```

#### 生產環境

```yaml
volumes:
  - prompts_cache:/app/.prompts_cache  # 命名卷（持久化快取）
```

### 端口配置

- **HTTP 模式**：預設使用端口 `3000`
- **SSE 模式**：預設使用端口 `3001`
- **stdio 模式**：不使用端口（標準輸入輸出）

可以在 `docker-compose.yml` 中通過環境變數自定義：

```yaml
ports:
  - "${HTTP_PORT:-3000}:3000"
  - "${SSE_PORT:-3001}:3001"
```

### 不同傳輸模式的配置

#### stdio 模式

適用於 MCP 客戶端直接連接，不需要端口映射：

```yaml
environment:
  - TRANSPORT_TYPE=stdio
```

#### HTTP 模式

適用於 RESTful API 訪問：

```yaml
environment:
  - TRANSPORT_TYPE=http
ports:
  - "3000:3000"
```

#### SSE 模式

適用於 Server-Sent Events 實時推送：

```yaml
environment:
  - TRANSPORT_TYPE=sse
ports:
  - "3001:3001"
```

## 部署模式

### stdio 模式部署

stdio 模式用於 MCP 客戶端直接連接，不需要暴露端口。

**Docker Compose 配置**：

```yaml
services:
  mcp-prompt-manager:
    environment:
      - TRANSPORT_TYPE=stdio
    # 不需要 ports 配置
```

**MCP 客戶端配置範例**（Claude Desktop）：

```json
{
  "mcpServers": {
    "mcp-prompt-manager": {
      "command": "docker",
      "args": ["exec", "-i", "mcp-prompt-manager", "node", "dist/index.js"]
    }
  }
}
```

### HTTP 模式部署

HTTP 模式提供 RESTful API，適合遠程訪問。

**Docker Compose 配置**：

```yaml
services:
  mcp-prompt-manager:
    environment:
      - TRANSPORT_TYPE=http
    ports:
      - "3000:3000"
```

**訪問 API**：

```bash
# 健康檢查
curl http://localhost:3000/health

# 取得 Prompt 列表
curl http://localhost:3000/prompts
```

### SSE 模式部署

SSE 模式提供 Server-Sent Events，適合實時推送場景。

**Docker Compose 配置**：

```yaml
services:
  mcp-prompt-manager:
    environment:
      - TRANSPORT_TYPE=sse
    ports:
      - "3001:3001"
```

## 健康檢查

### HTTP/SSE 模式

健康檢查端點：`http://localhost:3000/health`

**檢查健康狀態**：

```bash
curl http://localhost:3000/health
```

**預期響應**：

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "prompts": {
    "loaded": 10,
    "active": 10
  }
}
```

### stdio 模式

stdio 模式使用進程檢查：

```bash
docker exec mcp-prompt-manager ps aux | grep node
```

### Docker Compose 健康檢查

Docker Compose 會自動執行健康檢查：

```bash
# 查看健康狀態
docker-compose ps

# 查看健康檢查日誌
docker inspect mcp-prompt-manager | grep -A 10 Health
```

## 故障排除

### 常見問題

#### 1. 容器無法啟動

**問題**：容器啟動後立即退出

**解決方法**：

```bash
# 查看日誌
docker-compose logs mcp-prompt-manager

# 檢查環境變數
docker-compose config

# 驗證 Git 倉庫 URL
docker exec mcp-prompt-manager git ls-remote ${PROMPT_REPO_URL}
```

#### 2. Git 認證失敗

**問題**：無法克隆私有 Git 倉庫

**解決方法**：

**方法 1：使用 SSH 密鑰**

```yaml
volumes:
  - ~/.ssh:/home/mcp/.ssh:ro
environment:
  - SSH_AUTH_SOCK=/home/mcp/.ssh/agent.sock
```

**方法 2：使用 Personal Access Token**

```bash
# 在 Git URL 中包含 token
PROMPT_REPO_URL=https://token@github.com/username/repo.git
```

#### 3. 端口衝突

**問題**：端口已被占用

**解決方法**：

```yaml
ports:
  - "3001:3000"  # 將主機端口改為 3001
```

或修改環境變數：

```bash
HTTP_PORT=3001 docker-compose up -d
```

#### 4. 快取目錄權限問題

**問題**：無法寫入 `.prompts_cache` 目錄

**解決方法**：

```bash
# 檢查目錄權限
docker exec mcp-prompt-manager ls -la /app/.prompts_cache

# 修復權限
docker exec mcp-prompt-manager chown -R mcp:nodejs /app/.prompts_cache
```

### 日誌查看

#### 查看實時日誌

```bash
# Docker Compose
docker-compose logs -f mcp-prompt-manager

# Docker
docker logs -f mcp-prompt-manager
```

#### 查看歷史日誌

```bash
# 最近 100 行
docker-compose logs --tail=100 mcp-prompt-manager

# 特定時間範圍
docker-compose logs --since 2024-01-01T00:00:00 mcp-prompt-manager
```

#### 導出日誌

```bash
# 導出到文件
docker-compose logs mcp-prompt-manager > logs.txt

# 生產環境（使用日誌驅動）
docker-compose -f docker-compose.prod.yml logs > logs.txt
```

### 調試技巧

#### 進入容器

```bash
# 進入運行中的容器
docker exec -it mcp-prompt-manager sh

# 檢查環境變數
docker exec mcp-prompt-manager env

# 檢查進程
docker exec mcp-prompt-manager ps aux
```

#### 檢查網路連接

```bash
# 檢查端口監聽
docker exec mcp-prompt-manager netstat -tlnp

# 測試 HTTP 端點
docker exec mcp-prompt-manager wget -O- http://localhost:3000/health
```

#### 檢查 Git 倉庫同步

```bash
# 檢查快取目錄
docker exec mcp-prompt-manager ls -la /app/.prompts_cache

# 檢查 Git 狀態
docker exec mcp-prompt-manager git -C /app/.prompts_cache status
```

### 性能優化

#### 資源限制

生產環境建議設定資源限制：

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

#### 日誌管理

生產環境建議配置日誌輪轉：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    compress: "true"
```

## 進階配置

### 使用 Docker Secrets

對於敏感信息（如 Git 認證），建議使用 Docker Secrets：

```yaml
secrets:
  git_token:
    external: true

services:
  mcp-prompt-manager:
    secrets:
      - git_token
    environment:
      - GIT_TOKEN_FILE=/run/secrets/git_token
```

### 多容器部署

如果需要部署多個實例：

```yaml
services:
  mcp-prompt-manager-1:
    # ... 配置
    ports:
      - "3000:3000"
  
  mcp-prompt-manager-2:
    # ... 配置
    ports:
      - "3001:3000"
```

### 與反向代理整合

使用 Nginx 作為反向代理：

```nginx
upstream mcp_prompt_manager {
    server mcp-prompt-manager:3000;
}

server {
    listen 80;
    server_name mcp.example.com;
    
    location / {
        proxy_pass http://mcp_prompt_manager;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 相關資源

- [Docker 官方文檔](https://docs.docker.com/)
- [Docker Compose 文檔](https://docs.docker.com/compose/)
- [MCP Prompt Manager README](README.md)

