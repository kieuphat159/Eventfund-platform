import { api } from "../lib/api";
import { ApiError } from "../lib/api";

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

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export type BuyListingProgressStage =
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

  if (!payload.price || Number(payload.price) <= 0) {
    throw new Error("Price must be greater than 0");
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

export async function confirmSoldTransaction(payload: ConfirmSoldPayload) {
  if (!payload.txHash?.trim()) {
    throw new Error("Transaction hash is required");
  }

  const res = await api.post<IntentResponse<ConfirmSoldData>>(
    "/marketplace/listings/confirm-sold",
    payload,
  );

  return res.data || null;
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

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: transaction.to,
        data: transaction.data,
        value: toHexValue(transaction.value || "0"),
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
  buy: buyListing,
  sendTransaction: sendMarketplaceTransaction,
  cancel: cancelListing,
  getStats: getMarketplaceStats,
};
