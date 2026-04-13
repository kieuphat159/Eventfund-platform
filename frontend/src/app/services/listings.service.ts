import { api } from "../lib/api";

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
  status?: string;
  minPrice?: string; // wei
  maxPrice?: string; // wei
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface MarketplaceStats {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  cancelledListings: number;
  totalVolume: string;
  averagePrice: string;
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

/* =========================
   SERVICES
========================= */

//  Get all listings (marketplace)
export async function getListings(params: GetListingsParams = {}) {
  const {
    eventId,
    status,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sortBy = "listedAt",
    sortOrder = "desc",
  } = params;

  const query = new URLSearchParams();

  if (eventId) query.append("eventId", eventId);
  if (status) query.append("status", status);
  if (minPrice) query.append("minPrice", minPrice);
  if (maxPrice) query.append("maxPrice", maxPrice);

  query.append("page", String(page));
  query.append("limit", String(limit));
  query.append("sortBy", sortBy);
  query.append("sortOrder", sortOrder);

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
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      "Failed to create listing";

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
  getStats: getMarketplaceStats,
};
