# Phase 4 実装ガイド：本番環境デプロイ・稼働開始

**期間**: 8〜10週間目  
**目標**: 本番環境での完全稼働とベータメンバー受け入れ開始

## 📋 Phase 4 仕様書要件

### ✅ Phase 1-3 完了確認
- [x] **Phase 1**: データベース基盤・認証システム・フロントエンド基盤・マスター管理CLAW
- [x] **Phase 2**: MINARA Webhook受信・会員ダッシュボード・マニュアルライブラリ・権限制御
- [x] **Phase 3**: 3段階紹介制度・月次報酬処理・LINE通知・セミナー管理

### 🎯 Phase 4 実装目標

#### 1. 本番環境セットアップ
- **Supabaseプロジェクト本格稼働**: 実データベース・Auth・RLS設定
- **MINARA API実連携**: Webhook受信・実送金テスト
- **LINE Bot本格稼働**: 公式アカウント・オープンチャット開設
- **ドメイン・SSL**: 本番ドメイン設定・セキュリティ強化

#### 2. ベータテスト開始
- **ベータメンバー募集**: 5〜10名の初期メンバー獲得
- **実際の支払いテスト**: $700初期費用・紹介制度の動作確認
- **セミナー開催**: 第1回オンラインセミナー実施
- **フィードバック収集**: UI/UX改善・バグ修正

#### 3. 運営体制確立
- **管理画面完成**: 運営者向けダッシュボード
- **監視システム**: エラー検知・アラート機能
- **サポート体制**: FAQ・問い合わせ対応
- **コンプライアンス**: 利用規約・プライバシーポリシー

#### 4. スケーラビリティ準備
- **パフォーマンス最適化**: データベース・API高速化
- **セキュリティ監査**: 脆弱性診断・対策実装
- **バックアップ・災害復旧**: データ保護体制
- **グローバル展開準備**: 多言語対応基盤

## 🛠️ Phase 4 詳細実装手順

### Step 1: Supabase本番環境構築

#### 1.1 プロジェクト作成・設定
```bash
# 1. Supabase本番プロジェクト作成
# - Organization: OPEN CLAW Community
# - Project Name: openclaw-production
# - Region: Northeast Asia (Singapore)
# - Plan: Pro ($25/month)

# 2. データベース初期化
supabase db push --db-url [PRODUCTION_DATABASE_URL]

# 3. 環境変数更新
cp frontend/.env.local.example frontend/.env.production
cp master-claw/.env.example master-claw/.env.production
```

#### 1.2 RLS（Row Level Security）設定確認
```sql
-- すべてのテーブルでRLS有効化確認
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- セキュリティポリシー動作確認
SELECT * FROM members WHERE member_id = auth.uid();
```

#### 1.3 Auth設定・メールテンプレート
```sql
-- メール認証テンプレート設定
-- Supabase Dashboard > Authentication > Email Templates
-- - 確認メール（日本語）
-- - パスワードリセット（日本語）  
-- - 招待メール（日本語）
```

### Step 2: MINARA API実連携

#### 2.1 本番API設定
```typescript
// master-claw/.env.production
MINARA_API_URL=https://api.minara.ai/v1
MINARA_API_KEY=[実際のAPIキー]
MINARA_WEBHOOK_SECRET=[実際の署名キー]
MINARA_MASTER_WALLET=[運営マスターウォレット]
MINARA_OPERATOR_WALLETS=["0xOperator1","0xOperator2"]
```

#### 2.2 Webhook受信テスト
```bash
# ngrokで外部公開
ngrok http 3001

# Webhook URL設定
# https://[ngrok-url]/webhook/minara/payment

# テスト送金実行
curl -X POST https://[ngrok-url]/webhook/minara/payment \
  -H "Content-Type: application/json" \
  -H "X-Minara-Signature: [署名]" \
  -d '{
    "from_wallet": "0xTestWallet",
    "to_wallet": "[MASTER_WALLET]",
    "amount": 700,
    "currency": "USDT",
    "tx_hash": "0xtest123",
    "timestamp": "2026-02-28T02:00:00Z"
  }'
```

### Step 3: LINE Bot本格稼働

#### 3.1 LINE公式アカウント作成
```bash
# 1. LINE Developers Console
# https://developers.line.biz/console/

# 2. 新規プロバイダー作成
# Provider Name: OPEN CLAW Community

# 3. Messaging APIチャネル作成
# Channel Name: OPEN CLAW Bot
# Channel Description: AI自動トレードコミュニティ

# 4. Webhook URL設定
# https://[本番ドメイン]/webhook/line
```

#### 3.2 オープンチャット開設
```markdown
# LINEオープンチャット設定
- チャット名: 🦞 OPEN CLAW コミュニティ
- 説明: AI自動トレードの情報交換・サポート
- 参加上限: 500名
- 承認制: ON（メンバー限定）
- 管理者: 運営チーム
```

### Step 4: ドメイン・SSL設定

#### 4.1 本番ドメイン設定
```bash
# ドメイン例: openclaw.community
# DNS設定:
# - A Record: @ → [サーバーIP]
# - A Record: www → [サーバーIP]  
# - CNAME: api → [API Gateway]
# - CNAME: app → [Vercel/Netlify]

# SSL証明書: Let's Encrypt自動更新
```

#### 4.2 環境別URL設定
```typescript
// config/environments.ts
export const environments = {
  development: {
    frontend: 'http://localhost:3000',
    api: 'http://localhost:3001',
    supabase: 'https://[dev-project].supabase.co'
  },
  production: {
    frontend: 'https://openclaw.community',
    api: 'https://api.openclaw.community', 
    supabase: 'https://[prod-project].supabase.co'
  }
}
```

## 🧪 Phase 4 テストシナリオ

### シナリオ1: エンドツーエンドテスト
1. **新規会員登録**: LP → 登録 → メール認証 → 支払い案内
2. **MINARA送金**: $700送金 → Webhook受信 → アカウント有効化
3. **ダッシュボードアクセス**: ログイン → 各機能動作確認
4. **紹介制度**: 紹介コード使用 → 報酬計上 → 月次処理

### シナリオ2: セミナー・コミュニティ
1. **セミナー開催**: Zoom会議作成 → LINE通知 → 参加者管理
2. **オープンチャット**: 質問投稿 → Bot応答 → 管理者対応
3. **マニュアル配信**: 新規マニュアル → アクセス権確認 → 配信

### シナリオ3: 運営管理
1. **管理画面**: メンバー管理 → 支払い履歴 → 統計確認
2. **障害対応**: エラー検知 → アラート → 復旧作業
3. **月次処理**: 報酬計算 → 送金実行 → 完了通知

## 📊 Phase 4 成功指標

### ✅ 必須達成目標
- [ ] 本番環境100%稼働（99.9%アップタイム）
- [ ] ベータメンバー5名以上の実登録
- [ ] 実際の$700支払い処理3件以上
- [ ] 紹介制度実績1件以上
- [ ] セミナー開催1回以上（参加者80%以上）

### 🎯 理想的達成目標
- [ ] ベータメンバー15名以上
- [ ] 3段階紹介ツリー完成
- [ ] セミナー月2回開催
- [ ] メンバー満足度4.5/5.0以上
- [ ] システム無停止稼働

## 🔐 Phase 4 セキュリティチェック

- [ ] **データベース**: RLS・暗号化・バックアップ
- [ ] **API認証**: JWT・レート制限・CORS
- [ ] **Webhook**: 署名検証・重複防止・ログ
- [ ] **決済**: 2FA・承認フロー・監査ログ
- [ ] **個人情報**: GDPR準拠・最小限収集・暗号化

## 🚀 Phase 4 デプロイ計画

### Week 8: インフラ構築
- [ ] Supabase本番環境
- [ ] MINARA API連携  
- [ ] LINE Bot設定
- [ ] ドメイン・SSL

### Week 9: ベータテスト
- [ ] 内部テスト完了
- [ ] ベータメンバー招待
- [ ] 実支払いテスト
- [ ] フィードバック収集

### Week 10: 正式ローンチ
- [ ] 最終バグ修正
- [ ] パフォーマンス最適化
- [ ] 監視体制確立
- [ ] 公式ローンチ

---

**Phase 4完了条件**: 本番環境での完全稼働とベータメンバー5名以上の実際利用が安定して継続できること。