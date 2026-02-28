#!/bin/bash
# OpenClaw Gateway Server 起動スクリプト

echo "Starting OPEN CLAW Gateway Server..."

# 環境変数確認
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Missing Supabase configuration"
  echo "Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Gateway起動
cd "$(dirname "$0")/.."

if [ -f "dist/server.js" ]; then
  echo "Starting compiled server..."
  node dist/server.js
else
  echo "Starting with ts-node..."
  npx ts-node src/server.ts
fi
