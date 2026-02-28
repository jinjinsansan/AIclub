-- ============================================================
-- OPEN CLAW 全データベーススキーマ
-- Supabase SQL Editor で実行してください
-- ステップ1〜5を順番に実行してください
-- ============================================================

-- ============================================================
-- STEP 1: 会員テーブル (01_members.sql)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'standard',
    membership_status TEXT DEFAULT 'pending_payment' CHECK (
        membership_status IN ('pending_payment', 'active', 'suspended', 'expired')
    ),
    minara_wallet TEXT,
    referral_code TEXT UNIQUE,
    referred_by_code TEXT,
    claw_status TEXT DEFAULT 'offline' CHECK (
        claw_status IN ('online', 'offline', 'error')
    ),
    last_seen TIMESTAMP WITH TIME ZONE,
    fee_paid_until DATE,
    monthly_reward_pending NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_member_id ON members(member_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);
CREATE INDEX IF NOT EXISTS idx_members_membership_status ON members(membership_status);
CREATE INDEX IF NOT EXISTS idx_members_referred_by_code ON members(referred_by_code);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE
    ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Users can view own data" ON members
    FOR SELECT USING (member_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Users can update own data" ON members
    FOR UPDATE USING (member_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "Master admin full access" ON members
    FOR ALL USING (auth.uid()::text = 'master_001');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    exists_count INTEGER;
BEGIN
    LOOP
        new_id := 'CLAW' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        SELECT COUNT(*) INTO exists_count FROM members WHERE member_id = new_id;
        EXIT WHEN exists_count = 0;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
    exists_count INTEGER;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..8 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        SELECT COUNT(*) INTO exists_count FROM members WHERE referral_code = result;
        EXIT WHEN exists_count = 0;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_member()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.member_id IS NULL THEN
        NEW.member_id := generate_member_id();
    END IF;
    IF NEW.membership_status = 'active' AND NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_new_member ON members;
CREATE TRIGGER trigger_handle_new_member
    BEFORE INSERT OR UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION handle_new_member();

INSERT INTO members (member_id, display_name, email, plan, membership_status, referral_code)
VALUES ('master_001', 'マスター管理者', 'master@openclaw.com', 'master', 'active', 'MASTER01')
ON CONFLICT DO NOTHING;
