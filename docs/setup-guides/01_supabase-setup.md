# OPEN CLAW Supabaseセットアップガイド

## 1. Supabaseプロジェクトの作成

### ステップ1: Supabaseアカウント作成・ログイン
1. https://supabase.com にアクセス
2. "Start your project" をクリック
3. GitHub アカウントでサインイン

### ステップ2: 新規プロジェクト作成
1. "New project" をクリック
2. プロジェクト設定：
   - **Name**: `openclaw-platform`
   - **Database Password**: 安全なパスワードを設定（記録必須）
   - **Region**: `Northeast Asia (Tokyo)`
   - **Pricing Plan**: `Free` (開発段階)

### ステップ3: データベーススキーマの実行

プロジェクト作成後、SQL Editorで以下のファイルを順番に実行：

1. `database/schemas/01_members.sql`
2. `database/schemas/02_referral_system.sql`  
3. `database/schemas/03_payment_gateway.sql`
4. `database/schemas/04_system_management.sql`

### ステップ4: 環境変数の取得

Settings → API から以下を取得：

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]
```

## 2. Row Level Security (RLS) の確認

各テーブルのRLSが正しく設定されているか確認：

```sql
-- RLS有効化状況を確認
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- ポリシー一覧を確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';
```

## 3. Authentication設定

### ステップ1: Auth設定
Authentication → Settings で以下を設定：

- **Site URL**: `http://localhost:3000` (開発環境)
- **Redirect URLs**: 
  - `http://localhost:3000/auth/callback`
  - `https://yourdomain.com/auth/callback` (本番環境)

### ステップ2: Email templates
Authentication → Email templates で以下をカスタマイズ：

- **Confirm signup**: ウェルカムメッセージ
- **Invite user**: 招待メッセージ  
- **Magic link**: マジックリンク
- **Change email address**: メール変更確認

## 4. Storage設定（将来用）

Storage → New bucket で以下を作成：

- **manuals**: マニュアルファイル保存用
- **avatars**: ユーザーアバター保存用

## 5. Real-time設定

Database → Replication で以下テーブルのリアルタイム機能を有効化：

- `gateway_messages`
- `members` (claw_statusカラムのみ)
- `notification_logs`

## 6. 動作確認

### データベース接続テスト
```bash
cd master-claw
npm run test-db
```

### 基本データの投入
```sql
-- システム設定の確認
SELECT * FROM system_config;

-- マスター管理者の確認
SELECT * FROM members WHERE member_id = 'master_001';

-- 通知テンプレートの確認
SELECT template_key, channel FROM notification_templates;
```

## トラブルシューティング

### よくある問題

1. **RLSエラー**: ポリシーが正しく設定されているか確認
2. **認証エラー**: JWT_SECRETが正しく設定されているか確認
3. **接続エラー**: ファイアウォール・ネットワーク設定を確認

### デバッグ用SQL

```sql
-- エラーログの確認
SELECT * FROM system_logs 
WHERE log_level IN ('ERROR', 'CRITICAL') 
ORDER BY created_at DESC 
LIMIT 10;

-- 会員統計
SELECT membership_status, COUNT(*) 
FROM members 
GROUP BY membership_status;
```

---

⚠️ **重要**: データベースパスワードとAPIキーは安全に保管してください。