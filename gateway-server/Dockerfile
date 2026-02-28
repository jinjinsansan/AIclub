FROM node:18-alpine

WORKDIR /app

# パッケージファイルコピー
COPY package.json ./
RUN npm install --production

# ソースコードコピー
COPY tsconfig.json ./
COPY src/ ./src/
COPY config/ ./config/
COPY scripts/ ./scripts/

# TypeScriptビルド
RUN npm install typescript ts-node --save-dev
RUN npx tsc

# 権限設定
RUN chmod +x scripts/*.sh 2>/dev/null || true

# ポート公開
EXPOSE 18789

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:18789/health || exit 1

# 起動
CMD ["node", "dist/server.js"]
