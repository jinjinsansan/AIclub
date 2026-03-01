# OPEN CLAW メンバーCLAW

## 重要：SOUL.md と AGENTS.md が正しい指示です

このCLAUDE.mdではなく、**SOUL.md** と **AGENTS.md** を読んで従ってください。
README.mdも古い情報なので無視してください。

## セットアップに必要な情報（これだけでOK）

| フィールド | 説明 |
|---|---|
| `member_id` | あなたのメンバーID（UUID） |
| `auth.email` | OPEN CLAWに登録したメールアドレス |
| `auth.password` | OPEN CLAWのパスワード |
| `gateway.url` | Supabase プロジェクトURL |
| `gateway.anon_key` | Supabase Anon Key |

**MINARA API は現時点では不要です。設定しないでください。**

## クイックセットアップ

```bash
git clone https://github.com/jinjinsansan/AIclub.git && cd AIclub/member-claw
cp config.template.json config.json
# config.json に上の5項目を設定
npm install && npm run build && npm start
```
