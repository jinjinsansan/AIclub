-- ============================================================
-- STEP 4: システム管理テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_level TEXT NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
    component TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seminar_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    zoom_url TEXT,
    zoom_password TEXT,
    max_participants INTEGER,
    registration_required BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed', 'in_progress')),
    created_by TEXT NOT NULL DEFAULT 'master_001',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seminar_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seminar_id UUID NOT NULL REFERENCES seminar_schedules(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attended BOOLEAN DEFAULT false,
    attendance_duration_minutes INTEGER DEFAULT 0,
    UNIQUE(seminar_id, member_id)
);

CREATE TABLE IF NOT EXISTS manual_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manual_code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'pdf', 'markdown', 'zip', 'config')),
    file_url TEXT,
    file_size_bytes BIGINT,
    access_level TEXT DEFAULT 'active' CHECK (access_level IN ('all', 'active', 'premium', 'master')),
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    version TEXT DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    is_sensitive BOOLEAN DEFAULT false,
    updated_by TEXT DEFAULT 'system',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'line', 'web', 'claw_message')),
    subject TEXT,
    content TEXT NOT NULL,
    variables JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    variables_used JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    external_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_member_id ON system_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_seminar_schedules_scheduled_at ON seminar_schedules(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_seminar_schedules_status ON seminar_schedules(status);
CREATE INDEX IF NOT EXISTS idx_manual_contents_manual_code ON manual_contents(manual_code);
CREATE INDEX IF NOT EXISTS idx_manual_contents_access_level ON manual_contents(access_level);
CREATE INDEX IF NOT EXISTS idx_manual_contents_order_index ON manual_contents(order_index);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON notification_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

DROP TRIGGER IF EXISTS update_seminar_schedules_updated_at ON seminar_schedules;
CREATE TRIGGER update_seminar_schedules_updated_at BEFORE UPDATE
    ON seminar_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_manual_contents_updated_at ON manual_contents;
CREATE TRIGGER update_manual_contents_updated_at BEFORE UPDATE
    ON manual_contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE
    ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seminar_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE seminar_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "Master admin only system logs" ON system_logs FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Active members can view seminars" ON seminar_schedules FOR SELECT USING (EXISTS (SELECT 1 FROM members WHERE member_id = auth.uid()::text AND membership_status = 'active')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own seminar participation" ON seminar_participants FOR SELECT USING (member_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Manual access by level" ON manual_contents FOR SELECT USING (is_published = true AND (access_level = 'all' OR (access_level = 'active' AND EXISTS (SELECT 1 FROM members WHERE member_id = auth.uid()::text AND membership_status = 'active')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Master admin only system config" ON system_config FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Master admin only notification templates" ON notification_templates FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can view own notifications" ON notification_logs FOR SELECT USING (recipient = auth.uid()::text OR recipient = (SELECT email FROM members WHERE member_id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Master admin full access seminars" ON seminar_schedules FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Master admin full access participation" ON seminar_participants FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Master admin full access manuals" ON manual_contents FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Master admin full access notification logs" ON notification_logs FOR ALL USING (auth.uid()::text = 'master_001'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO system_config (key, value, description, category) VALUES
('payment.initial_fee_usd', '700', '初期登録費用（USD）', 'payment'),
('payment.operator_share_usd', '400', '運営取り分（USD）', 'payment'),
('payment.referral_level1_usd', '200', '1段目紹介報酬（USD）', 'payment'),
('payment.referral_level2_usd', '50', '2段目紹介報酬（USD）', 'payment'),
('payment.referral_level3_usd', '50', '3段目紹介報酬（USD）', 'payment'),
('notification.reminder_days_before', '5', '支払いリマインダーの事前通知日数', 'notification'),
('system.maintenance_mode', 'false', 'メンテナンスモード', 'system'),
('trade.auto_execute_default', 'true', 'トレードシグナル自動実行のデフォルト設定', 'trade'),
('seminar.default_duration_minutes', '60', 'セミナーのデフォルト時間（分）', 'seminar')
ON CONFLICT (key) DO NOTHING;

INSERT INTO notification_templates (template_key, channel, subject, content, variables) VALUES
('welcome_payment_confirmed', 'email', 'OPEN CLAW - ご入金ありがとうございます',
 'こんにちは、{{display_name}}さん。初期費用 ${{amount}} の入金を確認いたしました。',
 '{"display_name": "会員表示名", "amount": "入金額"}'),
('monthly_fee_reminder', 'email', 'OPEN CLAW - 月額会費のお支払いリマインダー',
 'こんにちは、{{display_name}}さん。月額会費の期限が{{days_remaining}}日後に迫っています。',
 '{"display_name": "会員表示名", "days_remaining": "残り日数"}'),
('reward_payment_notification', 'line', '',
 '【OPEN CLAW 月次報酬】今月の紹介報酬を送金しました。受取額: ${{amount}}',
 '{"amount": "報酬額"}'),
('new_member_joined', 'line', '',
 '【OPEN CLAW】新メンバー参加！{{display_name}}さんがコミュニティに参加しました。',
 '{"display_name": "新メンバー名"}')
ON CONFLICT (template_key) DO NOTHING;

CREATE OR REPLACE FUNCTION log_system_event(
    p_log_level TEXT, p_component TEXT, p_event_type TEXT, p_message TEXT,
    p_details JSONB DEFAULT NULL, p_member_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO system_logs (log_level, component, event_type, message, details, member_id)
    VALUES (p_log_level, p_component, p_event_type, p_message, p_details, p_member_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
