-- OPEN CLAW: Phase 5 - OpenClaw Studio統合テーブル
-- Gateway接続管理、CLAW間チャット、メンバーCLAW設定

-- ============================================================
-- Gateway接続管理テーブル
-- メンバーCLAWのGateway接続状態・認証トークンを管理
-- ============================================================
CREATE TABLE gateway_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    connection_token TEXT UNIQUE NOT NULL,
    gateway_session_id TEXT,
    status TEXT DEFAULT 'offline' CHECK (
        status IN ('offline', 'connecting', 'online', 'error')
    ),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    connected_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_gateway_connections_member_id ON gateway_connections(member_id);
CREATE INDEX idx_gateway_connections_token ON gateway_connections(connection_token);
CREATE INDEX idx_gateway_connections_status ON gateway_connections(status);
CREATE INDEX idx_gateway_connections_last_ping ON gateway_connections(last_ping);

-- ============================================================
-- CLAW間チャットログテーブル
-- Gateway経由のCLAW間メッセージ履歴を保持
-- ============================================================
CREATE TABLE claw_chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name TEXT NOT NULL,
    sender_member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    message_type TEXT DEFAULT 'text' CHECK (
        message_type IN ('text', 'file', 'image', 'system')
    ),
    content TEXT NOT NULL,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_to TEXT[],
    read_by JSONB DEFAULT '{}'
);

-- インデックス
CREATE INDEX idx_claw_chat_logs_channel ON claw_chat_logs(channel_name);
CREATE INDEX idx_claw_chat_logs_sender ON claw_chat_logs(sender_member_id);
CREATE INDEX idx_claw_chat_logs_sent_at ON claw_chat_logs(sent_at);
CREATE INDEX idx_claw_chat_logs_channel_sent ON claw_chat_logs(channel_name, sent_at DESC);

-- ============================================================
-- メンバーCLAW設定テーブル
-- 各メンバーのCLAWバージョン・能力・設定情報を管理
-- ============================================================
CREATE TABLE member_claw_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT UNIQUE NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    claw_version TEXT,
    capabilities JSONB DEFAULT '{}',
    current_config JSONB,
    gateway_preferences JSONB DEFAULT '{}',
    last_config_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_member_claw_config_member_id ON member_claw_config(member_id);

-- ============================================================
-- Row Level Security 設定
-- ============================================================

-- gateway_connections: RLS有効化
ALTER TABLE gateway_connections ENABLE ROW LEVEL SECURITY;

-- メンバーは自分の接続情報のみ閲覧可
CREATE POLICY member_connections_select ON gateway_connections
    FOR SELECT USING (member_id = auth.uid()::text);

-- メンバーは自分の接続を更新可
CREATE POLICY member_connections_update ON gateway_connections
    FOR UPDATE USING (member_id = auth.uid()::text);

-- 管理者はフルアクセス
CREATE POLICY admin_gateway_connections_all ON gateway_connections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.member_id = auth.uid()::text
            AND members.plan = 'master'
        )
    );

-- claw_chat_logs: RLS有効化
ALTER TABLE claw_chat_logs ENABLE ROW LEVEL SECURITY;

-- メンバーは送信したメッセージまたは配信先に含まれるメッセージを閲覧可
CREATE POLICY member_chat_select ON claw_chat_logs
    FOR SELECT USING (
        sender_member_id = auth.uid()::text
        OR auth.uid()::text = ANY(delivered_to)
    );

-- メンバーは自分のメッセージを送信可（INSERT）
CREATE POLICY member_chat_insert ON claw_chat_logs
    FOR INSERT WITH CHECK (sender_member_id = auth.uid()::text);

-- 管理者はフルアクセス
CREATE POLICY admin_chat_all ON claw_chat_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.member_id = auth.uid()::text
            AND members.plan = 'master'
        )
    );

-- member_claw_config: RLS有効化
ALTER TABLE member_claw_config ENABLE ROW LEVEL SECURITY;

-- メンバーは自分の設定のみ操作可
CREATE POLICY member_config_all ON member_claw_config
    FOR ALL USING (member_id = auth.uid()::text);

-- 管理者はフルアクセス
CREATE POLICY admin_config_all ON member_claw_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.member_id = auth.uid()::text
            AND members.plan = 'master'
        )
    );

-- ============================================================
-- ヘルパー関数
-- ============================================================

-- Gateway接続状態の更新関数
CREATE OR REPLACE FUNCTION update_gateway_status(
    p_member_id TEXT,
    p_status TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE gateway_connections
    SET
        status = p_status,
        last_ping = NOW(),
        ip_address = COALESCE(p_ip_address, ip_address),
        connected_at = CASE WHEN p_status = 'online' AND status != 'online' THEN NOW() ELSE connected_at END,
        disconnected_at = CASE WHEN p_status = 'offline' AND status = 'online' THEN NOW() ELSE disconnected_at END
    WHERE member_id = p_member_id;

    -- members テーブルのclaw_statusも連動更新
    UPDATE members
    SET
        claw_status = CASE
            WHEN p_status = 'online' THEN 'online'
            WHEN p_status = 'error' THEN 'error'
            ELSE 'offline'
        END,
        last_seen = NOW()
    WHERE member_id = p_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- チャットメッセージ統計取得関数
CREATE OR REPLACE FUNCTION get_chat_stats(
    p_channel TEXT DEFAULT NULL,
    p_since TIMESTAMP DEFAULT (NOW() - INTERVAL '24 hours')
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_messages', COUNT(*),
        'unique_senders', COUNT(DISTINCT sender_member_id),
        'channels', (
            SELECT json_agg(DISTINCT channel_name)
            FROM claw_chat_logs
            WHERE sent_at >= p_since
            AND (p_channel IS NULL OR channel_name = p_channel)
        ),
        'since', p_since
    ) INTO result
    FROM claw_chat_logs
    WHERE sent_at >= p_since
    AND (p_channel IS NULL OR channel_name = p_channel);

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
