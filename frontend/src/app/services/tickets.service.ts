import { api } from '../lib/api';

export interface ApiEvent {
  title?: string;
  startDate?: string;
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
  eventId?: ApiEvent | string;
}

interface TicketsResponse {
  success: boolean;
  data?: {
    docs?: ApiTicket[];
  };
  message?: string;
}

export async function getUserTickets(walletAddress: string): Promise<ApiTicket[]> {
  const payload = await api.get<TicketsResponse>(
    `/tickets/user/${walletAddress.toLowerCase()}?page=1&limit=100`,
  );

  return payload.data?.docs || [];
}

export async function getTicketByTokenId(tokenId: string): Promise<ApiTicket> {
  const payload = await api.get<{ success: boolean; data?: ApiTicket; message?: string }>(
    `/tickets/token/${tokenId}`,
  );
  if (!payload.data) {
    throw new Error(payload.message || 'Failed to fetch ticket details');
  }
  return payload.data;
}