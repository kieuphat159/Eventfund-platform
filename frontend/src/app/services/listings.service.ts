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
export async function getListings(page = 1, limit = 20) {
  const res = await api.get<ApiResponse<Paginated<ApiListing>>>(
    `/marketplace/listings?page=${page}&limit=${limit}`,
  );

  return res.data;
}

export async function getListingById(id: string) {
  const res = await api.get<ApiResponse<ApiListing>>(
    `/marketplace/listings/${id}`,
  );

  return res.data;
}

/* =========================
   EXPORT OBJECT
========================= */

export const listingService = {
  getAll: getListings,
  getById: getListingById,
};
