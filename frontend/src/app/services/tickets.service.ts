import { api } from "../lib/api";

export interface ApiEvent {
  _id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  venue?: {
    address?: string;
  };
}

export interface ApiTicket {
  _id?: string;
  tokenId: string;
  originalPrice?: string;
  ticketType?: string;
  status?: "minted" | "sold" | "used" | "expired" | "refunded";
  isListed?: boolean;
  currentOwner?: string;
  createdAt?: string;
  soldAt?: string;
  usedAt?: string;
  verifiedBy?: string;
  eventIdRaw?: string;
  eventId?: ApiEvent | string;
}

interface TicketsResponse {
  success: boolean;
  data?: {
    docs?: ApiTicket[];
    totalDocs?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  message?: string;
}

interface TicketDetailResponse {
  success: boolean;
  data?: ApiTicket;
  message?: string;
}

export interface PurchaseIntentPayload {
  eventId?: string;
  tokenId?: string;
}

export interface PurchaseIntentTransaction {
  to: string;
  data: string;
  value: string;
  chainId: string;
  functionName?: string;
}

export interface PurchaseIntentData {
  tokenId: string;
  eventId: string;
  buyer: string;
  transaction: PurchaseIntentTransaction;
}

interface PurchaseIntentResponse {
  success: boolean;
  data?: PurchaseIntentData;
  message?: string;
}

export interface ConfirmPurchasePayload {
  txHash: string;
  tokenId?: string;
  buyerWallet?: string;
}

export interface ConfirmPurchaseData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  ticket?: ApiTicket;
}

export interface RefundIntentTransaction {
  to: string;
  data: string;
  value: string;
  chainId: string;
  functionName?: string;
}

export interface RefundIntentData {
  tokenId: string;
  eventId: string;
  buyer: string;
  refundAmount: string;
  transaction: RefundIntentTransaction;
}

interface RefundIntentResponse {
  success: boolean;
  data?: RefundIntentData;
  message?: string;
}

export interface ConfirmRefundPayload {
  txHash: string;
  tokenId?: string;
  buyerWallet?: string;
}

export interface ConfirmRefundData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  ticket?: ApiTicket;
}

interface ConfirmRefundResponse {
  success: boolean;
  data?: ConfirmRefundData;
  message?: string;
}

interface ConfirmPurchaseResponse {
  success: boolean;
  data?: ConfirmPurchaseData;
  message?: string;
}

export interface EventTicketStats {
  totalTickets: number;
  soldTickets: number;
  usedTickets: number;
  mintedTickets: number;
  availableTickets: number;
}

interface EventTicketStatsResponse {
  success: boolean;
  data?: EventTicketStats;
  message?: string;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export interface PurchaseTicketResult {
  txHash: string;
  intent: PurchaseIntentData;
  confirmation: ConfirmPurchaseData | null;
}

export interface ClaimTicketRefundResult {
  txHash: string;
  intent: RefundIntentData;
  confirmation: ConfirmRefundData | null;
}

const SEND_TX_MAX_RETRIES = 4;

function getAuthHeaders(): HeadersInit {
  const jwtToken = localStorage.getItem("jwtToken");
  return jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
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

function mapPurchaseRpcError(message: string): string {
  if (isRateLimitError(message)) {
    return "RPC đang bị rate-limit (429). Vui lòng đợi 3-5 giây rồi thử lại.";
  }

  return message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function sendPurchaseTransactionWithRetry(
  provider: Eip1193Provider,
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
  },
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SEND_TX_MAX_RETRIES; attempt += 1) {
    try {
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: tx.from,
            to: tx.to,
            data: tx.data,
            value: tx.value,
          },
        ],
      })) as string;

      if (!txHash) {
        throw new Error("Failed to send purchase transaction");
      }

      return txHash;
    } catch (error) {
      lastError = error;
      const message = getRpcErrorMessage(error);

      if (!isRateLimitError(message) || attempt === SEND_TX_MAX_RETRIES) {
        throw new Error(mapPurchaseRpcError(message));
      }

      const retryDelay = 1000 * attempt;
      await sleep(retryDelay);
    }
  }

  throw new Error(mapPurchaseRpcError(getRpcErrorMessage(lastError)));
}

function normalizeTicket(ticket: ApiTicket): ApiTicket {
  if (typeof ticket.eventId === "object" && ticket.eventId?._id) {
    return {
      ...ticket,
      eventIdRaw: ticket.eventId._id,
    };
  }

  if (typeof ticket.eventId === "string") {
    return {
      ...ticket,
      eventIdRaw: ticket.eventId,
    };
  }

  return ticket;
}

export async function getUserTickets(
  walletAddress: string,
): Promise<ApiTicket[]> {
  const payload = await api.get<TicketsResponse>(
    `/tickets/user/${walletAddress.toLowerCase()}?page=1&limit=100`,
  );

  return (payload.data?.docs || []).map(normalizeTicket);
}

export interface GetTicketsParams {
  eventId?: string;
  status?: "minted" | "sold" | "used" | "expired";
  owner?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginatedTicketsResult {
  docs: ApiTicket[];
  totalDocs: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getTickets(
  params: GetTicketsParams = {},
): Promise<PaginatedTicketsResult> {
  const query = new URLSearchParams();

  if (params.eventId) query.set("eventId", params.eventId);
  if (params.status) query.set("status", params.status);
  if (params.owner) query.set("owner", params.owner.toLowerCase());
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));
  if (params.sort) query.set("sort", params.sort);

  const payload = await api.get<TicketsResponse>(
    `/tickets?${query.toString()}`,
  );
  const data = payload.data;

  return {
    docs: (data?.docs || []).map(normalizeTicket),
    totalDocs: data?.totalDocs || 0,
    page: data?.page || 1,
    limit: data?.limit || params.limit || 20,
    totalPages: data?.totalPages || 0,
  };
}

export async function getTicketByTokenId(
  tokenId: string,
): Promise<ApiTicket | null> {
  const payload = await api.get<TicketDetailResponse>(
    `/tickets/${encodeURIComponent(tokenId)}`,
  );
  return payload.data ? normalizeTicket(payload.data) : null;
}

export async function getTicketStats(
  eventId: string,
): Promise<EventTicketStats | null> {
  const payload = await api.get<EventTicketStatsResponse>(
    `/tickets/event/${encodeURIComponent(eventId)}/stats`,
  );
  return payload.data || null;
}

export async function markTicketAsUsed(
  tokenId: string,
  eventId?: string,
): Promise<ApiTicket | null> {
  const payload = await api.post<TicketDetailResponse>(
    `/tickets/${encodeURIComponent(tokenId)}/use`,
    {
      tokenId,
      eventId,
    },
    { headers: getAuthHeaders() },
  );

  return payload.data ? normalizeTicket(payload.data) : null;
}

export async function createPurchaseIntent(
  payload: PurchaseIntentPayload,
): Promise<PurchaseIntentData | null> {
  const response = await api.post<PurchaseIntentResponse>(
    "/tickets/purchase-intent",
    payload,
    { headers: getAuthHeaders() },
  );

  return response.data || null;
}

export async function confirmPurchaseTransaction(
  payload: ConfirmPurchasePayload,
): Promise<ConfirmPurchaseData | null> {
  const response = await api.post<ConfirmPurchaseResponse>(
    "/tickets/purchase/confirm",
    payload,
    { headers: getAuthHeaders() },
  );

  return response.data
    ? {
        ...response.data,
        ticket: response.data.ticket
          ? normalizeTicket(response.data.ticket)
          : undefined,
      }
    : null;
}

export async function createRefundIntent(
  tokenId: string,
): Promise<RefundIntentData | null> {
  const response = await api.post<RefundIntentResponse>(
    `/tickets/${encodeURIComponent(tokenId)}/refund-intent`,
    {},
    { headers: getAuthHeaders() },
  );

  return response.data || null;
}

export async function confirmRefundTransaction(
  payload: ConfirmRefundPayload,
): Promise<ConfirmRefundData | null> {
  const response = await api.post<ConfirmRefundResponse>(
    "/tickets/refund/confirm",
    payload,
    { headers: getAuthHeaders() },
  );

  return response.data
    ? {
        ...response.data,
        ticket: response.data.ticket
          ? normalizeTicket(response.data.ticket)
          : undefined,
      }
    : null;
}

function toHexValue(decimalString: string): string {
  const value = BigInt(decimalString);
  return `0x${value.toString(16)}`;
}

export async function purchaseTicket(
  provider: Eip1193Provider,
  payload: PurchaseIntentPayload,
  buyerWallet?: string,
): Promise<PurchaseTicketResult> {
  if (!provider?.request) {
    throw new Error("Wallet provider is unavailable");
  }

  const intent = await createPurchaseIntent(payload);
  if (!intent?.transaction) {
    throw new Error("Unable to create purchase intent");
  }

  const fromAddress = buyerWallet || intent.buyer;
  if (!fromAddress) {
    throw new Error("Buyer wallet address is required to purchase ticket");
  }

  const txHash = await sendPurchaseTransactionWithRetry(provider, {
    from: fromAddress,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toHexValue(intent.transaction.value),
  });

  const confirmation = await confirmPurchaseTransaction({
    txHash,
    tokenId: intent.tokenId,
    buyerWallet: fromAddress,
  });

  return {
    txHash,
    intent,
    confirmation,
  };
}

export async function claimTicketRefundOnChain(
  provider: Eip1193Provider,
  tokenId: string,
  buyerWallet?: string,
): Promise<ClaimTicketRefundResult> {
  if (!provider?.request) {
    throw new Error("Wallet provider is unavailable");
  }

  const intent = await createRefundIntent(tokenId);
  if (!intent?.transaction) {
    throw new Error("Unable to create refund intent");
  }

  const fromAddress = buyerWallet || intent.buyer;
  if (!fromAddress) {
    throw new Error("Buyer wallet address is required");
  }

  const txHash = await sendPurchaseTransactionWithRetry(provider, {
    from: fromAddress,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toHexValue(intent.transaction.value),
  });

  const confirmation = await confirmRefundTransaction({
    txHash,
    tokenId: intent.tokenId,
    buyerWallet: fromAddress,
  });

  return {
    txHash,
    intent,
    confirmation,
  };
}

export const ticketsService = {
  getUserTickets,
  getTickets,
  getTicketByTokenId,
  getTicketStats,
  markTicketAsUsed,
  createPurchaseIntent,
  confirmPurchaseTransaction,
  createRefundIntent,
  confirmRefundTransaction,
  purchaseTicket,
  claimTicketRefundOnChain,
};
