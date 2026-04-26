import { ApiError, api } from "../lib/api";

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
  status?: "minted" | "sold" | "used" | "expired";
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

interface VerifyTicketResponse {
  success: boolean;
  data?: {
    isOwner: boolean;
    ownerWallet?: string;
    ticket?: ApiTicket;
  };
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

export interface UseTicketIntentData {
  tokenId: string;
  verifier: string;
  transaction: PurchaseIntentTransaction;
}

interface UseTicketIntentResponse {
  success: boolean;
  data?: UseTicketIntentData;
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

export interface VerifyTicketPayload {
  tokenId: string;
  eventId: string;
  walletAddress?: string;
}

export interface VerifyTicketResult {
  isOwner: boolean;
  ticket: ApiTicket | null;
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
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not been authorized by the user") ||
    normalized.includes("unauthorized")
  ) {
    return "Ví chưa cấp quyền cho ứng dụng. Hãy mở MetaMask, bấm Connect và cấp quyền truy cập tài khoản.";
  }

  if (
    normalized.includes("user rejected") ||
    normalized.includes("rejected the request")
  ) {
    return "Bạn đã từ chối thao tác trên ví. Vui lòng xác nhận lại trong MetaMask.";
  }

  if (normalized.includes("invalid parameters: must provide an Ethereum address")) {
    return "Địa chỉ ví gửi giao dịch không hợp lệ hoặc chưa được chọn trong MetaMask.";
  }

  if (isRateLimitError(message)) {
    return "RPC đang bị rate-limit (429). Vui lòng đợi 3-5 giây rồi thử lại.";
  }

  return message;
}

async function ensureWalletAccountAccess(
  provider: Eip1193Provider,
  expectedAddress?: string,
): Promise<string> {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Không tìm thấy tài khoản ví nào đã kết nối.");
  }

  const normalizedAccounts = accounts.map((account) => account.toLowerCase());

  if (expectedAddress) {
    const normalizedExpected = expectedAddress.toLowerCase();
    const matchedIndex = normalizedAccounts.findIndex(
      (account) => account === normalizedExpected,
    );

    if (matchedIndex >= 0) {
      return accounts[matchedIndex];
    }

    throw new Error(
      `Ví đang chọn (${accounts[0]}) không khớp với tài khoản yêu cầu (${expectedAddress}). Vui lòng chuyển đúng account trong MetaMask.`,
    );
  }

  return accounts[0];
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

export async function verifyTicket(
  payload: VerifyTicketPayload,
): Promise<VerifyTicketResult | null> {
  const response = await api.post<VerifyTicketResponse>(
    "/tickets/verify",
    payload,
    { headers: getAuthHeaders() },
  );

  return response.data
    ? {
        isOwner: !!response.data.isOwner,
        ticket: response.data.ticket
          ? normalizeTicket(response.data.ticket)
          : null,
      }
    : null;
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

  await ensureWalletAccountAccess(provider, fromAddress);

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

export async function createUseTicketIntent(
  tokenId: string,
): Promise<UseTicketIntentData | null> {
  const response = await api.post<UseTicketIntentResponse>(
    `/tickets/${encodeURIComponent(tokenId)}/use-intent`,
    {},
    { headers: getAuthHeaders() },
  );

  return response.data || null;
}

export async function confirmUseTicketTransaction(
  payload: { txHash: string; tokenId?: string; verifierWallet?: string },
): Promise<ConfirmPurchaseData | null> {
  try {
    const response = await api.post<ConfirmPurchaseResponse>(
      `/tickets/use/confirm`,
      payload,
      { headers: getAuthHeaders() },
    );

    return response.data || null;
  } catch (error) {
    if (
      error instanceof ApiError &&
      /transaction failed on-chain/i.test(error.message)
    ) {
      throw new Error(
        "Giao dịch check-in đã bị revert on-chain. Hãy kiểm tra: ví hiện tại có là verifier on-chain cho event, ticket còn trạng thái SOLD, event đang ONGOING, và đúng network Sepolia.",
      );
    }

    throw error;
  }
}

export async function useTicketOnChain(
  provider: Eip1193Provider,
  tokenId: string,
  verifierWallet?: string,
): Promise<{ txHash: string; intent: UseTicketIntentData; confirmation: ConfirmPurchaseData | null }> {
  if (!provider?.request) {
    throw new Error('Wallet provider is unavailable');
  }

  const intent = await createUseTicketIntent(tokenId);
  if (!intent?.transaction) {
    throw new Error('Unable to create use intent');
  }

  const fromAddress = verifierWallet || intent.verifier;
  if (!fromAddress) {
    throw new Error('Verifier wallet address is required to send transaction');
  }

  await ensureWalletAccountAccess(provider, fromAddress);

  const txHash = await sendPurchaseTransactionWithRetry(provider, {
    from: fromAddress,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toHexValue(intent.transaction.value || '0'),
  });

  const confirmation = await confirmUseTicketTransaction({
    txHash,
    tokenId: intent.tokenId,
    verifierWallet: fromAddress,
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
  verifyTicket,
  createUseTicketIntent,
  confirmUseTicketTransaction,
  useTicketOnChain,
  createPurchaseIntent,
  confirmPurchaseTransaction,
  purchaseTicket,
};
