import { api } from "../lib/api";

export interface ExchangeRate {
  currency: string;
  vndRate: number;
  lastUpdated: string;
}

export interface DepositOrder {
  orderId: string;
  vndAmount: number;
  ethAmount: string;
  ethAmountWei: string;
  exchangeRate: number;
  expiresAt: string;
  vnpayUrl: string;
}

export interface DepositOrderDetail {
  orderId: string;
  status: "pending" | "paid" | "processing" | "completed" | "failed" | "expired";
  vndAmount: number;
  ethAmount: string;
  ethAmountWei: string;
  exchangeRate: number;
  transferTxHash?: string;
  transferBlockNumber?: number;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  expiresAt: string;
  errorMessage?: string;
}

export interface UserBalance {
  walletAddress: string;
  totalDeposited: string;
  totalWithdrawn: string;
  availableBalance: string;
  totalDepositedWei: string;
  totalWithdrawnWei: string;
  availableBalanceWei: string;
  depositCount: number;
  lastDepositAt?: string;
}

export interface DepositHistory {
  deposits: DepositOrderDetail[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalDocs: number;
  };
}

class DepositService {
  /**
   * Get current ETH/VND exchange rate
   */
  async getExchangeRate(): Promise<ExchangeRate> {
    const response = await api.get<{ success: boolean; data: ExchangeRate }>(
      "/deposits/rate/exchange-rate"
    );
    return response.data;
  }

  /**
   * Create a new deposit order
   */
  async createDepositOrder(vndAmount: number): Promise<DepositOrder> {
    const response = await api.post<{ success: boolean; data: DepositOrder }>(
      "/deposits/create",
      { vndAmount }
    );
    return response.data;
  }

  /**
   * Get deposit order by ID
   */
  async getDepositOrder(orderId: string): Promise<DepositOrderDetail> {
    const response = await api.get<{ success: boolean; data: DepositOrderDetail }>(
      `/deposits/${orderId}`
    );
    return response.data;
  }

  /**
   * Get deposit history
   */
  async getDepositHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<DepositHistory> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.status) queryParams.append("status", params.status);

    const response = await api.get<{ success: boolean; data: DepositHistory }>(
      `/deposits/history?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get user balance
   */
  async getUserBalance(): Promise<UserBalance> {
    const response = await api.get<{ success: boolean; data: UserBalance }>(
      "/deposits/user/balance"
    );
    return response.data;
  }

  /**
   * Poll order status until completed or failed
   */
  async pollOrderStatus(
    orderId: string,
    maxAttempts = 60,
    intervalMs = 3000
  ): Promise<DepositOrderDetail> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const order = await this.getDepositOrder(orderId);

      if (order.status === "completed" || order.status === "failed") {
        return order;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    // Timeout
    throw new Error("Deposit order polling timeout");
  }
}

export const depositService = new DepositService();
