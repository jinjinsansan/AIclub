import axios, { AxiosInstance } from 'axios';

/**
 * MINARA API クライアント
 *
 * メンバーCLAWから MINARA API へ自然言語トレード指示を送信し、
 * トレード実行結果を取得するクライアント。
 */

export interface MinaraConfig {
  api_endpoint: string;
  api_key: string;
  wallet_address: string;
}

export interface TradeConfig {
  auto_execute: boolean;
  max_position_size: string;
  stop_loss_pct: number;
  daily_trade_limit: number;
  allowed_pairs: string[];
}

export interface TradeExecutionResult {
  success: boolean;
  trade_id?: string;
  pair?: string;
  side?: 'buy' | 'sell';
  amount?: number;
  price?: number;
  status?: 'executed' | 'pending' | 'rejected';
  error?: string;
  timestamp?: string;
}

export interface WalletBalanceResult {
  balance: number;
  currency: string;
  available: number;
  locked: number;
}

export class MinaraClient {
  private client: AxiosInstance;
  private walletAddress: string;
  private tradeConfig: TradeConfig;
  private dailyTradeCount: number = 0;
  private lastTradeDate: string = '';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(minaraConfig: MinaraConfig, tradeConfig: TradeConfig) {
    this.walletAddress = minaraConfig.wallet_address;
    this.tradeConfig = tradeConfig;

    this.client = axios.create({
      baseURL: minaraConfig.api_endpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${minaraConfig.api_key}`,
        'User-Agent': 'OPENCLAW-Member/1.0.0',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        console.log(`[MINARA] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[MINARA] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[MINARA] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('[MINARA] Response error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * 自然言語トレードの実行
   *
   * Master CLAWから受信したトレードシグナル（自然言語）を MINARA API に送信して
   * トレードを実行する。ポジションサイズ、ストップロス、デイリーリミットなどの
   * トレード設定を適用する。
   */
  async executeNaturalLanguageTrade(
    naturalLanguage: string,
    signalId?: string
  ): Promise<TradeExecutionResult> {
    try {
      // デイリートレードリミットのチェック
      this.resetDailyCountIfNeeded();
      if (this.dailyTradeCount >= this.tradeConfig.daily_trade_limit) {
        return {
          success: false,
          error: `Daily trade limit reached (${this.tradeConfig.daily_trade_limit}). Trade rejected.`,
        };
      }

      // ペアのバリデーション（自然言語からペアを抽出して検証）
      const pairValidation = this.validatePairFromInstruction(naturalLanguage);
      if (!pairValidation.valid) {
        return {
          success: false,
          error: pairValidation.reason || 'Trade pair not in allowed list.',
        };
      }

      const requestData = {
        wallet_address: this.walletAddress,
        instruction: naturalLanguage,
        max_position_size_percent: this.parsePositionSize(this.tradeConfig.max_position_size),
        stop_loss_pct: this.tradeConfig.stop_loss_pct,
        auto_execute: this.tradeConfig.auto_execute,
        signal_id: signalId,
        allowed_pairs: this.tradeConfig.allowed_pairs,
      };

      const response = await this.retryRequest(async () => {
        return await this.client.post('/trade/natural-language', requestData);
      });

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error?.message || 'Trade execution failed',
        };
      }

      this.dailyTradeCount++;

      const data = response.data.data;
      return {
        success: true,
        trade_id: data.trade_id,
        pair: data.pair,
        side: data.side,
        amount: data.amount,
        price: data.price,
        status: data.status,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[MINARA] Natural language trade execution failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ウォレット残高の取得
   */
  async getWalletBalance(): Promise<WalletBalanceResult | null> {
    try {
      const response = await this.client.get(`/wallet/${this.walletAddress}/balance`);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to get wallet balance');
      }

      return response.data.data as WalletBalanceResult;
    } catch (error: any) {
      console.error('[MINARA] Failed to get wallet balance:', error.message);
      return null;
    }
  }

  /**
   * トレード状態の確認
   */
  async getTradeStatus(tradeId: string): Promise<{
    status: 'pending' | 'executed' | 'cancelled' | 'failed';
    details?: any;
  } | null> {
    try {
      const response = await this.client.get(`/trade/${tradeId}/status`);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to get trade status');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('[MINARA] Failed to get trade status:', error.message);
      return null;
    }
  }

  /**
   * MINARA API ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error: any) {
      console.error('[MINARA] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * ポジションサイズ文字列を数値に変換 ("10%" -> 10)
   */
  private parsePositionSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)%?$/);
    if (match) {
      return parseFloat(match[1]);
    }
    return 10; // デフォルト10%
  }

  /**
   * 自然言語からトレードペアを推測し、許可リストと照合する
   */
  private validatePairFromInstruction(instruction: string): { valid: boolean; reason?: string } {
    const upperInstruction = instruction.toUpperCase();

    // 許可されたペアが命令文に含まれているかチェック
    const mentionedPairs = this.tradeConfig.allowed_pairs.filter((pair) => {
      const [base, quote] = pair.split('/');
      return upperInstruction.includes(base) || upperInstruction.includes(pair.replace('/', ''));
    });

    // ペアが明示的に言及されていない場合は通過させる（MINARA API側でバリデーション）
    if (mentionedPairs.length === 0) {
      const knownAssets = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'MATIC', 'LINK', 'UNI', 'AVAX'];
      const mentionsKnownAsset = knownAssets.some((asset) => upperInstruction.includes(asset));

      if (mentionsKnownAsset) {
        // 既知のアセットが言及されているが許可ペアにない
        return {
          valid: false,
          reason: `Trade pair not in allowed list. Allowed pairs: ${this.tradeConfig.allowed_pairs.join(', ')}`,
        };
      }

      // アセットの言及がない場合はMINARA APIに判断を委ねる
      return { valid: true };
    }

    return { valid: true };
  }

  /**
   * 日付が変わったらデイリーカウントをリセット
   */
  private resetDailyCountIfNeeded(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastTradeDate !== today) {
      this.dailyTradeCount = 0;
      this.lastTradeDate = today;
    }
  }

  /**
   * リトライ付きリクエスト実行
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        console.warn(
          `[MINARA] Request failed, retrying (${retryCount + 1}/${this.maxRetries}):`,
          error.message
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount))
        );
        return this.retryRequest(requestFn, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * リトライ可能なエラーかどうかを判定
   */
  private isRetryableError(error: any): boolean {
    if (!error.response) return true; // ネットワークエラー
    const status = error.response.status;
    return status >= 500 || status === 429 || [502, 503, 504].includes(status);
  }
}
