export interface MockAdminPlatformStats {
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

export interface MockAdminUser {
  _id: string;
  walletAddress: string;
  username: string;
  email: string;
  role: "admin" | "verifier" | "user";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const mockAdminPlatformStats: MockAdminPlatformStats = {
  users: {
    total: 12847,
    organizers: 2280,
    verifiers: 625,
    admins: 97,
  },
  events: {
    total: 1284,
    draft: 84,
    funding: 236,
    active: 456,
    completed: 472,
    cancelled: 36,
  },
  tickets: {
    total: 73580,
    sold: 45892,
    used: 32845,
    available: 27688,
  },
  listings: {
    total: 9642,
    active: 1984,
    sold: 7421,
  },
  revenue: {
    total: "1247.8",
    funding: "315.6",
  },
};

export const mockAdminSystemHealth = {
  database: {
    status: "healthy",
    connected: true,
  },
  services: {
    api: "operational",
  },
  timestamp: "2026-04-26T08:30:00.000Z",
};

export const mockAdminUsers: MockAdminUser[] = [
  {
    _id: "admin-001",
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
    username: "Linh Nguyen",
    email: "linh.nguyen@eventfund.io",
    role: "admin",
    isActive: true,
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-04-24T08:30:00.000Z",
  },
  {
    _id: "admin-002",
    walletAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    username: "Quang Tran",
    email: "quang.tran@eventfund.io",
    role: "admin",
    isActive: true,
    createdAt: "2026-02-10T10:20:00.000Z",
    updatedAt: "2026-04-25T13:10:00.000Z",
  },
  {
    _id: "admin-003",
    walletAddress: "0xDC25EF3F5B8A186998338A2aDA83795FBA2D695E",
    username: "An Pham",
    email: "an.pham@eventfund.io",
    role: "admin",
    isActive: true,
    createdAt: "2026-01-21T09:45:00.000Z",
    updatedAt: "2026-04-22T10:15:00.000Z",
  },
  {
    _id: "admin-004",
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    username: "Minh Bui",
    email: "minh.bui@eventfund.io",
    role: "admin",
    isActive: false,
    createdAt: "2025-12-19T07:15:00.000Z",
    updatedAt: "2026-04-12T11:00:00.000Z",
  },
  {
    _id: "verifier-001",
    walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    username: "Khoa Vo",
    email: "khoa.vo@eventfund.io",
    role: "verifier",
    isActive: true,
    createdAt: "2026-04-02T06:55:00.000Z",
    updatedAt: "2026-04-25T16:00:00.000Z",
  },
  {
    _id: "user-001",
    walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    username: "Thao Le",
    email: "thao.le@gmail.com",
    role: "user",
    isActive: true,
    createdAt: "2026-04-10T05:35:00.000Z",
    updatedAt: "2026-04-25T05:35:00.000Z",
  },
];

export const mockFraudMonitoringData = {
  stats: {
    activeAlerts: 5,
    resolvedToday: 16,
    blockedTransactions: 11,
    detectionRate: 98.9,
  },
  alerts: [
    {
      id: "AL-1001",
      type: "Suspicious Activity",
      severity: "high",
      user: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
      description: "Multiple ticket purchases from same wallet in 90 seconds",
      time: "8 minutes ago",
      status: "pending",
    },
    {
      id: "AL-1002",
      type: "Price Manipulation",
      severity: "medium",
      user: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      description: "Rapid relisting with 4x price increase detected",
      time: "27 minutes ago",
      status: "investigating",
    },
    {
      id: "AL-1003",
      type: "Fake Event Pattern",
      severity: "high",
      user: "0xDC25EF3F5B8A186998338A2aDA83795FBA2D695E",
      description: "Event metadata matches known phishing template",
      time: "1 hour ago",
      status: "pending",
    },
    {
      id: "AL-1004",
      type: "Multi-account Farming",
      severity: "medium",
      user: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      description: "Linked wallets claim rewards from same device fingerprint",
      time: "2 hours ago",
      status: "investigating",
    },
  ],
  blockedTransactions: [
    { wallet: "0x1111...2222", reason: "Blacklisted address", amountWei: "5000000000000000000", amountEth: 5, time: "15 min ago" },
    { wallet: "0x3333...4444", reason: "Suspected bot activity", amountWei: "12500000000000000000", amountEth: 12.5, time: "45 min ago" },
    { wallet: "0x5555...6666", reason: "Sanctions screening hit", amountWei: "2300000000000000000", amountEth: 2.3, time: "1 hour ago" },
    { wallet: "0x7777...8888", reason: "Failed KYC consistency check", amountWei: "3100000000000000000", amountEth: 3.1, time: "2 hours ago" },
  ],
};

export const mockFinanceDashboardData = {
  stats: {
    totalPlatformRevenueWei: "1247800000000000000000",
    ticketSalesRevenueWei: "982300000000000000000",
    marketplaceFeesWei: "215500000000000000000",
    pendingWithdrawalsWei: "50000000000000000000",
    totalPlatformRevenueEth: 1247.8,
    ticketSalesRevenueEth: 982.3,
    marketplaceFeesEth: 215.5,
    pendingWithdrawalsEth: 50,
  },
  monthlyRevenue: [
    { month: "Jan", ticket: 125, marketplace: 28, total: 153 },
    { month: "Feb", ticket: 142, marketplace: 32, total: 174 },
    { month: "Mar", ticket: 165, marketplace: 38, total: 203 },
    { month: "Apr", ticket: 189, marketplace: 42, total: 231 },
    { month: "May", ticket: 218, marketplace: 48, total: 266 },
    { month: "Jun", ticket: 235, marketplace: 55, total: 290 },
  ],
  categoryRevenue: [
    { category: "Music Events", revenue: 425.5, revenueWei: "425500000000000000000" },
    { category: "Tech Conferences", revenue: 312.8, revenueWei: "312800000000000000000" },
    { category: "Sports", revenue: 268.3, revenueWei: "268300000000000000000" },
    { category: "Art & Culture", revenue: 145.7, revenueWei: "145700000000000000000" },
    { category: "Other", revenue: 95.5, revenueWei: "95500000000000000000" },
  ],
  withdrawalRequests: [
    {
      id: "WR-001",
      organizer: "CryptoMusic Festival",
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595bEb5",
      amountWei: "15500000000000000000",
      amountEth: 15.5,
      date: "2026-04-20",
      status: "pending",
    },
    {
      id: "WR-002",
      organizer: "Tech Summit 2026",
      wallet: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      amountWei: "22300000000000000000",
      amountEth: 22.3,
      date: "2026-04-19",
      status: "pending",
    },
    {
      id: "WR-003",
      organizer: "NFT Art Gallery",
      wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      amountWei: "8700000000000000000",
      amountEth: 8.7,
      date: "2026-04-18",
      status: "approved",
    },
    {
      id: "WR-004",
      organizer: "Sports Arena Events",
      wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      amountWei: "18200000000000000000",
      amountEth: 18.2,
      date: "2026-04-17",
      status: "approved",
    },
    {
      id: "WR-005",
      organizer: "Comedy Night Live",
      wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      amountWei: "5500000000000000000",
      amountEth: 5.5,
      date: "2026-04-16",
      status: "completed",
    },
  ],
  summary: {
    totalProcessedWei: "1197800000000000000000",
    pendingApprovalWei: "37800000000000000000",
    platformFeeRatePercent: 2.5,
  },
};

export const mockAnalyticsDashboardData = {
  stats: {
    totalUsers: 12847,
    totalEvents: 1284,
    ticketsSold: 45892,
    marketplaceVolumeWei: "892000000000000000000",
    marketplaceVolumeEth: 892,
  },
  platformActivity: [
    { month: "Jan", users: 8250, events: 845, tickets: 28450 },
    { month: "Feb", users: 9120, events: 920, tickets: 31280 },
    { month: "Mar", users: 9850, events: 1005, tickets: 35670 },
    { month: "Apr", users: 10540, events: 1085, tickets: 38920 },
    { month: "May", users: 11280, events: 1158, tickets: 42150 },
    { month: "Jun", users: 12847, events: 1284, tickets: 45892 },
  ],
  userEngagement: [
    { day: "Mon", active: 4250, new: 320 },
    { day: "Tue", active: 4580, new: 380 },
    { day: "Wed", active: 5120, new: 420 },
    { day: "Thu", active: 4920, new: 350 },
    { day: "Fri", active: 5680, new: 520 },
    { day: "Sat", active: 6250, new: 680 },
    { day: "Sun", active: 5450, new: 450 },
  ],
  userTypeDistribution: [
    { name: "Regular Users", value: 9845 },
    { name: "Event Organizers", value: 2280 },
    { name: "Verifiers", value: 625 },
    { name: "Admins", value: 97 },
  ],
  topEvents: [
    {
      rank: 1,
      name: "CryptoMusic Festival 2026",
      organizer: "CryptoEvents Inc.",
      category: "Music",
      tickets: 8450,
      revenueEth: 185.5,
      attendees: 7820,
      rating: 4.8,
    },
    {
      rank: 2,
      name: "Web3 Tech Summit",
      organizer: "Tech Innovators",
      category: "Technology",
      tickets: 5680,
      revenueEth: 142.3,
      attendees: 5420,
      rating: 4.7,
    },
    {
      rank: 3,
      name: "NFT Art Expo",
      organizer: "Digital Art Gallery",
      category: "Art",
      tickets: 4250,
      revenueEth: 128.7,
      attendees: 4050,
      rating: 4.9,
    },
    {
      rank: 4,
      name: "Sports Championship Finals",
      organizer: "Sports Arena",
      category: "Sports",
      tickets: 7250,
      revenueEth: 115.2,
      attendees: 7100,
      rating: 4.6,
    },
    {
      rank: 5,
      name: "Blockchain Conference",
      organizer: "Crypto Foundation",
      category: "Technology",
      tickets: 3850,
      revenueEth: 98.5,
      attendees: 3650,
      rating: 4.5,
    },
  ],
  categoryPerformance: [
    { category: "Music", events: 425, tickets: 18450, revenue: 485.5 },
    { category: "Technology", events: 312, tickets: 12280, revenue: 358.2 },
    { category: "Sports", events: 268, tickets: 9850, revenue: 245.8 },
    { category: "Art", events: 185, tickets: 3680, revenue: 185.7 },
    { category: "Other", events: 94, tickets: 1632, revenue: 95.3 },
  ],
  insights: {
    avgTicketsPerEvent: 35.7,
    retentionRate: 78.5,
  },
};

export const mockPlatformSettingsData = {
  fees: {
    platformFee: "2.5",
    marketplaceFee: "1.5",
  },
  contractAddresses: {
    ticket: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    marketplace: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    payment: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  },
};
