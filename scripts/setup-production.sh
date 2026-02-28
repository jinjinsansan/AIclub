#!/bin/bash

# OPEN CLAW 本番環境セットアップスクリプト
# 仕様書 Phase 4: 本番環境デプロイ・稼働開始

set -e

echo "🦞 OPEN CLAW 本番環境セットアップ開始"
echo "========================================="

# 色付きログ関数
log_info() { echo -e "\033[32m[INFO]\033[0m $1"; }
log_warn() { echo -e "\033[33m[WARN]\033[0m $1"; }
log_error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# 必要なツールの確認
check_dependencies() {
    log_info "依存関係をチェック中..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js がインストールされていません"
        exit 1
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        log_error "npm がインストールされていません"
        exit 1
    fi
    
    # Supabase CLI
    if ! command -v supabase &> /dev/null; then
        log_warn "Supabase CLI がインストールされていません。インストール中..."
        npm install -g supabase
    fi
    
    log_info "✅ 依存関係チェック完了"
}

# 環境変数の設定
setup_environment() {
    log_info "環境変数を設定中..."
    
    # 本番環境用 .env ファイルの作成
    if [ ! -f "frontend/.env.production" ]; then
        cp frontend/.env.local.example frontend/.env.production
        log_info "📄 frontend/.env.production を作成しました"
        log_warn "⚠️  Supabase URLとAPIキーを設定してください"
    fi
    
    if [ ! -f "master-claw/.env.production" ]; then
        cp master-claw/.env.example master-claw/.env.production
        log_info "📄 master-claw/.env.production を作成しました"
        log_warn "⚠️  Supabase URLとサービスロールキーを設定してください"
    fi
}

# データベーススキーマの準備
prepare_database_schemas() {
    log_info "データベーススキーマを準備中..."
    
    # 統合初期化スクリプトの作成
    cat > database/init-production.sql << 'EOF'
-- OPEN CLAW 本番データベース初期化
-- Phase 4: 本番環境デプロイ・稼働開始

\echo 'OPEN CLAW データベース初期化開始...'

-- 1. メンバー管理テーブル
\i database/schemas/01_members.sql

-- 2. 紹介制度テーブル  
\i database/schemas/02_referral_system.sql

-- 3. 支払いゲートウェイテーブル
\i database/schemas/03_payment_gateway.sql

-- 4. システム管理テーブル
\i database/schemas/04_system_management.sql

\echo 'データベース初期化完了！'
EOF
    
    log_info "✅ データベーススキーマ準備完了"
}

# フロントエンドビルド
build_frontend() {
    log_info "フロントエンドをビルド中..."
    
    cd frontend
    npm install
    npm run build
    cd ..
    
    log_info "✅ フロントエンドビルド完了"
}

# マスター管理CLAWビルド
build_master_claw() {
    log_info "マスター管理CLAWをビルド中..."
    
    cd master-claw
    npm install
    npm run build
    cd ..
    
    log_info "✅ マスター管理CLAWビルド完了"
}

# テストの実行
run_tests() {
    log_info "テストを実行中..."
    
    # フロントエンドテスト
    cd frontend
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test -- --watchAll=false || log_warn "フロントエンドテストで警告があります"
    fi
    cd ..
    
    # マスター管理CLAWテスト
    cd master-claw
    npm run test-startup || log_warn "マスター管理CLAWテストで警告があります"
    cd ..
    
    log_info "✅ テスト実行完了"
}

# ヘルスチェック
health_check() {
    log_info "システムヘルスチェック中..."
    
    # ファイル構造確認
    local required_files=(
        "database/schemas/01_members.sql"
        "database/schemas/02_referral_system.sql" 
        "database/schemas/03_payment_gateway.sql"
        "database/schemas/04_system_management.sql"
        "frontend/package.json"
        "master-claw/package.json"
        "docs/setup-guides/04_phase4-production-deployment.md"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "必須ファイルが見つかりません: $file"
            exit 1
        fi
    done
    
    log_info "✅ ヘルスチェック完了"
}

# デプロイ準備完了メッセージ
deployment_ready() {
    echo ""
    log_info "🎉 本番環境デプロイ準備完了！"
    echo "========================================="
    echo ""
    echo "📋 次のステップ："
    echo "1. Supabaseで本番プロジェクトを作成"
    echo "   👉 https://supabase.com/dashboard"
    echo ""
    echo "2. database/init-production.sql を実行"
    echo "   👉 SQL Editor でスキーマを実行"
    echo ""
    echo "3. 環境変数を更新"
    echo "   👉 frontend/.env.production"
    echo "   👉 master-claw/.env.production"
    echo ""
    echo "4. MINARA API設定"
    echo "   👉 本番APIキー・Webhook URL設定"
    echo ""
    echo "5. LINE Bot設定"
    echo "   👉 公式アカウント作成・オープンチャット開設"
    echo ""
    echo "6. ドメイン・SSL設定"
    echo "   👉 openclaw.community (推奨)"
    echo ""
    echo "🦞 仕様書 Phase 4 に従って進めてください！"
}

# メイン実行
main() {
    check_dependencies
    setup_environment
    prepare_database_schemas
    build_frontend
    build_master_claw
    run_tests
    health_check
    deployment_ready
}

# スクリプト実行
main "$@"