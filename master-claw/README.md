# OPEN CLAW マスター管理システム

OPEN CLAWコミュニティプラットフォームの中央管理サーバー

## 概要

マスター管理CLAWは以下の機能を提供します：

- **支払い処理**: MINARA Webhookによる自動支払い確認・処理
- **会員管理**: ステータス更新・アクセス権限制御
- **紹介制度**: 3段階紹介報酬の計算・自動送金
- **通知システム**: LINE・メール通知の配信
- **ゲートウェイAPI**: メンバーCLAW間の通信管理
- **スケジューラー**: 定期実行タスクの管理

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .env ファイルを編集して実際の値を設定
```

### 3. TypeScriptのビルド

```bash
npm run build
```

### 4. データベースの初期化

Supabaseプロジェクトで以下のSQLファイルを実行：
- `../database/schemas/01_members.sql`
- `../database/schemas/02_referral_system.sql`
- `../database/schemas/03_payment_gateway.sql`
- `../database/schemas/04_system_management.sql`

## 起動

### 開発環境

```bash
npm run dev
```

### 本番環境

```bash
npm run build
npm start
```

## CLIコマンド

```bash
# システム起動（デフォルト）
node dist/index.js start

# バージョン確認
node dist/index.js version

# 設定確認
node dist/index.js config

# データベース接続テスト
node dist/index.js test-db

# MINARA API接続テスト
node dist/index.js test-minara

# ヘルプ表示
node dist/index.js help
```

## API エンドポイント

### パブリック

- `GET /health` - ヘルスチェック

### Webhook

- `POST /webhook/minara/payment` - MINARA支払いWebhook

### 管理者API（要認証）

- `GET /status` - システムステータス
- `POST /api/admin/broadcast` - 一斉配信
- `POST /api/admin/rewards/process` - 月次報酬処理
- `GET /api/admin/members` - メンバー一覧

### メンバーCLAW API（要JWT認証）

- `POST /api/members/heartbeat` - ハートビート
- `GET /api/members/messages` - メッセージ取得
- `POST /api/members/receipt` - 受信確認

## 環境変数

詳細は `.env.example` を参照してください。

### 必須項目

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `MINARA_API_KEY` / `MASTER_WALLET_ADDRESS` / `OPERATOR_WALLET_ADDRESS`
- `WEBHOOK_SECRET` / `MASTER_API_KEY`

### オプション項目

- LINE通知設定
- ログレベル・ディレクトリ
- レート制限設定

## ログ

ログファイルは `./logs` ディレクトリに出力されます：

- `master-claw-YYYY-MM-DD.log` - 全ログ（日次ローテーション）
- `error-YYYY-MM-DD.log` - エラーログのみ
- `exceptions.log` - 未キャッチ例外
- `rejections.log` - 未処理Promise拒否

## スケジューラー

以下のタスクが自動実行されます：

- **10:00** - 支払いリマインダー
- **12:00** - 期限切れメンバー更新  
- **23:00** - 月次報酬処理（月末）
- **毎時** - ヘルスチェック
- **02:00** - 期限切れメッセージクリーンアップ
- **01:00** - システム統計更新

## セキュリティ

- Helmet.jsによるセキュリティヘッダー
- レート制限（デフォルト：15分間に100リクエスト）
- HMAC-SHA256によるWebhook署名検証
- APIキーベースの管理者認証
- JWTトークンによるメンバー認証

## 監視

### ヘルスチェック

```bash
curl http://localhost:3001/health
```

### システムステータス

```bash
curl -H "Authorization: Bearer YOUR_MASTER_API_KEY" \
     http://localhost:3001/status
```

## 開発

### ディレクトリ構造

```
src/
├── config/          # 設定管理
├── services/        # ビジネスロジック
│   ├── database.ts
│   ├── minara.ts
│   ├── payment.ts
│   ├── notification.ts
│   └── scheduler.ts
├── types/           # TypeScript型定義
├── utils/           # ユーティリティ
└── server.ts        # Express サーバー
```

### 追加機能の実装

1. `src/services/` に新しいサービスを作成
2. `src/types/` に必要な型定義を追加
3. `src/server.ts` にAPIエンドポイントを追加
4. テストを作成（TODO）

## トラブルシューティング

### よくある問題

1. **データベース接続エラー**
   - `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を確認
   - ネットワーク接続を確認

2. **MINARA API エラー**
   - `MINARA_API_KEY` の有効性を確認
   - APIレート制限を確認

3. **Webhook署名エラー**
   - `WEBHOOK_SECRET` がMINARA側と一致するか確認

### ログ確認

```bash
# 最新のログを確認
tail -f logs/master-claw-$(date +%Y-%m-%d).log

# エラーログのみ確認
tail -f logs/error-$(date +%Y-%m-%d).log
```

## 本番デプロイ

1. 環境変数を本番用に設定
2. `NODE_ENV=production` に設定
3. プロセス管理（PM2等）を使用
4. リバースプロキシ（Nginx等）の設定
5. HTTPS証明書の設定
6. ファイアウォールの設定

---

© 2026 なみサポ協会 / OPEN CLAW Master System