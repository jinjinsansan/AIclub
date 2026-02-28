import axios, { AxiosInstance } from 'axios';

/**
 * Gateway API クライアント
 *
 * メンバーCLAWから Master CLAW ゲートウェイへの通信を行うクライアント。
 * ハートビート送信、メッセージ取得、レシート報告を担当する。
 */

export interface GatewayConfig {
  url: string;
  anon_key: string;
  channel: string;
}

export interface HeartbeatPayload {
  member_id: string;
  status: 'online' | 'idle' | 'trading';
  timestamp: string;
  version: string;
  uptime_sec: number;
}

export interface HeartbeatResponse {
  success: boolean;
  server_time: string;
  next_heartbeat_sec: number;
}

export interface GatewayMessage {
  id: string;
  message_type: 'trade_signal' | 'update' | 'broadcast' | 'private' | 'reward_notify';
  target: string;
  payload: any;
  created_at: string;
  sender: string;
}

export interface ReceiptPayload {
  member_id: string;
  message_id: string;
  message_type: string;
  status: 'received' | 'executed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  processed_at: string;
}

export interface ReceiptResponse {
  success: boolean;
  receipt_id: string;
}

export class GatewayClient {
  private client: AxiosInstance;
  private memberId: string;
  private startTime: number;

  constructor(gatewayConfig: GatewayConfig, memberId: string) {
    this.memberId = memberId;
    this.startTime = Date.now();

    this.client = axios.create({
      baseURL: gatewayConfig.url,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'apikey': gatewayConfig.anon_key,
        'Authorization': `Bearer ${gatewayConfig.anon_key}`,
        'User-Agent': 'OPENCLAW-Member/1.0.0',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        console.log(`[GATEWAY] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[GATEWAY] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[GATEWAY] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        console.error(`[GATEWAY] Response error: ${status} - ${message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * ハートビート送信
   *
   * 定期的にマスターCLAWに自分のオンライン状態を通知する。
   * POST /api/members/heartbeat
   */
  async sendHeartbeat(status: 'online' | 'idle' | 'trading' = 'online'): Promise<HeartbeatResponse | null> {
    try {
      const payload: HeartbeatPayload = {
        member_id: this.memberId,
        status,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime_sec: Math.floor((Date.now() - this.startTime) / 1000),
      };

      const response = await this.client.post('/api/members/heartbeat', payload);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Heartbeat failed');
      }

      return response.data as HeartbeatResponse;
    } catch (error: any) {
      console.error('[GATEWAY] Heartbeat failed:', error.message);
      return null;
    }
  }

  /**
   * 未読メッセージの取得
   *
   * ポーリングフォールバック用。通常は Supabase Realtime で受信するが、
   * 接続が切れた場合にこのメソッドで未読メッセージを取得する。
   * GET /api/gateway/messages?member_id={member_id}&since={timestamp}
   */
  async fetchMessages(since?: string): Promise<GatewayMessage[]> {
    try {
      const params: Record<string, string> = {
        member_id: this.memberId,
      };
      if (since) {
        params.since = since;
      }

      const response = await this.client.get('/api/gateway/messages', { params });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to fetch messages');
      }

      return (response.data.data || []) as GatewayMessage[];
    } catch (error: any) {
      console.error('[GATEWAY] Failed to fetch messages:', error.message);
      return [];
    }
  }

  /**
   * レシート報告
   *
   * メッセージの処理結果をマスターCLAWに報告する。
   * POST /api/gateway/receipt
   */
  async sendReceipt(
    messageId: string,
    messageType: string,
    status: 'received' | 'executed' | 'failed' | 'skipped',
    result?: any,
    error?: string
  ): Promise<ReceiptResponse | null> {
    try {
      const payload: ReceiptPayload = {
        member_id: this.memberId,
        message_id: messageId,
        message_type: messageType,
        status,
        result,
        error,
        processed_at: new Date().toISOString(),
      };

      const response = await this.client.post('/api/gateway/receipt', payload);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Receipt submission failed');
      }

      return response.data as ReceiptResponse;
    } catch (error: any) {
      console.error('[GATEWAY] Failed to send receipt:', error.message);
      return null;
    }
  }

  /**
   * メンバー登録確認
   *
   * メンバーIDがゲートウェイに登録されているか確認する。
   * GET /api/members/{member_id}/status
   */
  async verifyMembership(): Promise<{
    registered: boolean;
    status?: 'active' | 'suspended' | 'pending';
    tier?: string;
  }> {
    try {
      const response = await this.client.get(`/api/members/${this.memberId}/status`);

      if (!response.data.success) {
        return { registered: false };
      }

      return {
        registered: true,
        status: response.data.data.status,
        tier: response.data.data.tier,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { registered: false };
      }
      console.error('[GATEWAY] Failed to verify membership:', error.message);
      return { registered: false };
    }
  }

  /**
   * 現在のアップタイム秒数を返す
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
