# 多階段構建 Dockerfile for MCP Prompt Manager

# ============================================
# 階段 1: 構建階段
# ============================================
FROM node:20-alpine AS builder

# 安裝 pnpm（符合 package.json 的 packageManager 要求）
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# 設置工作目錄
WORKDIR /app

# 複製依賴文件
COPY package.json pnpm-lock.yaml ./

# 安裝依賴（包含 devDependencies，因為需要 TypeScript 編譯）
RUN pnpm install --frozen-lockfile

# 複製源代碼和配置文件
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# 執行 TypeScript 編譯
RUN pnpm run build

# ============================================
# 階段 2: 運行階段
# ============================================
FROM node:20-alpine AS runner

# 安裝必要的系統工具
# - git: 用於 Git 倉庫同步
# - openssh-client: 用於 SSH Git 認證（如果需要）
# - ca-certificates: 用於 HTTPS 連接
RUN apk add --no-cache \
    git \
    openssh-client \
    ca-certificates \
    tini \
    && update-ca-certificates

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# 創建非 root 用戶（提高安全性）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# 設置工作目錄
WORKDIR /app

# 從構建階段複製編譯後的代碼
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/package.json ./
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules

# 創建快取目錄並設置權限
RUN mkdir -p /app/.prompts_cache && \
    chown -R mcp:nodejs /app/.prompts_cache

# 切換到非 root 用戶
USER mcp

# 暴露端口（根據 TRANSPORT_TYPE 決定）
# HTTP 模式預設使用 3000
# SSE 模式預設使用 3001
EXPOSE 3000 3001

# 設置環境變數預設值
ENV NODE_ENV=production
ENV TRANSPORT_TYPE=stdio
ENV STORAGE_DIR=/app/.prompts_cache

# 健康檢查
# 對於 HTTP/SSE 模式，使用 HTTP 健康檢查端點
# 對於 stdio 模式，僅檢查進程是否運行
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))" || exit 1

# 啟動命令
# 根據 TRANSPORT_TYPE 環境變數選擇不同的啟動方式
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

