import { api } from "../lib/api";
import { logger } from "../lib/logger";

type ShareLike = {
  contributionAmount?: string | number | bigint | null;
};

function parseBigInt(
  value: string | number | bigint | null | undefined,
): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^-?\d+$/.test(normalized)) {
      try {
        return BigInt(normalized);
      } catch {
        return 0n;
      }
    }
  }

  return 0n;
}

function extractShares(payload: any): ShareLike[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.docs)) return payload.docs;
  return [];
}

function formatWei(wei: bigint): string {
  const raw = wei.toString();
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped} wei`;
}

function formatWeiToEth(wei: bigint): string {
  const negative = wei < 0n;
  const absolute = negative ? -wei : wei;
  const weiPerEth = 10n ** 18n;
  const minEthDisplayWei = 10n ** 12n; // < 0.000001 ETH -> keep wei for readability

  if (absolute > 0n && absolute < minEthDisplayWei) {
    return formatWei(wei);
  }

  const whole = absolute / weiPerEth;
  const fraction = (absolute % weiPerEth)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "")
    .slice(0, 6);

  const ethValue = fraction
    ? `${whole.toString()}.${fraction}`
    : whole.toString();
  return `${negative ? "-" : ""}${ethValue} ETH`;
}

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
  contributionAmount: string;
  sharePercentage: number;
  claimedReward: string;
  pendingReward: string;
  shareTokenId?: string;
  createdAt: string;
}

export interface UserRewardItem {
  eventId?:
    | {
        _id?: string;
        title?: string;
      }
    | string;
  eventTitle?: string;
  rewardAmount: string;
  claimedAt?: string;
  txHash?: string;
  sharePercentage?: number;
}

export interface UserRewardsSummary {
  claimed: UserRewardItem[];
  pending: UserRewardItem[];
  totalClaimed: string;
  totalPending: string;
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
        api.get<{ success: boolean; data: any }>(
          "/users/portfolio",
          authOptions,
        ),
        api.get<{ success: boolean; data: any }>(
          `/tickets/user/${walletAddress}`,
          authOptions,
        ),
        api.get<{ success: boolean; data: any }>("/users/profile", authOptions),
      ]);

      const shares = extractShares(portfolioRes.data?.shares);
      const totalInvestmentWei = shares.reduce((sum, share) => {
        return sum + parseBigInt(share?.contributionAmount);
      }, 0n);

      return {
        eventsCreated: portfolioRes.data?.eventsCount || 0,
        ticketsOwned: ticketsRes.data?.total || 0,
        totalInvestments: formatWeiToEth(totalInvestmentWei),
        memberSince: profileRes.data?.createdAt
          ? new Date(profileRes.data.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })
          : "N/A",
      };
    } catch (error) {
      logger.error("user", "Failed to fetch dashboard stats", error);
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
    const response = await api.get<{
      success: boolean;
      data: UserInvestment[];
    }>("/users/shares", { headers: getAuthHeaders() });
    return response.data || [];
  },

  getUserInvestmentById: async (id: string): Promise<UserInvestment> => {
    const response = await api.get<{ success: boolean; data: UserInvestment }>(
      `/users/shares/${id}`,
      { headers: getAuthHeaders() },
    );
    return response.data;
  },

  getUserRewards: async (): Promise<UserRewardsSummary> => {
    const response = await api.get<{
      success: boolean;
      data: UserRewardsSummary;
    }>("/users/rewards", {
      headers: getAuthHeaders(),
    });

    return (
      response.data || {
        claimed: [],
        pending: [],
        totalClaimed: "0",
        totalPending: "0",
      }
    );
  },
};
