-- ============================================================
-- STEP 2: 紹介制度テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_tree (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    ref_level1_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
    ref_level2_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
    ref_level3_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
    referral_code TEXT NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT no_self_referral CHECK (
        member_id != ref_level1_id AND
        member_id != ref_level2_id AND
        member_id != ref_level3_id
    )
);

CREATE INDEX IF NOT EXISTS idx_referral_tree_member_id ON referral_tree(member_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_level1 ON referral_tree(ref_level1_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_level2 ON referral_tree(ref_level2_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_level3 ON referral_tree(ref_level3_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_code ON referral_tree(referral_code);

CREATE TABLE IF NOT EXISTS reward_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    referred_member TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    payment_month TEXT NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    tx_hash TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_logs_member_id ON reward_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_reward_logs_referred_member ON reward_logs(referred_member);
CREATE INDEX IF NOT EXISTS idx_reward_logs_status ON reward_logs(status);
CREATE INDEX IF NOT EXISTS idx_reward_logs_payment_month ON reward_logs(payment_month);
CREATE INDEX IF NOT EXISTS idx_reward_logs_level ON reward_logs(level);

DROP TRIGGER IF EXISTS update_reward_logs_updated_at ON reward_logs;
CREATE TRIGGER update_reward_logs_updated_at BEFORE UPDATE
    ON reward_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE referral_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view own referral data" ON referral_tree
    FOR SELECT USING (
        member_id = auth.uid()::text OR
        ref_level1_id = auth.uid()::text OR
        ref_level2_id = auth.uid()::text OR
        ref_level3_id = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can view own rewards" ON reward_logs
    FOR SELECT USING (member_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Master admin full access referral" ON referral_tree
    FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Master admin full access rewards" ON reward_logs
    FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION build_referral_tree(
    new_member_id TEXT,
    used_referral_code TEXT
)
RETURNS VOID AS $$
DECLARE
    level1_member TEXT;
    level2_member TEXT;
    level3_member TEXT;
    current_payment_month TEXT;
BEGIN
    current_payment_month := TO_CHAR(NOW(), 'YYYY-MM');
    SELECT member_id INTO level1_member FROM members WHERE referral_code = used_referral_code AND membership_status = 'active';
    IF level1_member IS NOT NULL THEN
        SELECT ref_level1_id INTO level2_member FROM referral_tree WHERE member_id = level1_member;
        IF level2_member IS NOT NULL THEN
            SELECT ref_level1_id INTO level3_member FROM referral_tree WHERE member_id = level2_member;
        END IF;
        INSERT INTO referral_tree (member_id, ref_level1_id, ref_level2_id, ref_level3_id, referral_code)
        VALUES (new_member_id, level1_member, level2_member, level3_member, used_referral_code);
        INSERT INTO reward_logs (member_id, referred_member, level, amount, payment_month)
        VALUES (level1_member, new_member_id, 1, 200, current_payment_month);
        IF level2_member IS NOT NULL THEN
            INSERT INTO reward_logs (member_id, referred_member, level, amount, payment_month)
            VALUES (level2_member, new_member_id, 2, 50, current_payment_month);
        END IF;
        IF level3_member IS NOT NULL THEN
            INSERT INTO reward_logs (member_id, referred_member, level, amount, payment_month)
            VALUES (level3_member, new_member_id, 3, 50, current_payment_month);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW monthly_reward_summary AS
SELECT member_id, payment_month,
    COUNT(*) as referral_count, SUM(amount) as total_amount,
    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
    SUM(CASE WHEN level = 1 THEN amount ELSE 0 END) as level1_amount,
    SUM(CASE WHEN level = 2 THEN amount ELSE 0 END) as level2_amount,
    SUM(CASE WHEN level = 3 THEN amount ELSE 0 END) as level3_amount
FROM reward_logs GROUP BY member_id, payment_month;

CREATE OR REPLACE VIEW referral_stats AS
SELECT r.ref_level1_id as referrer_id,
    COUNT(DISTINCT r.member_id) as direct_referrals,
    COUNT(DISTINCT r2.member_id) as indirect_level2,
    COUNT(DISTINCT r3.member_id) as indirect_level3,
    COUNT(DISTINCT r.member_id) + COUNT(DISTINCT r2.member_id) + COUNT(DISTINCT r3.member_id) as total_network_size
FROM referral_tree r
LEFT JOIN referral_tree r2 ON r2.ref_level2_id = r.ref_level1_id
LEFT JOIN referral_tree r3 ON r3.ref_level3_id = r.ref_level1_id
WHERE r.ref_level1_id IS NOT NULL
GROUP BY r.ref_level1_id;
