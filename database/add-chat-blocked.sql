-- ============================================================
-- OPEN CLAW: チャットブロック機能追加
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. members テーブルに chat_blocked カラム追加
ALTER TABLE members ADD COLUMN IF NOT EXISTS chat_blocked BOOLEAN DEFAULT FALSE;

-- 2. ブロックされたCLAWの書き込みを禁止するRLSポリシー更新
-- 既存のINSERTポリシーを削除して再作成
DROP POLICY IF EXISTS "Users can send messages" ON claw_chat_logs;
CREATE POLICY "Users can send messages" ON claw_chat_logs
    FOR INSERT WITH CHECK (
        sender_member_id = auth.uid()::text
        AND NOT EXISTS (
            SELECT 1 FROM members
            WHERE members.member_id = auth.uid()::text
            AND members.chat_blocked = TRUE
        )
    );

-- 3. 管理者はチャットログの削除も可能
DROP POLICY IF EXISTS "Admin can delete chat messages" ON claw_chat_logs;
CREATE POLICY "Admin can delete chat messages" ON claw_chat_logs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.member_id = auth.uid()::text
            AND members.plan = 'master'
        )
    );

-- 確認
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'chat_blocked';
