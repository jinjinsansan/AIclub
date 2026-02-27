#!/usr/bin/env node

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { MinaraClient, TradeExecutionResult } from './services/minara-client';
import { GatewayClient, GatewayMessage } from './services/gateway-client';

/**
 * OPEN CLAW メンバーCLAW メインエントリーポイント
 *
 * - config.json をロード
 * - Supabase Realtime (claw_gateway チャネル) に接続
 * - 60秒ごとにハートビートを送信
 * - gateway_messages テーブルの INSERT イベントを購読
 *   (target=eq.all または target=eq.{member_id})
 * - メッセージタイプ別のハンドリング:
 *   trade_signal, update, broadcast, private, reward_notify
 * - 処理結果をレシートとして報告
 */

// ==================== 型定義 ====================

interface MemberClawConfig {
  role: string;
  member_id: string;
  gateway: {
    url: string;
    anon_key: string;
    channel: string;
  };
  minara: {
    api_endpoint: string;
    api_key: string;
    wallet_address: string;
  };
  trade: {
    auto_execute: boolean;
    max_position_size: string;
    stop_loss_pct: number;
    daily_trade_limit: number;
    allowed_pairs: string[];
  };
  heartbeat_interval_sec: number;
}

// ==================== メンバーCLAWアプリケーション ====================

class MemberClawApplication {
  private config!: MemberClawConfig;
  private supabase!: SupabaseClient;
  private realtimeChannel!: RealtimeChannel;
  private minaraClient!: MinaraClient;
  private gatewayClient!: GatewayClient;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;

  constructor() {
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      console.error('[MEMBER-CLAW] Uncaught exception:', error.message);
      console.error(error.stack);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    process.on('unhandledRejection', (reason: any) => {
      console.error('[MEMBER-CLAW] Unhandled rejection:', reason?.message || reason);
    });
  }

  /**
   * アプリケーション起動
   */
  async start(): Promise<void> {
    try {
      console.log('============================================');
      console.log('  OPEN CLAW Member CLAW - Starting...');
      console.log('============================================');

      // 1. 設定ファイルのロード
      this.loadConfig();

      // 2. サービスクライアントの初期化
      this.initializeClients();

      // 3. メンバーシップの確認
      await this.verifyMembership();

      // 4. Supabase Realtime 接続
      await this.connectToGateway();

      // 5. ハートビート開始
      this.startHeartbeat();

      console.log('============================================');
      console.log(`  Member CLAW online: ${this.config.member_id}`);
      console.log(`  Gateway channel: ${this.config.gateway.channel}`);
      console.log(`  Heartbeat interval: ${this.config.heartbeat_interval_sec}s`);
      console.log(`  Trade auto-execute: ${this.config.trade.auto_execute}`);
      console.log(`  Allowed pairs: ${this.config.trade.allowed_pairs.join(', ')}`);
      console.log('============================================');
    } catch (error: any) {
      console.error('[MEMBER-CLAW] Failed to start:', error.message);
      process.exit(1);
    }
  }

  // ==================== 設定ロード ====================

  /**
   * config.json をロードし検証する
   */
  private loadConfig(): void {
    const configPath = path.resolve(process.cwd(), 'config.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(
        'config.json not found. Run "npm run setup" to create it from config.template.json, then fill in your values.'
      );
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    this.config = JSON.parse(raw) as MemberClawConfig;

    // 必須フィールドの検証
    if (!this.config.member_id || this.config.member_id === 'REPLACE_WITH_YOUR_MEMBER_ID') {
      throw new Error('member_id is not configured in config.json');
    }
    if (!this.config.gateway.url || this.config.gateway.url === 'REPLACE_WITH_SUPABASE_URL') {
      throw new Error('gateway.url is not configured in config.json');
    }
    if (!this.config.gateway.anon_key || this.config.gateway.anon_key === 'REPLACE_WITH_SUPABASE_ANON_KEY') {
      throw new Error('gateway.anon_key is not configured in config.json');
    }
    if (!this.config.minara.api_key || this.config.minara.api_key === 'REPLACE_WITH_YOUR_MINARA_API_KEY') {
      throw new Error('minara.api_key is not configured in config.json');
    }
    if (!this.config.minara.wallet_address || this.config.minara.wallet_address === 'REPLACE_WITH_YOUR_WALLET_ADDRESS') {
      throw new Error('minara.wallet_address is not configured in config.json');
    }

    console.log(`[MEMBER-CLAW] Config loaded for member: ${this.config.member_id}`);
  }

  // ==================== クライアント初期化 ====================

  /**
   * Supabase, MINARA, Gateway クライアントの初期化
   */
  private initializeClients(): void {
    // Supabase クライアント
    this.supabase = createClient(this.config.gateway.url, this.config.gateway.anon_key, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    console.log('[MEMBER-CLAW] Supabase client initialized');

    // MINARA クライアント
    this.minaraClient = new MinaraClient(this.config.minara, this.config.trade);
    console.log('[MEMBER-CLAW] MINARA client initialized');

    // Gateway クライアント
    this.gatewayClient = new GatewayClient(this.config.gateway, this.config.member_id);
    console.log('[MEMBER-CLAW] Gateway client initialized');
  }

  // ==================== メンバーシップ確認 ====================

  /**
   * ゲートウェイでメンバー登録状態を確認する
   */
  private async verifyMembership(): Promise<void> {
    console.log('[MEMBER-CLAW] Verifying membership...');

    const membership = await this.gatewayClient.verifyMembership();

    if (!membership.registered) {
      console.warn('[MEMBER-CLAW] WARNING: Member not registered in gateway. Messages may not be received.');
      console.warn('[MEMBER-CLAW] Contact the operator to complete registration.');
    } else {
      console.log(`[MEMBER-CLAW] Membership verified: status=${membership.status}, tier=${membership.tier}`);
      if (membership.status === 'suspended') {
        throw new Error('Member account is suspended. Contact the operator.');
      }
    }
  }

  // ==================== Gateway 接続 ====================

  /**
   * Supabase Realtime チャネルに接続し、gateway_messages テーブルの
   * INSERT イベントを購読する。
   * フィルタ: target=eq.all OR target=eq.{member_id}
   */
  private async connectToGateway(): Promise<void> {
    console.log(`[MEMBER-CLAW] Connecting to gateway channel: ${this.config.gateway.channel}`);

    this.realtimeChannel = this.supabase
      .channel(this.config.gateway.channel)
      // target=all のメッセージを購読（全メンバー向けブロードキャスト）
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gateway_messages',
          filter: 'target=eq.all',
        },
        (payload) => {
          this.handleIncomingMessage(payload.new as GatewayMessage);
        }
      )
      // target={member_id} のメッセージを購読（自分宛のメッセージ）
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gateway_messages',
          filter: `target=eq.${this.config.member_id}`,
        },
        (payload) => {
          this.handleIncomingMessage(payload.new as GatewayMessage);
        }
      )
      .subscribe((status) => {
        console.log(`[MEMBER-CLAW] Realtime subscription status: ${status}`);

        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('[MEMBER-CLAW] Successfully subscribed to gateway channel');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          console.error(`[MEMBER-CLAW] Gateway connection lost: ${status}`);
          this.attemptReconnect();
        }
      });
  }

  /**
   * 接続が切れた場合の再接続ロジック
   */
  private async attemptReconnect(): Promise<void> {
    if (this.isShuttingDown) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('[MEMBER-CLAW] Max reconnect attempts reached. Shutting down.');
      await this.gracefulShutdown('RECONNECT_FAILED');
      return;
    }

    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    console.log(
      `[MEMBER-CLAW] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.isShuttingDown) return;

    try {
      // 既存チャネルを解除
      await this.supabase.removeChannel(this.realtimeChannel);

      // 再接続
      await this.connectToGateway();

      // 切断中に届いたメッセージをポーリングで取得
      console.log('[MEMBER-CLAW] Fetching missed messages...');
      const missedMessages = await this.gatewayClient.fetchMessages();
      for (const msg of missedMessages) {
        await this.handleIncomingMessage(msg);
      }
    } catch (error: any) {
      console.error('[MEMBER-CLAW] Reconnect failed:', error.message);
      this.attemptReconnect();
    }
  }

  // ==================== ハートビート ====================

  /**
   * 定期的にハートビートを送信するタイマーを開始する
   */
  private startHeartbeat(): void {
    const intervalMs = this.config.heartbeat_interval_sec * 1000;

    // 初回は即座に送信
    this.sendHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);

    console.log(`[MEMBER-CLAW] Heartbeat started (every ${this.config.heartbeat_interval_sec}s)`);
  }

  /**
   * ハートビートを送信
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const result = await this.gatewayClient.sendHeartbeat(
        this.isConnected ? 'online' : 'idle'
      );

      if (result) {
        console.log(
          `[MEMBER-CLAW] Heartbeat sent. Server time: ${result.server_time}, Uptime: ${this.gatewayClient.getUptimeSeconds()}s`
        );
      } else {
        console.warn('[MEMBER-CLAW] Heartbeat response was null');
      }
    } catch (error: any) {
      console.error('[MEMBER-CLAW] Heartbeat error:', error.message);
    }
  }

  // ==================== メッセージハンドリング ====================

  /**
   * 受信メッセージの振り分け処理
   */
  private async handleIncomingMessage(message: GatewayMessage): Promise<void> {
    console.log(
      `[MEMBER-CLAW] Message received: type=${message.message_type}, id=${message.id}, target=${message.target}`
    );

    try {
      switch (message.message_type) {
        case 'trade_signal':
          await this.handleTradeSignal(message);
          break;

        case 'update':
          await this.handleUpdate(message);
          break;

        case 'broadcast':
          await this.handleBroadcast(message);
          break;

        case 'private':
          await this.handlePrivateMessage(message);
          break;

        case 'reward_notify':
          await this.handleRewardNotify(message);
          break;

        default:
          console.warn(`[MEMBER-CLAW] Unknown message type: ${message.message_type}`);
          await this.gatewayClient.sendReceipt(
            message.id,
            message.message_type,
            'skipped',
            undefined,
            `Unknown message type: ${message.message_type}`
          );
      }
    } catch (error: any) {
      console.error(`[MEMBER-CLAW] Error handling message ${message.id}:`, error.message);
      await this.gatewayClient.sendReceipt(
        message.id,
        message.message_type,
        'failed',
        undefined,
        error.message
      );
    }
  }

  /**
   * trade_signal ハンドラ
   *
   * Master CLAW からトレードシグナルを受信し、MINARA API に
   * 自然言語でトレード指示を送信する。
   */
  private async handleTradeSignal(message: GatewayMessage): Promise<void> {
    const payload = message.payload;
    const naturalLanguage: string = payload.natural_language || payload.instruction || '';
    const signalId: string = payload.signal_id || message.id;

    console.log(`[MEMBER-CLAW] Trade signal received: "${naturalLanguage}"`);

    if (!naturalLanguage) {
      console.error('[MEMBER-CLAW] Trade signal has no natural_language instruction');
      await this.gatewayClient.sendReceipt(
        message.id,
        message.message_type,
        'failed',
        undefined,
        'No natural_language instruction in trade signal'
      );
      return;
    }

    // 自動実行が無効の場合はスキップ
    if (!this.config.trade.auto_execute) {
      console.log('[MEMBER-CLAW] Auto-execute is disabled. Skipping trade signal.');
      await this.gatewayClient.sendReceipt(
        message.id,
        message.message_type,
        'skipped',
        { reason: 'auto_execute disabled' }
      );
      return;
    }

    // MINARA API に自然言語トレードを実行
    const result: TradeExecutionResult = await this.minaraClient.executeNaturalLanguageTrade(
      naturalLanguage,
      signalId
    );

    if (result.success) {
      console.log(
        `[MEMBER-CLAW] Trade executed: trade_id=${result.trade_id}, pair=${result.pair}, side=${result.side}, price=${result.price}`
      );
      await this.gatewayClient.sendReceipt(message.id, message.message_type, 'executed', {
        trade_id: result.trade_id,
        pair: result.pair,
        side: result.side,
        amount: result.amount,
        price: result.price,
        status: result.status,
      });
    } else {
      console.error(`[MEMBER-CLAW] Trade failed: ${result.error}`);
      await this.gatewayClient.sendReceipt(
        message.id,
        message.message_type,
        'failed',
        undefined,
        result.error
      );
    }
  }

  /**
   * update ハンドラ
   *
   * システムアップデート通知を処理する。設定変更やバージョンアップデートなど。
   */
  private async handleUpdate(message: GatewayMessage): Promise<void> {
    const payload = message.payload;
    console.log('[MEMBER-CLAW] Update notification received:', JSON.stringify(payload, null, 2));

    // 設定更新の処理
    if (payload.config_update) {
      console.log('[MEMBER-CLAW] Configuration update received');

      // トレード設定の動的更新
      if (payload.config_update.trade) {
        const tradeUpdate = payload.config_update.trade;
        if (tradeUpdate.allowed_pairs) {
          this.config.trade.allowed_pairs = tradeUpdate.allowed_pairs;
          console.log(`[MEMBER-CLAW] Allowed pairs updated: ${tradeUpdate.allowed_pairs.join(', ')}`);
        }
        if (tradeUpdate.daily_trade_limit !== undefined) {
          this.config.trade.daily_trade_limit = tradeUpdate.daily_trade_limit;
          console.log(`[MEMBER-CLAW] Daily trade limit updated: ${tradeUpdate.daily_trade_limit}`);
        }
        if (tradeUpdate.max_position_size) {
          this.config.trade.max_position_size = tradeUpdate.max_position_size;
          console.log(`[MEMBER-CLAW] Max position size updated: ${tradeUpdate.max_position_size}`);
        }
        if (tradeUpdate.stop_loss_pct !== undefined) {
          this.config.trade.stop_loss_pct = tradeUpdate.stop_loss_pct;
          console.log(`[MEMBER-CLAW] Stop loss updated: ${tradeUpdate.stop_loss_pct}%`);
        }
      }

      // バージョンアップデート通知
      if (payload.new_version) {
        console.log(`[MEMBER-CLAW] New version available: ${payload.new_version}`);
        console.log(`[MEMBER-CLAW] Update URL: ${payload.update_url || 'N/A'}`);
      }
    }

    await this.gatewayClient.sendReceipt(message.id, message.message_type, 'received', {
      acknowledged: true,
    });
  }

  /**
   * broadcast ハンドラ
   *
   * 全メンバーへのブロードキャストメッセージを処理する。
   * お知らせやシステム通知など。
   */
  private async handleBroadcast(message: GatewayMessage): Promise<void> {
    const payload = message.payload;
    console.log('============================================');
    console.log('  BROADCAST MESSAGE');
    console.log(`  From: ${message.sender}`);
    console.log(`  Time: ${message.created_at}`);
    console.log(`  Subject: ${payload.subject || 'N/A'}`);
    console.log(`  Body: ${payload.body || payload.message || JSON.stringify(payload)}`);
    console.log('============================================');

    await this.gatewayClient.sendReceipt(message.id, message.message_type, 'received', {
      acknowledged: true,
    });
  }

  /**
   * private ハンドラ
   *
   * 特定メンバー宛のプライベートメッセージを処理する。
   * オペレーターからの直接メッセージなど。
   */
  private async handlePrivateMessage(message: GatewayMessage): Promise<void> {
    const payload = message.payload;
    console.log('============================================');
    console.log('  PRIVATE MESSAGE');
    console.log(`  From: ${message.sender}`);
    console.log(`  Time: ${message.created_at}`);
    console.log(`  Subject: ${payload.subject || 'N/A'}`);
    console.log(`  Body: ${payload.body || payload.message || JSON.stringify(payload)}`);
    if (payload.action_required) {
      console.log(`  ACTION REQUIRED: ${payload.action_required}`);
    }
    console.log('============================================');

    await this.gatewayClient.sendReceipt(message.id, message.message_type, 'received', {
      acknowledged: true,
    });
  }

  /**
   * reward_notify ハンドラ
   *
   * 報酬通知を処理する。紹介報酬やトレード報酬の着金通知。
   */
  private async handleRewardNotify(message: GatewayMessage): Promise<void> {
    const payload = message.payload;
    console.log('============================================');
    console.log('  REWARD NOTIFICATION');
    console.log(`  Type: ${payload.reward_type || 'N/A'}`);
    console.log(`  Amount: ${payload.amount || 'N/A'} ${payload.currency || 'USD'}`);
    console.log(`  TX Hash: ${payload.tx_hash || 'N/A'}`);
    console.log(`  Description: ${payload.description || 'N/A'}`);
    console.log(`  Time: ${message.created_at}`);
    console.log('============================================');

    // ウォレット残高を確認
    const balance = await this.minaraClient.getWalletBalance();
    if (balance) {
      console.log(
        `[MEMBER-CLAW] Current wallet balance: ${balance.available} ${balance.currency} (total: ${balance.balance}, locked: ${balance.locked})`
      );
    }

    await this.gatewayClient.sendReceipt(message.id, message.message_type, 'received', {
      acknowledged: true,
      balance_checked: balance !== null,
    });
  }

  // ==================== シャットダウン ====================

  /**
   * グレースフルシャットダウン
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('[MEMBER-CLAW] Force shutdown');
      process.exit(1);
    }

    this.isShuttingDown = true;
    console.log(`[MEMBER-CLAW] Received ${signal}, shutting down gracefully...`);

    // ハートビートタイマーの停止
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[MEMBER-CLAW] Heartbeat stopped');
    }

    // Realtime チャネルの解除
    if (this.realtimeChannel) {
      try {
        await this.supabase.removeChannel(this.realtimeChannel);
        console.log('[MEMBER-CLAW] Realtime channel unsubscribed');
      } catch (error: any) {
        console.error('[MEMBER-CLAW] Error unsubscribing channel:', error.message);
      }
    }

    // 最後のハートビート（offline状態）を送信
    if (this.gatewayClient) {
      try {
        await this.gatewayClient.sendHeartbeat('idle');
        console.log('[MEMBER-CLAW] Final heartbeat sent (idle)');
      } catch {
        // シャットダウン中のエラーは無視
      }
    }

    console.log('[MEMBER-CLAW] Shutdown complete');
    process.exit(0);
  }
}

// ==================== メイン実行 ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start':
    case undefined: {
      const app = new MemberClawApplication();
      await app.start();
      break;
    }

    case 'version':
      console.log('OPEN CLAW Member CLAW v1.0.0');
      break;

    case 'check-config': {
      const configPath = path.resolve(process.cwd(), 'config.json');
      if (!fs.existsSync(configPath)) {
        console.error('config.json not found. Run "npm run setup" first.');
        process.exit(1);
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      console.log('Configuration:');
      console.log(`  Role: ${config.role}`);
      console.log(`  Member ID: ${config.member_id}`);
      console.log(`  Gateway URL: ${config.gateway?.url}`);
      console.log(`  Gateway Channel: ${config.gateway?.channel}`);
      console.log(`  MINARA Endpoint: ${config.minara?.api_endpoint}`);
      console.log(`  Auto Execute: ${config.trade?.auto_execute}`);
      console.log(`  Allowed Pairs: ${config.trade?.allowed_pairs?.join(', ')}`);
      console.log(`  Heartbeat Interval: ${config.heartbeat_interval_sec}s`);
      break;
    }

    case 'test-minara': {
      const configPath = path.resolve(process.cwd(), 'config.json');
      if (!fs.existsSync(configPath)) {
        console.error('config.json not found.');
        process.exit(1);
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      const minara = new MinaraClient(config.minara, config.trade);
      const healthy = await minara.healthCheck();
      console.log(`MINARA API connection: ${healthy ? 'OK' : 'FAILED'}`);
      process.exit(healthy ? 0 : 1);
    }

    case 'test-gateway': {
      const configPath = path.resolve(process.cwd(), 'config.json');
      if (!fs.existsSync(configPath)) {
        console.error('config.json not found.');
        process.exit(1);
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      const gateway = new GatewayClient(config.gateway, config.member_id);
      const membership = await gateway.verifyMembership();
      console.log(`Gateway connection: ${membership.registered ? 'OK' : 'NOT REGISTERED'}`);
      if (membership.registered) {
        console.log(`  Status: ${membership.status}`);
        console.log(`  Tier: ${membership.tier}`);
      }
      process.exit(membership.registered ? 0 : 1);
    }

    case 'help':
      console.log('OPEN CLAW Member CLAW Commands:');
      console.log('  start (default)   - Start the Member CLAW system');
      console.log('  version           - Show version information');
      console.log('  check-config      - Display current configuration');
      console.log('  test-minara       - Test MINARA API connection');
      console.log('  test-gateway      - Test gateway connection');
      console.log('  help              - Show this help message');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Use "help" to see available commands');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
