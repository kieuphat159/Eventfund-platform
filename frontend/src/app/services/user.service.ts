import { api } from "../lib/api";

export interface UserProfile {
  walletAddress: string;
  username?: string;
  email?: string;
  role: "user" | "verifier" | "admin";
  bio?: string;
  location?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface UserStats {
  eventsCreated: number;
  ticketsOwned: number;
  totalInvestments: string;
  memberSince: string;
}

export interface UserInvestment {
  _id: string;
  eventId: {
    _id: string;
    title: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  };
  contributionAmount: number;
  sharePercentage: number;
  claimedReward: number;
  pendingReward: number;
  shareTokenId?: string;
  createdAt: string;
}

function getAuthHeaders(): HeadersInit {
  const jwtToken = localStorage.getItem("jwtToken");
  return jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
}

export const userService = {
  // Calls UsersController.getProfile
  getProfile: async () => {
    const response = await api.get<{ success: boolean; data: UserProfile }>(
      "/users/profile",
      { headers: getAuthHeaders() },
    );
    return response.data;
  },

  // Calls UsersController.updateProfile (uses PATCH)
  updateProfile: async (data: Partial<UserProfile>) => {
    const response = await api.patch<{ success: boolean; data: UserProfile }>(
      "/users/profile",
      data,
      { headers: getAuthHeaders() },
    );
    return response.data;
  },

  // Aggregates data from UsersController.getUserPortfolio and TicketsController.getUserTickets
  getFullStats: async (walletAddress: string): Promise<UserStats> => {
    try {
      const authOptions = { headers: getAuthHeaders() };

      const [portfolioRes, ticketsRes, profileRes] = await Promise.all([
        api.get<{ success: boolean; data: any }>("/users/portfolio", authOptions),
        api.get<{ success: boolean; data: any }>(
          `/tickets/user/${walletAddress}`,
          authOptions,
        ),
        api.get<{ success: boolean; data: any }>("/users/profile", authOptions),
      ]);

      return {
        eventsCreated: portfolioRes.data?.eventsCount || 0,
        ticketsOwned: ticketsRes.data?.total || 0,
        totalInvestments: `${portfolioRes.data?.totalValue || 0} ETH`,
        memberSince: profileRes.data?.createdAt
          ? new Date(profileRes.data.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })
          : "N/A",
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return {
        eventsCreated: 0,
        ticketsOwned: 0,
        totalInvestments: "0 ETH",
        memberSince: "N/A",
      };
    }
  },

  // Calls UsersController.getUserShares
  getUserShares: async (): Promise<UserInvestment[]> => {
    const response = await api.get<{ success: boolean; data: UserInvestment[] }>(
      "/users/shares",
      { headers: getAuthHeaders() },
    );
    return response.data || [];
  },

  getUserInvestmentById: async (id: string): Promise<UserInvestment> => {
    const response = await api.get<{ success: boolean; data: UserInvestment }>(
      `/users/shares/${id}`,
      { headers: getAuthHeaders() },
    );
    return response.data;
  },
};