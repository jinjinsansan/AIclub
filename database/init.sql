-- OPEN CLAW データベース初期化スクリプト
-- 実行順序に注意してください

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 実行順序でスキーマを読み込み
\i schemas/01_members.sql
\i schemas/02_referral_system.sql  
\i schemas/03_payment_gateway.sql
\i schemas/04_system_management.sql
\i schemas/05_gateway_studio.sql

-- 初期データ投入完了のログ
SELECT log_system_event(
    'INFO',
    'database-init',
    'schema_initialization',
    'Database schema initialization completed successfully',
    '{"tables_created": ["members", "referral_tree", "reward_logs", "payment_logs", "gateway_messages", "message_receipts", "trade_signals", "system_logs", "seminar_schedules", "manual_contents", "system_config", "notification_templates", "gateway_connections", "claw_chat_logs", "member_claw_config"]}'::jsonb
);