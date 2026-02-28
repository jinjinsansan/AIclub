-- ============================================================
-- STEP 3: 支払い・ゲートウェイ通信テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('initial', 'monthly', 'penalty', 'refund')),
    from_wallet TEXT NOT NULL,
    to_wallet TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USDT',
    tx_hash TEXT UNIQUE,
    payment_period TEXT,
    memo TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'disputed')),
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_period_format CHECK (payment_period IS NULL OR payment_period ~ '^\d{4}-\d{2}$')
);

CREATE TABLE IF NOT EXISTS gateway_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (
        message_type IN ('broadcast', 'trade_signal', 'update', 'private', 'reward_notify', 'system_alert')
    ),
    payload JSONB NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    expires_at TIMESTAMP WITH TIME ZONE,
    delivered_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL,
    CONSTRAINT valid_trade_signal_payload CHECK (
        message_type != 'trade_signal' OR (
            payload ? 'signal_id' AND payload ? 'pair' AND payload ? 'direction' AND payload ? 'natural_language'
        )
    )
);

CREATE TABLE IF NOT EXISTS message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES gateway_messages(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
    result JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    UNIQUE(message_id, member_id)
);

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

CREATE INDEX IF NOT EXISTS idx_payment_logs_member_id ON payment_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_tx_hash ON payment_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_type ON payment_logs(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_period ON payment_logs(payment_period);
CREATE INDEX IF NOT EXISTS idx_payment_logs_confirmed_at ON payment_logs(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_target ON gateway_messages(target);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_type ON gateway_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_created_at ON gateway_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_expires_at ON gateway_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_member_id ON message_receipts(member_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_status ON message_receipts(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_signal_id ON trade_signals(signal_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_created_at ON trade_signals(created_at);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view own payments" ON payment_logs FOR SELECT USING (member_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users can view relevant messages" ON gateway_messages FOR SELECT USING (target = 'all' OR target = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Users can manage own receipts" ON message_receipts FOR ALL USING (member_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Active members can view trade signals" ON trade_signals FOR SELECT USING (
    EXISTS (SELECT 1 FROM members WHERE member_id = auth.uid()::text AND membership_status = 'active')
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Master admin full access payments" ON payment_logs FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Master admin full access messages" ON gateway_messages FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Master admin full access receipts" ON message_receipts FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Master admin full access signals" ON trade_signals FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM gateway_messages WHERE expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_message_delivery_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE gateway_messages SET delivered_count = (
        SELECT COUNT(*) FROM message_receipts WHERE message_id = NEW.message_id
    ) WHERE id = NEW.message_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_delivery_stats ON message_receipts;
CREATE TRIGGER trigger_update_delivery_stats
    AFTER INSERT ON message_receipts FOR EACH ROW EXECUTE FUNCTION update_message_delivery_stats();

CREATE OR REPLACE FUNCTION handle_payment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_type = 'initial' AND NEW.status = 'confirmed' THEN
        UPDATE members SET membership_status = 'active', fee_paid_until = CURRENT_DATE + INTERVAL '1 month'
        WHERE member_id = NEW.member_id;
        IF EXISTS (SELECT 1 FROM members WHERE member_id = NEW.member_id AND referred_by_code IS NOT NULL) THEN
            PERFORM build_referral_tree(NEW.member_id,
                (SELECT referred_by_code FROM members WHERE member_id = NEW.member_id));
        END IF;
    ELSIF NEW.payment_type = 'monthly' AND NEW.status = 'confirmed' THEN
        UPDATE members SET membership_status = 'active',
            fee_paid_until = CASE WHEN fee_paid_until > CURRENT_DATE THEN fee_paid_until + INTERVAL '1 month'
                ELSE CURRENT_DATE + INTERVAL '1 month' END
        WHERE member_id = NEW.member_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_confirmation ON payment_logs;
CREATE TRIGGER trigger_payment_confirmation
    AFTER INSERT OR UPDATE OF status ON payment_logs
    FOR EACH ROW EXECUTE FUNCTION handle_payment_confirmation();

CREATE OR REPLACE VIEW monthly_revenue_report AS
SELECT TO_CHAR(confirmed_at, 'YYYY-MM') as month, payment_type,
    COUNT(*) as transaction_count, SUM(amount) as total_amount, AVG(amount) as avg_amount,
    COUNT(DISTINCT member_id) as unique_members
FROM payment_logs WHERE status = 'confirmed'
GROUP BY TO_CHAR(confirmed_at, 'YYYY-MM'), payment_type ORDER BY month DESC, payment_type;

CREATE OR REPLACE VIEW member_activity_stats AS
SELECT membership_status, COUNT(*) as member_count,
    COUNT(CASE WHEN last_seen > NOW() - INTERVAL '24 hours' THEN 1 END) as active_24h,
    COUNT(CASE WHEN last_seen > NOW() - INTERVAL '7 days' THEN 1 END) as active_7d,
    COUNT(CASE WHEN claw_status = 'online' THEN 1 END) as online_now
FROM members GROUP BY membership_status;
