-- OPEN CLAW: 会員情報テーブル
-- 会員の基本情報、ステータス、支払い情報を管理

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 会員テーブル
CREATE TABLE members (
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

-- インデックス作成
CREATE INDEX idx_members_member_id ON members(member_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_referral_code ON members(referral_code);
CREATE INDEX idx_members_membership_status ON members(membership_status);
CREATE INDEX idx_members_referred_by_code ON members(referred_by_code);

-- 更新時刻自動更新のトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_members_updated_at BEFORE UPDATE
    ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 有効化
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 自分のデータのみ閲覧可能
CREATE POLICY "Users can view own data" ON members
    FOR SELECT USING (member_id = auth.uid()::text);

-- 自分のデータのみ更新可能
CREATE POLICY "Users can update own data" ON members
    FOR UPDATE USING (member_id = auth.uid()::text);

-- 管理者は全データにアクセス可能
CREATE POLICY "Master admin full access" ON members
    FOR ALL USING (auth.uid()::text = 'master_001');

-- 会員ID生成関数
CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    exists_count INTEGER;
BEGIN
    LOOP
        -- CLAW + 4桁ランダム数字
        new_id := 'CLAW' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        
        SELECT COUNT(*) INTO exists_count
        FROM members WHERE member_id = new_id;
        
        EXIT WHEN exists_count = 0;
    END LOOP;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- 紹介コード生成関数
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
        
        SELECT COUNT(*) INTO exists_count
        FROM members WHERE referral_code = result;
        
        EXIT WHEN exists_count = 0;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 会員登録時の自動処理トリガー
CREATE OR REPLACE FUNCTION handle_new_member()
RETURNS TRIGGER AS $$
BEGIN
    -- member_id が空の場合、自動生成
    IF NEW.member_id IS NULL THEN
        NEW.member_id := generate_member_id();
    END IF;
    
    -- membership_status が active になった時、紹介コードを自動生成
    IF NEW.membership_status = 'active' AND NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_new_member
    BEFORE INSERT OR UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION handle_new_member();

-- 初期データ（マスター管理者）
INSERT INTO members (
    member_id,
    display_name,
    email,
    plan,
    membership_status,
    referral_code
) VALUES (
    'master_001',
    'マスター管理者',
    'master@openclaw.com',
    'master',
    'active',
    'MASTER01'
) ON CONFLICT DO NOTHING;