# 仕様書v2.0適合性 - 修正タスクリスト

## 現在の適合率: 92/100点

### 🔧 即座修正項目（+8点獲得）

#### 1. APIエンドポイント名統一 (+3点)

**仕様書準拠に修正:**
```typescript
// 修正前
POST /webhook/minara/payment

// 修正後（仕様書通り）
POST /api/payment/confirm
```

**ファイル修正箇所:**
- `master-claw/src/server.ts`: ルート名変更
- `frontend/lib/api.ts`: エンドポイント名更新

#### 2. config.json構造完全一致 (+2点)

**仕様書のテンプレート通りに修正:**
```json
{
  "role": "member",
  "member_id": "REPLACE_WITH_YOUR_MEMBER_ID",
  "gateway": {
    "url": "REPLACE_WITH_SUPABASE_URL", 
    "anon_key": "REPLACE_WITH_SUPABASE_ANON_KEY",
    "channel": "claw_gateway"
  },
  "minara": {
    "api_endpoint": "https://api.minara.ai/v1",
    "api_key": "REPLACE_WITH_YOUR_MINARA_API_KEY",
    "wallet_address": "REPLACE_WITH_YOUR_WALLET_ADDRESS"
  },
  "trade": {
    "auto_execute": true,
    "max_position_size": "10%",
    "stop_loss_pct": 2.0,
    "daily_trade_limit": 5,
    "allowed_pairs": ["BTC/USD", "ETH/USD"]
  },
  "heartbeat_interval_sec": 60
}
```

**修正箇所:**
- `frontend/app/dashboard/page.tsx`: config.jsonダウンロード機能
- マニュアルページでのテンプレート配信

#### 3. LINE通知文面を仕様書準拠に (+2点)

**仕様書指定フォーマット実装:**
```typescript
// 新メンバー通知
`【OPEN CLAW】新メンバー参加！
${member.display_name}さんがコミュニティに参加しました。
現在のメンバー数: ${memberCount}名`

// 月次報酬通知
`【OPEN CLAW 月次報酬】
今月の紹介報酬を送金しました。
受取額: $${amount}
TxID: ${txHash}
お疲れさまです！`
```

**修正箇所:**
- `master-claw/src/services/line.ts`: 通知メッセージ更新

#### 4. 管理画面の月次報酬プレビュー機能 (+1点)

**仕様書通りの機能追加:**
- 月次報酬一括送金の事前プレビュー
- 手動承認ステップの実装

**追加箇所:**
- `frontend/app/admin/rewards-preview/page.tsx`: 新規作成
- API: `/api/admin/rewards/preview`, `/api/admin/rewards/execute`

## 🎯 100点達成のための修正実装

### 優先度1: APIエンドポイント統一
```bash
cd openclaw-platform
# server.tsのルート変更
# API呼び出し箇所の一括置換
```

### 優先度2: 設定テンプレート更新  
```bash
# config.json テンプレートを仕様書通りに更新
# ダウンロード機能の調整
```

### 優先度3: LINE通知文面統一
```bash
# line.tsの通知メッセージを仕様書準拠に修正
```

### 優先度4: 管理機能追加
```bash
# 管理画面の月次報酬プレビュー機能実装
```

## ✅ 修正完了後の期待結果

**100点達成項目:**
- APIエンドポイント: 仕様書完全準拠
- 設定ファイル: 完全一致
- LINE通知: 指定文面通り
- 管理機能: 全機能実装

**総合評価: 100/100点**
- 仕様書v2.0完全準拠
- 機能・UI・セキュリティすべて要件満足  
- 本番稼働準備完了

---
修正所要時間: 約2-3時間
修正後の再診断実施で100点達成予定