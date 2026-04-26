import {
  mockAdminPlatformStats,
  mockAdminSystemHealth,
  mockAdminUsers,
  mockFraudMonitoringData,
  mockFinanceDashboardData,
  mockAnalyticsDashboardData,
} from "../data/adminMockData";
import { ApiError, api } from "../lib/api";

export type AdminUserRole = "user" | "verifier" | "admin";

export interface AdminPlatformStats {
  users: {
    total: number;
    organizers: number;
    verifiers: number;
    admins: number;
  };
  events: {
    total: number;
    draft: number;
    funding: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  tickets: {
    total: number;
    sold: number;
    used: number;
    available: number;
  };
  listings: {
    total: number;
    active: number;
    sold: number;
  };
  revenue: {
    total: string;
    funding: string;
  };
}

export interface AdminUserItem {
  _id: string;
  walletAddress: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  role: AdminUserRole;
  isActive?: boolean;
  smartAccountAddress?: string | null;
  chainId?: string | null;
  walletCreatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedAdminUsers {
  docs: AdminUserItem[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface AdminSystemHealth {
  database: {
    status: string;
    connected: boolean;
  };
  services: {
    api: string;
  };
  timestamp: string;
}

export interface AdminFraudAlert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  user: string;
  description: string;
  time: string;
  status: string;
  createdAt?: string;
}

export interface AdminBlockedTransaction {
  wallet: string;
  reason: string;
  amountWei: string;
  amountEth: number;
  time: string;
  createdAt?: string;
}

export interface AdminFraudOverview {
  stats: {
    activeAlerts: number;
    resolvedToday: number;
    blockedTransactions: number;
    detectionRate: number;
  };
  alerts: AdminFraudAlert[];
  blockedTransactions: AdminBlockedTransaction[];
  generatedAt?: string;
}

export interface AdminFinanceOverview {
  stats: {
    totalPlatformRevenueWei: string;
    ticketSalesRevenueWei: string;
    marketplaceFeesWei: string;
    pendingWithdrawalsWei: string;
    totalPlatformRevenueEth: number;
    ticketSalesRevenueEth: number;
    marketplaceFeesEth: number;
    pendingWithdrawalsEth: number;
  };
  monthlyRevenue: Array<{
    month: string;
    ticket: number;
    marketplace: number;
    total: number;
  }>;
  categoryRevenue: Array<{
    category: string;
    revenue: number;
    revenueWei: string;
  }>;
  withdrawalRequests: Array<{
    id: string;
    organizer: string;
    wallet: string;
    amountWei: string;
    amountEth: number;
    date?: string;
    status: "pending" | "approved" | "completed" | "rejected";
  }>;
  summary: {
    totalProcessedWei: string;
    pendingApprovalWei: string;
    platformFeeRatePercent: number;
  };
}

export interface AdminAnalyticsOverview {
  stats: {
    totalUsers: number;
    totalEvents: number;
    ticketsSold: number;
    marketplaceVolumeWei: string;
    marketplaceVolumeEth: number;
  };
  platformActivity: Array<{
    month: string;
    users: number;
    events: number;
    tickets: number;
  }>;
  userEngagement: Array<{
    day: string;
    active: number;
    new: number;
  }>;
  userTypeDistribution: Array<{
    name: string;
    value: number;
  }>;
  topEvents: Array<{
    rank: number;
    name: string;
    organizer: string;
    category: string;
    tickets: number;
    revenueEth: number;
    attendees: number;
    rating: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    events: number;
    tickets: number;
    revenue: number;
  }>;
  insights: {
    avgTicketsPerEvent: number;
    retentionRate: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

function shouldUseMockData(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 404;
  }

  return error instanceof TypeError;
}

function sortUsers(users: AdminUserItem[], sort?: string): AdminUserItem[] {
  if (!sort) return users;

  const direction = sort.startsWith("-") ? -1 : 1;
  const sortField = sort.replace(/^-/, "");

  if (sortField !== "createdAt") {
    return users;
  }

  return [...users].sort((a, b) => {
    const first = new Date(a.createdAt || 0).getTime();
    const second = new Date(b.createdAt || 0).getTime();
    return (first - second) * direction;
  });
}

function getMockUsers(params?: {
  role?: AdminUserRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}): PaginatedAdminUsers {
  let filteredUsers = [...mockAdminUsers] as AdminUserItem[];

  if (params?.role) {
    filteredUsers = filteredUsers.filter((user) => user.role === params.role);
  }

  if (typeof params?.isActive === "boolean") {
    filteredUsers = filteredUsers.filter((user) => user.isActive === params.isActive);
  }

  filteredUsers = sortUsers(filteredUsers, params?.sort);

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const totalDocs = filteredUsers.length;
  const totalPages = Math.max(Math.ceil(totalDocs / limit), 1);
  const startIndex = (page - 1) * limit;
  const docs = filteredUsers.slice(startIndex, startIndex + limit);

  return {
    docs,
    totalDocs,
    limit,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export async function getAdminPlatformStats(): Promise<AdminPlatformStats | null> {
  try {
    const response = await api.get<ApiResponse<AdminPlatformStats>>("/admin/stats");
    return response.data || null;
  } catch (error) {
    if (shouldUseMockData(error)) {
      return mockAdminPlatformStats as AdminPlatformStats;
    }

    throw error;
  }
}

export async function getAdminUsers(params?: {
  role?: AdminUserRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}): Promise<PaginatedAdminUsers | null> {
  const query = new URLSearchParams();

  if (params?.role) query.set("role", params.role);
  if (typeof params?.isActive === "boolean") {
    query.set("isActive", String(params.isActive));
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sort) query.set("sort", params.sort);

  const url = query.toString()
    ? `/admin/users?${query.toString()}`
    : "/admin/users";
  try {
    const response = await api.get<ApiResponse<PaginatedAdminUsers>>(url);
    return response.data || null;
  } catch (error) {
    if (shouldUseMockData(error)) {
      return getMockUsers(params);
    }

    throw error;
  }
}

export async function updateAdminUserRole(
  walletAddress: string,
  role: AdminUserRole,
): Promise<AdminUserItem | null> {
  const response = await api.patch<ApiResponse<AdminUserItem>>(
    `/admin/users/${walletAddress}/role`,
    { role },
  );
  return response.data || null;
}

export async function deleteAdminUser(walletAddress: string): Promise<boolean> {
  await api.delete(`/admin/users/${walletAddress}`);
  return true;
}

export async function getAdminSystemHealth(): Promise<AdminSystemHealth | null> {
  try {
    const response = await api.get<ApiResponse<AdminSystemHealth>>("/admin/health");
    return response.data || null;
  } catch (error) {
    if (shouldUseMockData(error)) {
      return mockAdminSystemHealth as AdminSystemHealth;
    }

    throw error;
  }
}

export async function getAdminFraudOverview(): Promise<AdminFraudOverview | null> {
  try {
    const response = await api.get<ApiResponse<AdminFraudOverview>>("/admin/fraud/overview");
    return response.data || null;
  } catch (error) {
    if (shouldUseMockData(error)) {
      return mockFraudMonitoringData as AdminFraudOverview;
    }

    throw error;
  }
}

export async function getAdminFinanceOverview(): Promise<AdminFinanceOverview | null> {
  try {
    const response = await api.get<ApiResponse<AdminFinanceOverview>>("/admin/finance/overview");
    return response.data || null;
  } catch (error) {
    if (shouldUseMockData(error)) {
      return mockFinanceDashboardData as AdminFinanceOverview;
    }

    throw error;
  }
}

export async function getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview | null> {
  try {
    const response = await api.get<ApiResponse<AdminAnalyticsOverview>>("/admin/analytics/overview");
    return response.data || null;
  } catch (error) {
    if (shouldUseMockData(error)) {
      return mockAnalyticsDashboardData as AdminAnalyticsOverview;
    }

    throw error;
  }
}
