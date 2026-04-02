import { api } from '../lib/api';

export interface ApiEvent {
  _id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  venue?: {
    name?: string;
    address?: string;
  };
}

export interface ApiTicket {
  _id?: string;
  tokenId: string;
  originalPrice?: string;
  ticketType?: string;
  status?: 'minted' | 'sold' | 'used' | 'expired';
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

function getAuthHeaders(): HeadersInit {
  const jwtToken = localStorage.getItem('jwtToken');
  return jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
}

function normalizeTicket(ticket: ApiTicket): ApiTicket {
  if (typeof ticket.eventId === 'object' && ticket.eventId?._id) {
    return {
      ...ticket,
      eventIdRaw: ticket.eventId._id,
    };
  }

  if (typeof ticket.eventId === 'string') {
    return {
      ...ticket,
      eventIdRaw: ticket.eventId,
    };
  }

  return ticket;
}

export async function getUserTickets(walletAddress: string): Promise<ApiTicket[]> {
  const payload = await api.get<TicketsResponse>(
    `/tickets/user/${walletAddress.toLowerCase()}?page=1&limit=100`,
  );

  return (payload.data?.docs || []).map(normalizeTicket);
}

export interface GetTicketsParams {
  eventId?: string;
  status?: 'minted' | 'sold' | 'used' | 'expired';
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

export async function getTickets(params: GetTicketsParams = {}): Promise<PaginatedTicketsResult> {
  const query = new URLSearchParams();

  if (params.eventId) query.set('eventId', params.eventId);
  if (params.status) query.set('status', params.status);
  if (params.owner) query.set('owner', params.owner.toLowerCase());
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  if (params.sort) query.set('sort', params.sort);

  const payload = await api.get<TicketsResponse>(`/tickets?${query.toString()}`);
  const data = payload.data;

  return {
    docs: (data?.docs || []).map(normalizeTicket),
    totalDocs: data?.totalDocs || 0,
    page: data?.page || 1,
    limit: data?.limit || params.limit || 20,
    totalPages: data?.totalPages || 0,
  };
}

export async function getTicketByTokenId(tokenId: string): Promise<ApiTicket | null> {
  const payload = await api.get<TicketDetailResponse>(`/tickets/${encodeURIComponent(tokenId)}`);
  return payload.data ? normalizeTicket(payload.data) : null;
}

export async function markTicketAsUsed(tokenId: string, eventId?: string): Promise<ApiTicket | null> {
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
