export type UserRole = 'public' | 'user' | 'verifier' | 'admin';

export interface User {
  walletAddress?: string;
  smartAccountAddress?: string;
  role: UserRole;
  name?: string;
  email?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  location: string;
  category: string;
  organizer: string;
  organizerWallet: string;
  ticketTiers: TicketTier[];
  status: 'pending' | 'approved' | 'rejected';
  investmentEnabled: boolean;
  totalRevenue: number;
  ticketsSold: number;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  available: number;
  total: number;
  benefits: string[];
}

export interface NFTTicket {
  id: string;
  eventId: string;
  eventName: string;
  tier: string;
  price: number;
  owner: string;
  qrCode: string;
  metadata: Record<string, any>;
  image: string;
}

export interface MarketplaceListing {
  id: string;
  ticketId: string;
  eventName: string;
  tier: string;
  price: number;
  seller: string;
  image: string;
}

export interface Investment {
  id: string;
  eventId: string;
  eventName: string;
  amount: number;
  roi: number;
  status: 'active' | 'completed';
  returns: number;
}
