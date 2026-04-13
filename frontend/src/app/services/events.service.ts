import { api } from '../lib/api';

export interface EventVenue {
  name?: string;
  address?: string;
}

export interface EventTicketTier {
  name: string;
  price: number;
  totalSupply: number;
  benefits?: string[];
}

export type EventStatus =
  | 'draft'
  | 'funding'
  | 'funded'
  | 'ticketing'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface EventItem {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: EventStatus;

  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;

  organizer?: string;
  organizerWallet?: string;

  venue?: EventVenue;
  imageUrls?: string[];

  fundingGoal?: string | number;
  currentFunding?: string | number;
  minStakeRequired?: string | number;
  fundingDeadline?: string;

  totalTickets?: number;
  ticketsSold?: number;
  totalTicketsUsed?: number;
  ticketUsageThreshold?: number;

  ticketTiers?: EventTicketTier[];
  adminSummary?: {
    investorCount?: number;
  };
}

export interface PaginatedEventsData {
  docs?: EventItem[];
  events?: EventItem[];
  totalDocs?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
}

export interface EventsResponse {
  success: boolean;
  data?: PaginatedEventsData | EventItem[];
  message?: string;
}

export interface EventDetailResponse {
  success: boolean;
  data?: EventItem;
  message?: string;
}

export interface CreateEventPayload {
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  venue: {
    name?: string;
    address: string;
  };
  fundingGoal: string;
  fundingDeadline: string;
  totalTickets: number;

  minStakeRequired?: string;
  ticketTiers?: EventTicketTier[];
  imageUrls?: string[];
}

export interface UpdateEventPayload {
  title?: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  venue?: {
    name?: string;
    address?: string;
  };
  fundingGoal?: string;
  fundingDeadline?: string;
  totalTickets?: number;
  minStakeRequired?: string;
  ticketTiers?: EventTicketTier[];
  imageUrls?: string[];
  status?: EventStatus;
}

export interface CreateEventResponse {
  success: boolean;
  data?: EventItem;
  message?: string;
}

export interface EventInvestmentItem {
  _id: string;
  eventId: string;
  holder: string;
  contributionAmount: number;
  sharePercentage: number;
  claimedReward: number;
  pendingReward: number;
  shareTokenId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminEventInvestmentsData {
  docs: EventInvestmentItem[];
  totalDocs?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
  event?: Pick<EventItem, '_id' | 'title' | 'status' | 'fundingGoal' | 'currentFunding'>;
  summary?: {
    totalInvestors?: number;
    totalInvested?: number;
    averageInvestment?: number;
    largestInvestment?: number;
    contributionCount?: number;
  };
}

interface AdminEventInvestmentsResponse {
  success: boolean;
  data?: AdminEventInvestmentsData;
  message?: string;
}

function normalizeEvents(data?: PaginatedEventsData | EventItem[]): EventItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.docs)) return data.docs;
  if (Array.isArray(data.events)) return data.events;
  return [];
}

export async function getEvents(params?: {
  status?: EventStatus;
  category?: string;
  organizer?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<EventItem[]> {
  const query = new URLSearchParams();

  if (params?.status) query.set('status', params.status);
  if (params?.category) query.set('category', params.category);
  if (params?.organizer) query.set('organizer', params.organizer);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);

  const url = query.toString() ? `/events?${query.toString()}` : '/events';
  const payload = await api.get<EventsResponse>(url);

  return normalizeEvents(payload.data);
}

export async function getEventById(eventId: string): Promise<EventItem | null> {
  const payload = await api.get<EventDetailResponse>(`/events/${eventId}`);
  return payload.data || null;
}

export async function getMyEvents(walletAddress: string): Promise<EventItem[]> {
  if (!walletAddress) return [];
  return getEvents({ organizer: walletAddress });
}

export async function getAdminEvents(params?: {
  status?: EventStatus;
  category?: string;
  organizer?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<EventItem[]> {
  try {
    const query = new URLSearchParams();

    if (params?.status) query.set('status', params.status);
    if (params?.category) query.set('category', params.category);
    if (params?.organizer) query.set('organizer', params.organizer);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);

    const url = query.toString() ? `/admin/events?${query.toString()}` : '/admin/events';
    const payload = await api.get<EventsResponse>(url);

    return normalizeEvents(payload.data);
  } catch {
    const payload = await api.get<EventsResponse>('/events');
    return normalizeEvents(payload.data);
  }
}

export async function getAdminEventById(eventId: string): Promise<EventItem | null> {
  const payload = await api.get<EventDetailResponse>(`/admin/events/${eventId}`);
  return payload.data || null;
}

export async function createEvent(payload: CreateEventPayload): Promise<EventItem | null> {
  try {
    const response = await api.post<CreateEventResponse>('/events', payload);
    return response.data || null;
  } catch (error) {
    console.error('createEvent failed:', error);
    throw error;
  }
}

export async function updateEvent(
  eventId: string,
  payload: UpdateEventPayload
): Promise<EventItem | null> {
  const response = await api.patch<CreateEventResponse>(`/events/${eventId}`, payload);
  return response.data || null;
}

export async function updateAdminEvent(
  eventId: string,
  payload: UpdateEventPayload
): Promise<EventItem | null> {
  const response = await api.patch<CreateEventResponse>(`/admin/events/${eventId}`, payload);
  return response.data || null;
}

export async function updateAdminEventStatus(
  eventId: string,
  status: EventStatus
): Promise<EventItem | null> {
  const response = await api.patch<CreateEventResponse>(
    `/admin/events/${eventId}/status`,
    { status }
  );
  return response.data || null;
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  await api.delete(`/events/${eventId}`);
  return true;
}

export async function getEventStats(eventId: string) {
  return api.get(`/events/${eventId}/stats`);
}

export async function getAdminEventInvestments(
  eventId: string,
  params?: {
    page?: number;
    limit?: number;
    sort?: 'createdAt' | '-createdAt' | 'contributionAmount' | '-contributionAmount';
  }
): Promise<AdminEventInvestmentsData | null> {
  const query = new URLSearchParams();

  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.sort) query.set('sort', params.sort);

  const url = query.toString()
    ? `/admin/events/${eventId}/investments?${query.toString()}`
    : `/admin/events/${eventId}/investments`;

  const response = await api.get<AdminEventInvestmentsResponse>(url);
  return response.data || null;
}

export async function deleteEventImage(eventId: string, imageUrl: string): Promise<boolean> {
  await api.delete(`/events/${eventId}/images/${encodeURIComponent(imageUrl)}`);
  return true;
}
