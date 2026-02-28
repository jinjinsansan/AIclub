# OPEN CLAW コミュニティプラットフォーム

**完全システム仕様書 v2.0** に基づく実装

## プロジェクト概要

OPEN CLAWは、AIボット「CLAW」を中心としたコミュニティプラットフォームです。初期費用$700の先払い制、3段階紹介制度、MINARA AIとの連携による自動トレードを特徴とします。

### 主な機能

- 🤖 **AIボット連携**: マスターCLAWとメンバーCLAW間の通信
- 💰 **自動支払い処理**: MINARA Webhookによる入金確認・運営分送金
- 👥 **3段階紹介制度**: $200/$50/$50の段階的報酬システム
- 📱 **会員サイト**: Next.js 14によるモダンなウェブアプリ
- 🔄 **自動トレード**: MINARA AIによる自然言語トレード実行
- 📲 **LINE通知**: グループ・個人通知の自動配信

## システム構成

```
openclaw-platform/
├── frontend/                 # Next.js 14 会員サイト
├── backend/                  # Supabase Edge Functions (将来用)
├── database/                 # Supabase スキーマ・マイグレーション
├── master-claw/              # マスター管理CLAW (Node.js/TypeScript)
├── member-claw-template/     # メンバーCLAW テンプレート
├── config-templates/         # 設定ファイルテンプレート
├── docs/                     # API仕様・セットアップガイド
└── scripts/                  # デプロイ・運用スクリプト
```

## 技術スタック

| レイヤー | 技術 | 用途 |
|---------|------|------|
| **フロントエンド** | Next.js 14, Tailwind CSS | 会員サイト・ダッシュボード |
| **バックエンド** | Supabase (PostgreSQL + Realtime) | データ管理・ゲートウェイ |
| **認証** | Supabase Auth | 会員ログイン・権限管理 |
| **決済** | MINARA AI API | 初期費用・月額・報酬支払い |
| **通信** | Supabase Realtime + REST API | マスター↔メンバー連携 |
| **通知** | LINE Messaging API | コミュニティ・個人通知 |
| **ホスティング** | Vercel + VPS | Web公開・CLAW稼働 |

## 開発状況

### ✅ 完了済み

- [x] **プロジェクト構造**: 完全なディレクトリ構成
- [x] **データベース設計**: 4つのSQLスキーマファイル
- [x] **フロントエンド基盤**: Next.js 14 + Tailwind CSS
  - [x] ランディングページ
  - [x] 新規登録フォーム
  - [x] ログインページ  
  - [x] ダッシュボードレイアウト
- [x] **マスター管理CLAW**: 完全なTypeScript実装
  - [x] 支払い処理サービス
  - [x] MINARA API連携
  - [x] 通知システム
  - [x] スケジューラー
  - [x] Express WebAPIサーバー

### 🔄 進行中

- [ ] Supabaseプロジェクトセットアップ
- [ ] フロントエンドのSupabase連携
- [ ] メンバーCLAWテンプレート実装

### 📋 TODO

- [ ] 本番環境デプロイ設定
- [ ] テストスイート作成
- [ ] CI/CD パイプライン
- [ ] API ドキュメント生成
- [ ] セキュリティ監査

## クイックスタート

### 1. リポジトリクローン

```bash
git clone https://github.com/your-org/openclaw-platform.git
cd openclaw-platform
```

### 2. フロントエンド起動

```bash
cd frontend
npm install
cp .env.local.example .env.local
# .env.local を編集
npm run dev
```

### 3. マスター管理CLAW起動

```bash
cd master-claw  
npm install
cp .env.example .env
# .env を編集
npm run dev
```

### 4. データベースセットアップ

Supabaseプロジェクトを作成し、`database/init.sql`を実行してください。

## API仕様

### Webhook エンドポイント

- `POST /webhook/minara/payment` - MINARA支払いWebhook

### 管理者API

- `GET /status` - システムステータス
- `POST /api/admin/broadcast` - 一斉配信
- `POST /api/admin/rewards/process` - 月次報酬処理

### メンバーCLAW API

- `POST /api/members/heartbeat` - ハートビート送信
- `GET /api/members/messages` - メッセージ取得
- `POST /api/members/receipt` - 実行結果報告

詳細は各サービスのREADMEを参照してください。

## セキュリティ設計

- 🔐 **先払い制の徹底**: 入金確認後のみアクセス権限付与
- 🛡️ **Row Level Security**: Supabase RLSによるデータ保護
- ✅ **Webhook署名検証**: HMAC-SHA256による改ざん防止
- 🔑 **APIキー管理**: 環境変数による機密情報の分離
- 🚫 **レート制限**: API乱用防止
- 🔒 **二重送金防止**: トランザクションハッシュのUNIQUE制約

## 料金体系

| 項目 | 金額 | 配分 |
|------|------|------|
| **初期費用** | $700 USD | 運営$400 + 紹介報酬$300 |
| **月額会費** | 未定 | 継続利用料 |

### 紹介報酬配分

- 1段目（直接紹介）: $200
- 2段目（間接紹介）: $50  
- 3段目（間接紹介）: $50

## 開発フェーズ

### Phase 1 - 基盤構築（〜2週間）
- [x] プロジェクト初期化
- [ ] Supabase・テーブル作成
- [ ] 会員サイト基本機能
- [ ] メール認証フロー

### Phase 2 - 支払い・権限フロー（3〜4週間目）
- [x] マスター管理CLAW 基本機能
- [ ] MINARA Webhook処理
- [ ] 自動送金処理
- [ ] 会員ログイン・権限制御

### Phase 3 - 紹介制度・報酬フロー（5〜6週間目）
- [ ] 紹介コード発行・管理
- [ ] 紹介ツリー構築
- [ ] 月次報酬計算・送金
- [ ] 月額会費管理

### Phase 4 - ゲートウェイ・トレード（7〜8週間目）
- [ ] Gateway API完全実装
- [ ] CLAW間通信システム
- [ ] トレードシグナル配信
- [ ] セキュリティ最終確認

## コントリビュート

現在は内部開発中です。外部コントリビューションは後日受け付け予定です。

## ライセンス

PROPRIETARY - © 2026 なみサポ協会 / OPEN CLAW

---

🦞 **OPEN CLAW** - AIと共に進む、新しい時代のコミュニティプラットフォーム