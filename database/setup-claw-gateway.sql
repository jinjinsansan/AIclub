-- ============================================================
-- OPEN CLAW: CLAW通信基盤セットアップ
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ============================================================
-- 1. members テーブルの RLS 修正
--    （新規登録時の INSERT が失敗する問題を修正）
-- ============================================================

-- 既存ポリシーがあれば削除して再作成
DROP POLICY IF EXISTS "Users can insert own data" ON members;
CREATE POLICY "Users can insert own data" ON members
    FOR INSERT WITH CHECK (member_id = auth.uid()::text);

-- service_role（サーバーサイド）からのフルアクセス用
DROP POLICY IF EXISTS "Service role full access" ON members;
CREATE POLICY "Service role full access" ON members
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. gateway_messages テーブル（CLAW間通信の中核）
-- ============================================================

CREATE TABLE IF NOT EXISTS gateway_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target TEXT NOT NULL,  -- 'all' または member_id(UUID)
    message_type TEXT NOT NULL CHECK (
        message_type IN (
            'broadcast', 'trade_signal', 'update',
            'private', 'reward_notify', 'system_alert'
        )
    ),
    sender TEXT NOT NULL DEFAULT 'master',
    payload JSONB NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    expires_at TIMESTAMP WITH TIME ZONE,
    delivered_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL DEFAULT 'master_001'
);

CREATE INDEX IF NOT EXISTS idx_gateway_messages_target ON gateway_messages(target);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_type ON gateway_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_created_at ON gateway_messages(created_at);

-- RLS
ALTER TABLE gateway_messages ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは自分宛 or 全体向けメッセージを閲覧可
DROP POLICY IF EXISTS "Users can view relevant messages" ON gateway_messages;
CREATE POLICY "Users can view relevant messages" ON gateway_messages
    FOR SELECT USING (
        target = 'all' OR
        target = auth.uid()::text
    );

-- 管理者はフルアクセス（メッセージ送信含む）
DROP POLICY IF EXISTS "Master admin full access messages" ON gateway_messages;
CREATE POLICY "Master admin full access messages" ON gateway_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE member_id = auth.uid()::text
            AND plan = 'master'
        )
    );

-- service_role からのフルアクセス（Edge Functions等）
DROP POLICY IF EXISTS "Service role full access messages" ON gateway_messages;
CREATE POLICY "Service role full access messages" ON gateway_messages
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. message_receipts テーブル（メンバーCLAWからの受信確認）
-- ============================================================

CREATE TABLE IF NOT EXISTS message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES gateway_messages(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'received' CHECK (
        status IN ('received', 'processing', 'completed', 'failed', 'ignored')
    ),
    result JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    UNIQUE(message_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_member_id ON message_receipts(member_id);

-- RLS
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;

-- メンバーは自分のレシートのみ操作可
DROP POLICY IF EXISTS "Users can manage own receipts" ON message_receipts;
CREATE POLICY "Users can manage own receipts" ON message_receipts
    FOR ALL USING (member_id = auth.uid()::text);

-- service_role フルアクセス
DROP POLICY IF EXISTS "Service role full access receipts" ON message_receipts;
CREATE POLICY "Service role full access receipts" ON message_receipts
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. trade_signals テーブル（トレードシグナルログ）
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id TEXT UNIQUE NOT NULL,
    message_id UUID REFERENCES gateway_messages(id) ON DELETE SET NULL,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    entry_price NUMERIC,
    stop_loss NUMERIC,
    take_profit NUMERIC,
    leverage INTEGER DEFAULT 1,
    position_size_pct NUMERIC DEFAULT 5.0,
    natural_language TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_members INTEGER DEFAULT 0,
    executed_members INTEGER DEFAULT 0,
    avg_execution_time_ms INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trade_signals_signal_id ON trade_signals(signal_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_created_at ON trade_signals(created_at);

-- RLS
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

-- 認証済みメンバーは閲覧可
DROP POLICY IF EXISTS "Authenticated users can view trade signals" ON trade_signals;
CREATE POLICY "Authenticated users can view trade signals" ON trade_signals
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- service_role フルアクセス
DROP POLICY IF EXISTS "Service role full access signals" ON trade_signals;
CREATE POLICY "Service role full access signals" ON trade_signals
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 5. Realtime 有効化
--    gateway_messages への INSERT を全購読者にリアルタイム配信
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE gateway_messages;

-- ============================================================
-- 6. メッセージ配信統計更新トリガー
-- ============================================================

CREATE OR REPLACE FUNCTION update_message_delivery_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE gateway_messages
    SET delivered_count = (
        SELECT COUNT(*)
        FROM message_receipts
        WHERE message_id = NEW.message_id
    )
    WHERE id = NEW.message_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_delivery_stats ON message_receipts;
CREATE TRIGGER trigger_update_delivery_stats
    AFTER INSERT ON message_receipts
    FOR EACH ROW EXECUTE FUNCTION update_message_delivery_stats();

-- ============================================================
-- 7. 期限切れメッセージ自動削除関数
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM gateway_messages
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 完了確認
-- ============================================================

SELECT 'gateway_messages' AS table_name, COUNT(*) AS row_count FROM gateway_messages
UNION ALL
SELECT 'message_receipts', COUNT(*) FROM message_receipts
UNION ALL
SELECT 'trade_signals', COUNT(*) FROM trade_signals;
