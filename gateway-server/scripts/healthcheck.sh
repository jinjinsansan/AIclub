#!/bin/bash
# OpenClaw Gateway Server ヘルスチェックスクリプト

GATEWAY_PORT=${GATEWAY_PORT:-18789}
GATEWAY_HOST=${GATEWAY_HOST:-localhost}

# Gateway ヘルスチェック
GATEWAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${GATEWAY_HOST}:${GATEWAY_PORT}/health" 2>/dev/null)

if [ "$GATEWAY_STATUS" != "200" ]; then
  echo "ERROR: Gateway health check failed: $GATEWAY_STATUS"
  exit 1
fi

# 詳細情報取得
HEALTH_DATA=$(curl -s "http://${GATEWAY_HOST}:${GATEWAY_PORT}/health" 2>/dev/null)
echo "Gateway health: $HEALTH_DATA"

echo "All services healthy"
