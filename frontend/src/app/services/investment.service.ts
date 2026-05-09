import { api } from "../lib/api";

export interface InvestmentDetail {
  _id: string;
  eventId: {
    _id: string;
    title?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  };
  contributionAmount: string;
  sharePercentage: number;
  claimedReward: string;
  pendingReward: string;
  shareTokenId?: string;
  createdAt: string;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

const WEB3AUTH_TX_GAS_CAP = 16_777_216n;
const INVESTMENT_FALLBACK_GAS_LIMIT = 500_000n;

export interface InvestmentIntentTransaction {
  to: string;
  data: string;
  value: string;
  chainId: string;
  functionName?: string;
}

export interface InvestmentIntentData {
  eventId: string;
  contractEventId: string;
  investor: string;
  amount: string;
  transaction: InvestmentIntentTransaction;
}

export interface ConfirmInvestmentPayload {
  txHash: string;
  investorWallet?: string;
}

export interface ConfirmInvestmentData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  share?: InvestmentDetail;
}

export interface RefundInvestmentIntentData {
  eventId: string;
  contractEventId: string;
  investor: string;
  refundableAmount: string;
  transaction: InvestmentIntentTransaction;
}

export interface ConfirmContributionRefundPayload {
  txHash: string;
  investorWallet?: string;
}

export interface ConfirmContributionRefundData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  refundAmount: string;
  share?: InvestmentDetail;
}

export interface ClaimInvestmentRefundResult {
  txHash: string;
  intent: RefundInvestmentIntentData;
  confirmation: ConfirmContributionRefundData | null;
}

export interface InvestOnChainResult {
  txHash: string;
  intent: InvestmentIntentData;
  confirmation: ConfirmInvestmentData | null;
}

function normalizeInvestment(detail: InvestmentDetail): InvestmentDetail {
  return {
    ...detail,
    contributionAmount: String(detail.contributionAmount || "0"),
    sharePercentage: Number(detail.sharePercentage || 0),
    claimedReward: String(detail.claimedReward || "0"),
    pendingReward: String(detail.pendingReward || "0"),
  };
}

function toHexValue(decimalString: string): string {
  const value = BigInt(decimalString);
  return `0x${value.toString(16)}`;
}

function getRpcErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as {
      message?: string;
      shortMessage?: string;
      data?: { message?: string; cause?: { message?: string } };
    };

    return (
      err.shortMessage ||
      err.message ||
      err.data?.message ||
      err.data?.cause?.message ||
      "Unknown RPC error"
    );
  }

  return String(error);
}

function isRateLimitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("request limit reached")
  );
}

function mapInvestmentRpcError(message: string): string {
  if (isRateLimitError(message)) {
    return "RPC đang bị rate-limit (429). Vui lòng đợi vài giây rồi thử lại.";
  }

  return message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseHexToBigInt(value: unknown): bigint | null {
  if (typeof value !== "string") return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function toSafeGasHex(estimatedGas: bigint): string {
  const paddedGas = estimatedGas + estimatedGas / 5n + 15_000n;
  const boundedGas =
    paddedGas > WEB3AUTH_TX_GAS_CAP ? WEB3AUTH_TX_GAS_CAP : paddedGas;

  return toHexValue(boundedGas.toString());
}

async function estimateInvestmentGasLimit(
  provider: Eip1193Provider,
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
  },
): Promise<string> {
  const txRequest = {
    from: tx.from,
    to: tx.to,
    data: tx.data,
    value: tx.value,
  };

  try {
    const estimated = await provider.request({
      method: "eth_estimateGas",
      params: [txRequest],
    });

    const estimatedGas = parseHexToBigInt(estimated);
    if (estimatedGas && estimatedGas > 0n) {
      return toSafeGasHex(estimatedGas);
    }
  } catch (error) {
    console.warn(
      "[Investment] Failed to estimate gas via wallet provider. Falling back to safe default gas limit.",
      error,
    );
  }

  const safeFallback =
    INVESTMENT_FALLBACK_GAS_LIMIT > WEB3AUTH_TX_GAS_CAP
      ? WEB3AUTH_TX_GAS_CAP
      : INVESTMENT_FALLBACK_GAS_LIMIT;
  return toHexValue(safeFallback.toString());
}

async function sendInvestmentTransactionWithRetry(
  provider: Eip1193Provider,
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
  },
  maxRetries = 4,
): Promise<string> {
  let lastError: unknown;
  const gas = await estimateInvestmentGasLimit(provider, tx);

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: tx.from,
            to: tx.to,
            data: tx.data,
            value: tx.value,
            gas,
          },
        ],
      })) as string;

      if (!txHash) {
        throw new Error("Failed to send investment transaction");
      }

      return txHash;
    } catch (error) {
      lastError = error;
      const message = getRpcErrorMessage(error);

      if (!isRateLimitError(message) || attempt === maxRetries) {
        throw new Error(mapInvestmentRpcError(message));
      }

      await sleep(1000 * attempt);
    }
  }

  throw new Error(mapInvestmentRpcError(getRpcErrorMessage(lastError)));
}

export async function getInvestments(): Promise<InvestmentDetail[]> {
  const response = await api.get<{
    success: boolean;
    data: InvestmentDetail[];
  }>("/users/shares");

  return (response.data || []).map(normalizeInvestment);
}

export async function getInvestmentById(id: string): Promise<InvestmentDetail> {
  const response = await api.get<{ success: boolean; data: InvestmentDetail }>(
    `/users/shares/${id}`,
  );

  return normalizeInvestment(response.data);
}

export async function createInvestmentIntent(
  eventId: string,
  amount: string,
): Promise<InvestmentIntentData | null> {
  const response = await api.post<{
    success: boolean;
    data?: InvestmentIntentData;
  }>(`/events/${eventId}/invest-intent`, { amount });

  return response.data || null;
}

export async function confirmInvestmentTransaction(
  eventId: string,
  payload: ConfirmInvestmentPayload,
  maxRetries = 15,
  retryDelayMs = 2000,
): Promise<ConfirmInvestmentData | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await api.post<{
        success: boolean;
        data?: ConfirmInvestmentData;
      }>(`/events/${eventId}/invest/confirm`, payload);

      return response.data
        ? {
            ...response.data,
            share: response.data.share
              ? normalizeInvestment(response.data.share)
              : undefined,
          }
        : null;
    } catch (error: any) {
      const isNotMined = error?.message?.includes("Transaction not mined yet");
      if (isNotMined && attempt < maxRetries) {
        await sleep(retryDelayMs);
        continue;
      }
      throw error;
    }
  }

  return null;
}

export async function createContributionRefundIntent(
  eventId: string,
): Promise<RefundInvestmentIntentData | null> {
  const response = await api.post<{
    success: boolean;
    data?: RefundInvestmentIntentData;
  }>(`/events/${eventId}/refund-intent`, {});

  return response.data || null;
}

export async function confirmContributionRefundTransaction(
  eventId: string,
  payload: ConfirmContributionRefundPayload,
  maxRetries = 15,
  retryDelayMs = 2000,
): Promise<ConfirmContributionRefundData | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await api.post<{
        success: boolean;
        data?: ConfirmContributionRefundData;
      }>(`/events/${eventId}/refund/confirm`, payload);

      return response.data
        ? {
            ...response.data,
            share: response.data.share
              ? normalizeInvestment(response.data.share)
              : undefined,
          }
        : null;
    } catch (error: any) {
      const isNotMined = error?.message?.includes("Transaction not mined yet");
      if (isNotMined && attempt < maxRetries) {
        await sleep(retryDelayMs);
        continue;
      }
      throw error;
    }
  }

  return null;
}

export async function investInEvent(
  eventId: string,
  amount: string,
): Promise<InvestmentDetail> {
  const response = await api.post<{ success: boolean; data: InvestmentDetail }>(
    `/events/${eventId}/invest`,
    { amount },
  );

  return normalizeInvestment(response.data);
}

export async function investInEventOnChain(
  provider: Eip1193Provider,
  eventId: string,
  amount: string,
  investorWallet?: string,
): Promise<InvestOnChainResult> {
  if (!provider?.request) {
    throw new Error("Wallet provider is unavailable");
  }

  const intent = await createInvestmentIntent(eventId, amount);
  if (!intent?.transaction) {
    throw new Error("Unable to create investment intent");
  }

  const fromAddress = investorWallet || intent.investor;
  if (!fromAddress) {
    throw new Error("Investor wallet address is required");
  }

  const txHash = await sendInvestmentTransactionWithRetry(provider, {
    from: fromAddress,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toHexValue(intent.transaction.value),
  });

  const confirmation = await confirmInvestmentTransaction(eventId, {
    txHash,
    investorWallet: fromAddress,
  });

  return {
    txHash,
    intent,
    confirmation,
  };
}

export async function claimContributionRefundOnChain(
  provider: Eip1193Provider,
  eventId: string,
  investorWallet?: string,
): Promise<ClaimInvestmentRefundResult> {
  if (!provider?.request) {
    throw new Error("Wallet provider is unavailable");
  }

  const intent = await createContributionRefundIntent(eventId);
  if (!intent?.transaction) {
    throw new Error("Unable to create refund intent");
  }

  const fromAddress = investorWallet || intent.investor;
  if (!fromAddress) {
    throw new Error("Investor wallet address is required");
  }

  const txHash = await sendInvestmentTransactionWithRetry(provider, {
    from: fromAddress,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toHexValue(intent.transaction.value),
  });

  const confirmation = await confirmContributionRefundTransaction(eventId, {
    txHash,
    investorWallet: fromAddress,
  });

  return {
    txHash,
    intent,
    confirmation,
  };
}
