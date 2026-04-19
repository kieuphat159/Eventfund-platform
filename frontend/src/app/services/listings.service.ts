import { api } from "../lib/api";
import { ApiError } from "../lib/api";
import { Interface } from "ethers";

// Ticket (embedded)
export interface ApiTicket {
  _id: string;
  tokenId: string;
  currentOwner: string;
  originalPrice: string;
  ticketType: string;
  status: "minted" | "sold" | "used" | "expired";
  soldAt?: string;
  isListed: boolean;
}

// Event (embedded)
export interface ApiEvent {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  imageUrls: string[];
  status: string;
}

// Listing
export interface ApiListing {
  _id: string;
  id?: string;

  tokenId: string;

  ticketId: ApiTicket; // populated
  eventId: ApiEvent; // populated

  seller: string;

  price: string;
  maxPrice: string;

  status: "active" | "sold" | "cancelled" | "expired";

  txHash?: string;

  expiresAt?: string;
  listedAt: string;
}

export interface CreateListingPayload {
  ticketId: string;
  price: string;
  expiresAt?: string;
}

export interface GetListingsParams {
  eventId?: string;
  seller?: string;
  status?: string;
  minPrice?: string; // wei
  maxPrice?: string; // wei
  page?: number;
  limit?: number;
  sort?: "price" | "listedAt" | "expiresAt";
  order?: "asc" | "desc";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ListingIntentPayload {
  ticketId: string;
  price: string;
}

export interface MarketplaceTransaction {
  to: string;
  data: string;
  value: string;
  chainId: string;
  functionName?: string;
}

export interface CreateListingIntentData {
  ticketId: string;
  tokenId: string;
  seller: string;
  transaction: MarketplaceTransaction;
}

export interface BuyListingIntentData {
  listingId: string;
  contractListingId: string;
  tokenId: string;
  buyer: string;
  transaction: MarketplaceTransaction;
}

export interface CancelListingIntentData {
  listingId: string;
  contractListingId: string;
  tokenId: string;
  seller: string;
  transaction: MarketplaceTransaction;
}

export interface ConfirmSoldPayload {
  txHash: string;
  listingId?: string;
  buyerWallet?: string;
}

export interface ConfirmSoldData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  listing?: ApiListing;
  ticket?: ApiTicket;
}

export interface ConfirmCreatedPayload {
  txHash: string;
  tokenId?: string;
  sellerWallet?: string;
}

export interface ConfirmCreatedData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  listing?: ApiListing;
  ticket?: ApiTicket;
}

export interface ConfirmCancelledPayload {
  txHash: string;
  listingId?: string;
  sellerWallet?: string;
}

export interface ConfirmCancelledData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  listing?: ApiListing;
  ticket?: ApiTicket;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

const WEB3AUTH_TX_GAS_CAP = 16_000_000n;
const MARKETPLACE_FALLBACK_GAS_LIMIT = 1_200_000n;
const CONFIRM_TX_MAX_RETRIES = 15;
const CONFIRM_TX_RETRY_DELAY_MS = 2000;

const MARKETPLACE_READ_INTERFACE = new Interface([
  "function ticketNFT() view returns (address)",
  "function ticketContract() view returns (address)",
  "function ticketAddress() view returns (address)",
]);

const ERC721_INTERFACE = new Interface([
  "function isApprovedForAll(address owner,address operator) view returns (bool)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function setApprovalForAll(address operator,bool approved)",
]);

export type BuyListingProgressStage =
  | "preparing_intent"
  | "awaiting_wallet_confirmation"
  | "waiting_onchain_confirmation"
  | "syncing_backend"
  | "completed";

export type ListListingProgressStage =
  | "preparing_intent"
  | "awaiting_wallet_confirmation"
  | "waiting_onchain_confirmation"
  | "syncing_backend"
  | "completed";

export type CancelListingProgressStage =
  | "preparing_intent"
  | "awaiting_wallet_confirmation"
  | "waiting_onchain_confirmation"
  | "syncing_backend"
  | "completed";

export interface MarketplaceStats {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  cancelledListings: number;
  totalVolume: string;
  averagePrice: string;
}

export interface TransactionHistory {
  listingId: string;
  eventId: string;
  event: string | null;
  tier: string | null;
  price: string;
  buyer: string | null;
  seller: string | null;
  time: string | null;
  tokenId: string;
}

export interface GetHistoryParams {
  eventId?: string;
  seller?: string;
  buyer?: string;
  page?: number;
  limit?: number;
  sort?: "soldAt" | "price" | "listedAt";
  order?: "asc" | "desc";
}

/* =========================
   RESPONSE TYPES
========================= */

interface Paginated<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface IntentResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface CancelListingData {
  _id: string;
  status: "cancelled";
}

/* =========================
   SERVICES
========================= */

//  Get all listings (marketplace)
export async function getListings(params: GetListingsParams = {}) {
  const {
    eventId,
    seller,
    status,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sort,
    order,
    sortBy,
    sortOrder,
  } = params;

  const resolvedSort =
    sort || (sortBy as GetListingsParams["sort"]) || "listedAt";
  const resolvedOrder = order || sortOrder || "desc";

  const query = new URLSearchParams();

  if (eventId) query.append("eventId", eventId);
  if (seller) query.append("seller", seller);
  if (status) query.append("status", status);
  if (minPrice) query.append("minPrice", minPrice);
  if (maxPrice) query.append("maxPrice", maxPrice);

  query.append("page", String(page));
  query.append("limit", String(limit));
  query.append("sort", resolvedSort);
  query.append("order", resolvedOrder);

  const res = await api.get<ApiResponse<Paginated<ApiListing>>>(
    `/marketplace/listings?${query.toString()}`,
  );

  return res.data;
}

export async function getListingById(id: string) {
  const res = await api.get<ApiResponse<ApiListing>>(
    `/marketplace/listings/${id}`,
  );

  return res.data;
}

export async function listTicket(payload: CreateListingPayload) {
  if (!payload.ticketId) {
    throw new Error("Ticket ID is required");
  }

  if (!payload.price || BigInt(payload.price) <= 0n) {
    throw new Error("Price must be greater than 0 (wei)");
  }

  if (payload.expiresAt && isNaN(Date.parse(payload.expiresAt))) {
    throw new Error("Invalid expiresAt date");
  }

  try {
    const res = await api.post<ApiResponse<ApiListing>>(
      "/marketplace/listings",
      payload,
    );

    return res.data;
  } catch (err: any) {
    const message =
      err instanceof ApiError
        ? err.message
        : err?.message || "Failed to create listing";

    throw new Error(message);
  }
}

export async function createListingIntent(payload: ListingIntentPayload) {
  if (!payload.ticketId?.trim()) {
    throw new Error("Ticket ID is required");
  }

  if (!payload.price || BigInt(payload.price) <= 0n) {
    throw new Error("Price must be greater than 0");
  }

  const res = await api.post<IntentResponse<CreateListingIntentData>>(
    "/marketplace/listings/intent",
    payload,
  );

  return res.data || null;
}

export async function createBuyListingIntent(listingId: string) {
  if (!listingId?.trim()) {
    throw new Error("Listing ID is required");
  }

  const res = await api.post<IntentResponse<BuyListingIntentData>>(
    `/marketplace/listings/${listingId}/buy-intent`,
  );

  return res.data || null;
}

export async function createCancelListingIntent(listingId: string) {
  if (!listingId?.trim()) {
    throw new Error("Listing ID is required");
  }

  const res = await api.post<IntentResponse<CancelListingIntentData>>(
    `/marketplace/listings/${listingId}/cancel-intent`,
  );

  return res.data || null;
}

export async function confirmSoldTransaction(
  payload: ConfirmSoldPayload,
  maxRetries = CONFIRM_TX_MAX_RETRIES,
  retryDelayMs = CONFIRM_TX_RETRY_DELAY_MS,
) {
  if (!payload.txHash?.trim()) {
    throw new Error("Transaction hash is required");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await api.post<IntentResponse<ConfirmSoldData>>(
        "/marketplace/listings/confirm-sold",
        payload,
      );

      return res.data || null;
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

export async function confirmCreatedTransaction(
  payload: ConfirmCreatedPayload,
  maxRetries = CONFIRM_TX_MAX_RETRIES,
  retryDelayMs = CONFIRM_TX_RETRY_DELAY_MS,
) {
  if (!payload.txHash?.trim()) {
    throw new Error("Transaction hash is required");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await api.post<IntentResponse<ConfirmCreatedData>>(
        "/marketplace/listings/confirm-created",
        payload,
      );

      return res.data || null;
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

export async function confirmCancelledTransaction(
  payload: ConfirmCancelledPayload,
  maxRetries = CONFIRM_TX_MAX_RETRIES,
  retryDelayMs = CONFIRM_TX_RETRY_DELAY_MS,
) {
  if (!payload.txHash?.trim()) {
    throw new Error("Transaction hash is required");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await api.post<IntentResponse<ConfirmCancelledData>>(
        "/marketplace/listings/confirm-cancelled",
        payload,
      );

      return res.data || null;
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

export async function getMarketplaceHistory(params: GetHistoryParams = {}) {
  const {
    eventId,
    seller,
    buyer,
    page = 1,
    limit = 20,
    sort = "soldAt",
    order = "desc",
  } = params;

  const query = new URLSearchParams();

  if (eventId) query.append("eventId", eventId);
  if (seller) query.append("seller", seller);
  if (buyer) query.append("buyer", buyer);

  query.append("page", String(page));
  query.append("limit", String(limit));
  query.append("sort", sort);
  query.append("order", order);

  try {
    const res = await api.get<ApiResponse<Paginated<TransactionHistory>>>(
      `/marketplace/history?${query.toString()}`,
    );

    return res.data;
  } catch (err: any) {
    const message =
      err instanceof ApiError
        ? err.message
        : err?.message || "Failed to fetch marketplace history";

    throw new Error(message);
  }
}

function toHexValue(decimalString: string): string {
  const value = BigInt(decimalString);
  return `0x${value.toString(16)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddress(value?: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase();
}

function parseHexToBigInt(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

async function estimateMarketplaceGasLimit(
  provider: Eip1193Provider,
  tx: MarketplaceTransaction,
  from: string,
): Promise<string> {
  const txRequest = {
    from,
    to: tx.to,
    data: tx.data,
    value: toHexValue(tx.value || "0"),
  };

  try {
    const estimated = await provider.request({
      method: "eth_estimateGas",
      params: [txRequest],
    });

    const estimatedGas = parseHexToBigInt(estimated);
    if (estimatedGas && estimatedGas > 0n) {
      const padded = estimatedGas + estimatedGas / 5n + 15000n;
      const clamped = padded > WEB3AUTH_TX_GAS_CAP ? WEB3AUTH_TX_GAS_CAP : padded;
      return toHexValue(clamped.toString());
    }
  } catch (error) {
    console.warn(
      "[Marketplace] Failed to estimate gas via wallet provider. Falling back to safe default gas limit.",
      error,
    );
  }

  return toHexValue(
    (
      MARKETPLACE_FALLBACK_GAS_LIMIT > WEB3AUTH_TX_GAS_CAP
        ? WEB3AUTH_TX_GAS_CAP
        : MARKETPLACE_FALLBACK_GAS_LIMIT
    ).toString(),
  );
}

async function ethCall(
  provider: Eip1193Provider,
  to: string,
  data: string,
): Promise<string> {
  const result = await provider.request({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
  if (typeof result !== "string") {
    throw new Error("Invalid eth_call response");
  }
  return result;
}

async function getTicketAddressFromMarketplace(
  provider: Eip1193Provider,
  marketplaceAddress: string,
): Promise<string> {
  const readFns = ["ticketNFT", "ticketContract", "ticketAddress"] as const;

  for (const fn of readFns) {
    try {
      const data = MARKETPLACE_READ_INTERFACE.encodeFunctionData(fn, []);
      const result = await ethCall(provider, marketplaceAddress, data);
      const [addressValue] = MARKETPLACE_READ_INTERFACE.decodeFunctionResult(
        fn,
        result,
      );
      const normalized = normalizeAddress(String(addressValue));
      if (normalized) {
        return normalized;
      }
    } catch {
      // Try next getter.
    }
  }

  throw new Error(
    "Unable to resolve Ticket contract address from Marketplace contract.",
  );
}

async function isMarketplaceApprovedForToken(
  provider: Eip1193Provider,
  owner: string,
  marketplaceAddress: string,
  tokenId: string,
): Promise<boolean> {
  const ticketAddress = await getTicketAddressFromMarketplace(
    provider,
    marketplaceAddress,
  );

  const isApprovedForAllData = ERC721_INTERFACE.encodeFunctionData(
    "isApprovedForAll",
    [owner, marketplaceAddress],
  );
  const isApprovedForAllResult = await ethCall(
    provider,
    ticketAddress,
    isApprovedForAllData,
  );
  const [isApprovedForAll] = ERC721_INTERFACE.decodeFunctionResult(
    "isApprovedForAll",
    isApprovedForAllResult,
  );
  if (Boolean(isApprovedForAll)) {
    return true;
  }

  try {
    const getApprovedData = ERC721_INTERFACE.encodeFunctionData("getApproved", [
      BigInt(tokenId),
    ]);
    const getApprovedResult = await ethCall(
      provider,
      ticketAddress,
      getApprovedData,
    );
    const [approvedAddress] = ERC721_INTERFACE.decodeFunctionResult(
      "getApproved",
      getApprovedResult,
    );
    return (
      normalizeAddress(String(approvedAddress)) ===
      normalizeAddress(marketplaceAddress)
    );
  } catch {
    return false;
  }
}

async function waitForTransactionReceipt(
  provider: Eip1193Provider,
  txHash: string,
  maxRetries = CONFIRM_TX_MAX_RETRIES,
  retryDelayMs = CONFIRM_TX_RETRY_DELAY_MS,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: string } | null;

    if (receipt) {
      const status = parseHexToBigInt(receipt.status);
      if (status === 0n) {
        throw new Error(`Transaction reverted on-chain: ${txHash}`);
      }
      return;
    }

    if (attempt < maxRetries) {
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`Transaction not mined yet: ${txHash}`);
}

async function ensureMarketplaceApprovalForListing(
  provider: Eip1193Provider,
  sellerWallet: string,
  marketplaceAddress: string,
  tokenId: string,
): Promise<string | null> {
  const normalizedSeller = normalizeAddress(sellerWallet);
  const normalizedMarketplace = normalizeAddress(marketplaceAddress);

  if (!normalizedSeller || !normalizedMarketplace) {
    throw new Error("Invalid seller or marketplace address for approval check");
  }

  const alreadyApproved = await isMarketplaceApprovedForToken(
    provider,
    normalizedSeller,
    normalizedMarketplace,
    tokenId,
  );
  if (alreadyApproved) {
    return null;
  }

  const ticketAddress = await getTicketAddressFromMarketplace(
    provider,
    normalizedMarketplace,
  );
  const approvalData = ERC721_INTERFACE.encodeFunctionData("setApprovalForAll", [
    normalizedMarketplace,
    true,
  ]);

  const approvalTxHash = await sendMarketplaceTransaction(
    provider,
    {
      to: ticketAddress,
      data: approvalData,
      value: "0",
      chainId: "",
      functionName: "setApprovalForAll",
    },
    normalizedSeller,
  );

  await waitForTransactionReceipt(provider, approvalTxHash);
  return approvalTxHash;
}

export async function sendMarketplaceTransaction(
  provider: Eip1193Provider,
  transaction: MarketplaceTransaction,
  from: string,
): Promise<string> {
  if (!provider?.request) {
    throw new Error("Wallet provider is unavailable");
  }

  if (!from?.trim()) {
    throw new Error("Wallet address is required");
  }

  const gas = await estimateMarketplaceGasLimit(provider, transaction, from);

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: transaction.to,
        data: transaction.data,
        value: toHexValue(transaction.value || "0"),
        gas,
      },
    ],
  })) as string;

  if (!txHash) {
    throw new Error("Failed to send transaction");
  }

  return txHash;
}

export async function buyListing(
  provider: Eip1193Provider,
  listingId: string,
  buyerWallet: string,
  onProgress?: (stage: BuyListingProgressStage, txHash?: string) => void,
) {
  onProgress?.("preparing_intent");
  const intent = await createBuyListingIntent(listingId);
  if (!intent?.transaction) {
    throw new Error("Unable to create buy intent");
  }

  onProgress?.("awaiting_wallet_confirmation");
  const txHash = await sendMarketplaceTransaction(
    provider,
    intent.transaction,
    buyerWallet,
  );

  onProgress?.("waiting_onchain_confirmation", txHash);
  onProgress?.("syncing_backend", txHash);
  const confirmation = await confirmSoldTransaction({
    txHash,
    listingId: intent.listingId,
    buyerWallet,
  });

  onProgress?.("completed", txHash);
  return { txHash, intent, confirmation };
}

export async function listTicketOnchain(
  provider: Eip1193Provider,
  payload: ListingIntentPayload,
  sellerWallet: string,
  onProgress?: (stage: ListListingProgressStage, txHash?: string) => void,
) {
  onProgress?.("preparing_intent");
  const intent = await createListingIntent(payload);
  if (!intent?.transaction) {
    throw new Error("Unable to create listing intent");
  }

  await ensureMarketplaceApprovalForListing(
    provider,
    sellerWallet,
    intent.transaction.to,
    intent.tokenId,
  );

  onProgress?.("awaiting_wallet_confirmation");
  const txHash = await sendMarketplaceTransaction(
    provider,
    intent.transaction,
    sellerWallet,
  );

  onProgress?.("waiting_onchain_confirmation", txHash);
  onProgress?.("syncing_backend", txHash);
  const confirmation = await confirmCreatedTransaction({
    txHash,
    tokenId: intent.tokenId,
    sellerWallet,
  });

  onProgress?.("completed", txHash);
  return { txHash, intent, confirmation };
}

export async function cancelListingOnchain(
  provider: Eip1193Provider,
  listingId: string,
  sellerWallet: string,
  onProgress?: (stage: CancelListingProgressStage, txHash?: string) => void,
) {
  onProgress?.("preparing_intent");
  const intent = await createCancelListingIntent(listingId);
  if (!intent?.transaction) {
    throw new Error("Unable to create cancel intent");
  }

  onProgress?.("awaiting_wallet_confirmation");
  const txHash = await sendMarketplaceTransaction(
    provider,
    intent.transaction,
    sellerWallet,
  );

  onProgress?.("waiting_onchain_confirmation", txHash);
  onProgress?.("syncing_backend", txHash);
  const confirmation = await confirmCancelledTransaction({
    txHash,
    listingId: intent.listingId,
    sellerWallet,
  });

  onProgress?.("completed", txHash);
  return { txHash, intent, confirmation };
}

export async function cancelListing(id: string) {
  if (!id?.trim()) {
    throw new Error("Listing ID is required");
  }

  try {
    const res = await api.delete<ApiResponse<CancelListingData>>(
      `/marketplace/listings/${id}`,
    );

    return res.data;
  } catch (err: any) {
    if (err instanceof ApiError) {
      if (err.status === 400) {
        throw new Error("Listing not active");
      }

      if (err.status === 401) {
        throw new Error("Not authenticated");
      }

      if (err.status === 403) {
        throw new Error("Not authorized (must be seller)");
      }

      if (err.status === 404) {
        throw new Error("Listing not found");
      }

      if (err.status >= 500) {
        throw new Error("Server error");
      }
    }

    const message = err?.message || "Server error";

    throw new Error(message);
  }
}

export async function getMarketplaceStats() {
  const res =
    await api.get<ApiResponse<MarketplaceStats>>("/marketplace/stats");
  return res.data;
}

/* =========================
   EXPORT OBJECT
========================= */

export const listingService = {
  getAll: getListings,
  getById: getListingById,
  create: listTicket,
  createIntent: createListingIntent,
  buyIntent: createBuyListingIntent,
  cancelIntent: createCancelListingIntent,
  confirmSold: confirmSoldTransaction,
  confirmCreated: confirmCreatedTransaction,
  confirmCancelled: confirmCancelledTransaction,
  buy: buyListing,
  listOnchain: listTicketOnchain,
  cancelOnchain: cancelListingOnchain,
  sendTransaction: sendMarketplaceTransaction,
  cancel: cancelListing,
  getStats: getMarketplaceStats,
};
