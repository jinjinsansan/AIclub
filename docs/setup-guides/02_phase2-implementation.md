# Phase 2 実装ガイド：支払い・権限フロー稼働

**期間**: 3〜4週間目  
**目標**: 実際の支払い処理とデータベース連携の完全稼働

## 📋 Phase 2 タスクリスト

### ✅ 完了済み（マスター管理CLAW）
- [x] 入金確認・会員有効化ロジック
- [x] 運営分 $400 の即時自動送金
- [x] 紹介報酬計算・月次送金システム
- [x] システムログ・通知機能

### 🔄 Phase 2 実装タスク

#### 1. Supabaseプロジェクト本格稼働
- [ ] 本番Supabaseプロジェクト作成
- [ ] データベーススキーマ実行（4ファイル）
- [ ] RLS（Row Level Security）設定確認
- [ ] Auth設定・メールテンプレート設定

#### 2. MINARA Webhook受信処理
- [ ] 本番MINARA API接続設定
- [ ] Webhook署名検証実装確認
- [ ] 入金確認テスト（開発環境）
- [ ] 自動送金処理テスト

#### 3. 会員ログイン・ダッシュボード・権限制御
- [ ] フロントエンドSupabase実連携
- [ ] 会員ステータス別アクセス制御
- [ ] ダッシュボードリアルタイム更新
- [ ] 支払い待ちページ完全実装

#### 4. マニュアルライブラリ（MANUAL-001〜004）
- [ ] セットアップマニュアル作成
- [ ] 動画・PDFアップロード機能
- [ ] アクセス権限制御
- [ ] マニュアル管理機能

## 🛠️ Phase 2 実装手順

### Step 1: 実際のSupabase環境構築

1. **Supabaseプロジェクト作成**
   ```bash
   # 1. https://supabase.com でプロジェクト作成
   # 2. プロジェクトID・APIキー取得
   # 3. 環境変数更新
   ```

2. **データベーススキーマ実行**
   ```sql
   -- SQL Editorで順次実行
   \i database/schemas/01_members.sql
   \i database/schemas/02_referral_system.sql
   \i database/schemas/03_payment_gateway.sql
   \i database/schemas/04_system_management.sql
   ```

3. **環境変数更新**
   ```bash
   # frontend/.env.local
   NEXT_PUBLIC_SUPABASE_URL=https://[実際のプロジェクトID].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[実際のAPIキー]
   
   # master-claw/.env
   SUPABASE_URL=https://[実際のプロジェクトID].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[実際のサービスロールキー]
   USE_REAL_DATABASE=true
   ```

### Step 2: フロントエンド実連携

1. **認証機能テスト**
   ```bash
   cd frontend
   npm run dev
   # http://localhost:3000 でテスト
   ```

2. **会員登録フローテスト**
   - 仮登録 → メール認証 → 支払い待ち状態確認

### Step 3: マスター管理CLAW実環境接続

1. **実データベース接続**
   ```bash
   cd master-claw
   # USE_REAL_DATABASE=true に設定
   npm run test-db
   ```

2. **Webhook受信準備**
   ```bash
   # ngrok等でローカル開発環境を外部公開
   ngrok http 3001
   # Webhook URL: https://[ngrok-url]/webhook/minara/payment
   ```

### Step 4: MINARA API連携

1. **開発環境でのWebhookテスト**
   - テスト用支払いデータ送信
   - 自動処理フロー確認

2. **送金機能テスト**
   - テスト用ウォレットでの送金確認

## 📊 Phase 2 成功指標

### ✅ 最低限達成目標
- [ ] 実際のSupabaseでの会員登録・ログイン
- [ ] MINARA Webhook受信・支払い確認
- [ ] 会員ステータス自動更新
- [ ] ダッシュボードでの情報表示

### 🎯 理想的達成目標
- [ ] 5名のベータテストメンバー獲得
- [ ] 実際の$700支払い処理1件以上
- [ ] 紹介制度テスト完了
- [ ] マニュアル4本完成

## 🔐 Phase 2 セキュリティチェック

- [ ] RLS設定動作確認
- [ ] API認証動作確認
- [ ] Webhook署名検証確認
- [ ] 不正アクセス防止確認

## 🧪 Phase 2 テストシナリオ

### シナリオ1: 新規会員登録
1. LP訪問 → 仮登録
2. メール認証完了
3. 支払い案内表示
4. MINARA送金実行
5. 自動アカウント有効化
6. ダッシュボードアクセス成功

### シナリオ2: 紹介制度
1. 既存会員が紹介コード発行
2. 新規会員が紹介コード使用
3. 支払い完了
4. 紹介報酬自動計上
5. 月次報酬処理確認

### シナリオ3: エラー処理
1. 不正なWebhookデータ送信
2. 不足金額での支払い
3. 不明ウォレットからの送金
4. 適切なエラー処理・ログ確認

---

**Phase 2完了条件**: 上記テストシナリオがすべて正常動作し、ベータメンバー5名以上の実際利用が確認できること。