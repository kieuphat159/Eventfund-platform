import { api } from '../lib/api';

export interface EventVenue {
  name?: string;
  address?: string;
}

export interface EventTicketTier {
  name?: string;
  price?: string | number;
  totalSupply?: number;
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

  organizer?: string;
  organizerWallet?: string;

  venue?: EventVenue;
  imageUrls?: string[];

  fundingGoal?: string;
  minStakeRequired?: string;
  fundingDeadline?: string;

  totalTickets?: number;
  ticketsSold?: number;
  totalTicketsUsed?: number;
  ticketUsageThreshold?: number;

  ticketTiers?: EventTicketTier[];
}

interface PaginatedEventsData {
  docs?: EventItem[];
  events?: EventItem[];
  totalDocs?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
}

interface EventsResponse {
  success: boolean;
  data?: PaginatedEventsData | EventItem[];
  message?: string;
}

interface EventDetailResponse {
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

  // backend route/swagger đang yêu cầu các field này
  fundingGoal: string;
  minStakeRequired?: string;
  fundingDeadline: string;
  totalTickets: number;

  // field này chưa thấy backend service xử lý rõ, nhưng FE vẫn có thể gửi nếu validator cho phép
  ticketTiers?: {
    name: string;
    price: number;
    totalSupply: number;
  }[];

  imageUrls?: string[];
}

interface CreateEventResponse {
  success: boolean;
  data?: EventItem;
  message?: string;
}

export async function getEvents(): Promise<EventItem[]> {
  const payload = await api.get<EventsResponse>('/events');

  if (Array.isArray(payload.data)) return payload.data;
  return payload.data?.docs || payload.data?.events || [];
}

export async function getEventById(eventId: string): Promise<EventItem | null> {
  const payload = await api.get<EventDetailResponse>(`/events/${eventId}`);
  return payload.data || null;
}

export async function getAdminEvents(): Promise<EventItem[]> {
  // fallback nếu BE chưa có /admin/events
  try {
    const payload = await api.get<EventsResponse>('/admin/events');
    if (Array.isArray(payload.data)) return payload.data;
    return payload.data?.docs || payload.data?.events || [];
  } catch {
    const payload = await api.get<EventsResponse>('/events');
    if (Array.isArray(payload.data)) return payload.data;
    return payload.data?.docs || payload.data?.events || [];
  }
}

export async function createEvent(payload: CreateEventPayload): Promise<EventItem | null> {
  const response = await api.post<CreateEventResponse>('/events', payload);
  return response.data || null;
}