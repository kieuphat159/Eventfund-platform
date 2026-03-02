import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/database.js";

import User from "../models/User.model.js";
import Event from "../models/Event.model.js";
import Ticket from "../models/Ticket.model.js";
import Contribution from "../models/Contribution.model.js";
import Listing from "../models/Listing.model.js";
import Share from "../models/Share.model.js";
import Penalty from "../models/Penalty.model.js";
import RevenueDistribution from "../models/RevenueDistribution.model.js";
import RewardClaim from "../models/RewardClaim.model.js";
import BlockchainSyncState from "../models/BlockchainSyncState.model.js";

// ─────────────────────────────────────────────
// Helper: generate deterministic ObjectIds
// ─────────────────────────────────────────────
const oid = (index) =>
  new mongoose.Types.ObjectId(index.toString(16).padStart(24, "0"));

// Pre-generate IDs for referential integrity
const userIds = Array.from({ length: 8 }, (_, i) => oid(i + 1));
const eventIds = Array.from({ length: 4 }, (_, i) => oid(100 + i));
const ticketIds = Array.from({ length: 12 }, (_, i) => oid(200 + i));
const contributionIds = Array.from({ length: 8 }, (_, i) => oid(300 + i));
const listingIds = Array.from({ length: 4 }, (_, i) => oid(400 + i));
const shareIds = Array.from({ length: 6 }, (_, i) => oid(500 + i));
const penaltyIds = Array.from({ length: 2 }, (_, i) => oid(600 + i));
const distributionIds = Array.from({ length: 3 }, (_, i) => oid(700 + i));
const rewardClaimIds = Array.from({ length: 4 }, (_, i) => oid(800 + i));
const syncStateIds = Array.from({ length: 3 }, (_, i) => oid(900 + i));

// ─────────────────────────────────────────────
// Wallet addresses
// ─────────────────────────────────────────────
const wallets = {
  admin: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  organizer1: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  organizer2: "0xcccccccccccccccccccccccccccccccccccccccc",
  verifier1: "0xdddddddddddddddddddddddddddddddddddddddd",
  user1: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  user2: "0xffffffffffffffffffffffffffffffffffffffff",
  user3: "0x1111111111111111111111111111111111111111",
  user4: "0x2222222222222222222222222222222222222222",
};

// ─────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────
const now = new Date();
const inDays = (d) => new Date(now.getTime() + d * 86_400_000);

// ─────────────────────────────────────────────
// 1. Users
// ─────────────────────────────────────────────
const users = [
  {
    _id: userIds[0],
    walletAddress: wallets.admin,
    username: "PlatformAdmin",
    email: "admin@eventfund.io",
    avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=admin",
    role: "admin",
    nonce: "nonce_admin_abc123",
  },
  {
    _id: userIds[1],
    walletAddress: wallets.organizer1,
    username: "MusicFestOrg",
    email: "organizer1@eventfund.io",
    avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=org1",
    role: "organizer",
    nonce: "nonce_org1_def456",
  },
  {
    _id: userIds[2],
    walletAddress: wallets.organizer2,
    username: "TechConfOrg",
    email: "organizer2@eventfund.io",
    avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=org2",
    role: "organizer",
    nonce: "nonce_org2_ghi789",
  },
  {
    _id: userIds[3],
    walletAddress: wallets.verifier1,
    username: "GateVerifier",
    email: "verifier@eventfund.io",
    avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=verifier",
    role: "verifier",
    nonce: "nonce_verifier_jkl012",
  },
  {
    _id: userIds[4],
    walletAddress: wallets.user1,
    username: "Alice",
    email: "alice@example.com",
    role: "user",
    nonce: "nonce_user1_mno345",
  },
  {
    _id: userIds[5],
    walletAddress: wallets.user2,
    username: "Bob",
    email: "bob@example.com",
    role: "user",
    nonce: "nonce_user2_pqr678",
  },
  {
    _id: userIds[6],
    walletAddress: wallets.user3,
    username: "Charlie",
    email: "charlie@example.com",
    role: "user",
    nonce: "nonce_user3_stu901",
  },
  {
    _id: userIds[7],
    walletAddress: wallets.user4,
    username: "Diana",
    email: "diana@example.com",
    role: "user",
    nonce: "nonce_user4_vwx234",
  },
];

// ─────────────────────────────────────────────
// 2. Events
// ─────────────────────────────────────────────
const events = [
  // Event 0 — completed, revenue distributed
  {
    _id: eventIds[0],
    contractEventId: "EVT-0001",
    title: "Saigon Music Festival 2026",
    description:
      "The largest outdoor music festival in Ho Chi Minh City featuring top Vietnamese and international artists.",
    category: "Music",
    organizer: wallets.organizer1,
    organizerStake: 5,
    minStakeRequired: 2,
    fundingGoal: 50,
    currentFunding: 55,
    fundingDeadline: inDays(-60),
    status: "completed",
    startDate: inDays(-30),
    endDate: inDays(-28),
    venue: "Phu Tho Indoor Stadium, HCMC",
    imageUrls: [
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3",
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
    ],
    metadataUri: "ipfs://QmSaigonMusicFest2026metadata",
    totalTickets: 500,
    ticketsSold: 480,
    totalTicketsUsed: 460,
    ticketUsageThreshold: 80,
    escrowStatus: "released",
    totalRevenue: 24,
    revenueDistributedAt: inDays(-25),
  },
  // Event 1 — ongoing / ticketing
  {
    _id: eventIds[1],
    contractEventId: "EVT-0002",
    title: "Vietnam Tech Summit 2026",
    description:
      "A two-day conference covering AI, blockchain, and cloud-native development.",
    category: "Technology",
    organizer: wallets.organizer2,
    organizerStake: 3,
    minStakeRequired: 1,
    fundingGoal: 30,
    currentFunding: 32,
    fundingDeadline: inDays(-20),
    status: "ticketing",
    startDate: inDays(10),
    endDate: inDays(12),
    venue: "GEM Center, District 1, HCMC",
    imageUrls: ["https://images.unsplash.com/photo-1540575467063-178a50a8a468"],
    metadataUri: "ipfs://QmVietnamTechSummit2026",
    totalTickets: 300,
    ticketsSold: 120,
    totalTicketsUsed: 0,
    ticketUsageThreshold: 70,
    escrowStatus: "holding",
    totalRevenue: 6,
  },
  // Event 2 — funding phase
  {
    _id: eventIds[2],
    contractEventId: "EVT-0003",
    title: "Dalat Indie Film Screening",
    description:
      "Screening of award-winning Vietnamese indie short films in the highland city.",
    category: "Film",
    organizer: wallets.organizer1,
    organizerStake: 2,
    minStakeRequired: 1,
    fundingGoal: 15,
    currentFunding: 6,
    fundingDeadline: inDays(15),
    status: "funding",
    startDate: inDays(45),
    endDate: inDays(46),
    venue: "Dalat Palace Heritage Hotel",
    imageUrls: [],
    metadataUri: "ipfs://QmDalatIndieFilm2026",
    totalTickets: 100,
    ticketsSold: 0,
    totalTicketsUsed: 0,
    ticketUsageThreshold: 60,
    escrowStatus: "holding",
    totalRevenue: 0,
  },
  // Event 3 — cancelled (penalty applied)
  {
    _id: eventIds[3],
    contractEventId: "EVT-0004",
    title: "Hanoi Startup Pitch Night",
    description:
      "An evening of startup pitches cancelled due to organizer withdrawal.",
    category: "Business",
    organizer: wallets.organizer2,
    organizerStake: 4,
    minStakeRequired: 2,
    fundingGoal: 20,
    currentFunding: 18,
    fundingDeadline: inDays(-40),
    status: "cancelled",
    startDate: inDays(-10),
    endDate: inDays(-10),
    venue: "National Convention Center, Hanoi",
    imageUrls: [],
    metadataUri: "ipfs://QmHanoiStartupPitch",
    totalTickets: 200,
    ticketsSold: 60,
    totalTicketsUsed: 0,
    ticketUsageThreshold: 75,
    escrowStatus: "refunded",
    totalRevenue: 0,
  },
];

// ─────────────────────────────────────────────
// 3. Tickets
// ─────────────────────────────────────────────
const tickets = [
  // ── Event 0 tickets (completed event) ──
  {
    _id: ticketIds[0],
    tokenId: "TKT-0001",
    eventId: eventIds[0],
    currentOwner: wallets.user1,
    originalPrice: 0.05,
    ticketType: "vip",
    metadataUri: "ipfs://QmTicket0001",
    status: "used",
    soldAt: inDays(-35),
    usedAt: inDays(-30),
    usedTxHash:
      "0xaaa1111111111111111111111111111111111111111111111111111111111111",
    verifiedBy: wallets.verifier1,
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user1,
        txHash: "0xmint0001",
        timestamp: inDays(-40),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[1],
    tokenId: "TKT-0002",
    eventId: eventIds[0],
    currentOwner: wallets.user2,
    originalPrice: 0.05,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket0002",
    status: "used",
    soldAt: inDays(-34),
    usedAt: inDays(-29),
    usedTxHash:
      "0xaaa2222222222222222222222222222222222222222222222222222222222222",
    verifiedBy: wallets.verifier1,
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user2,
        txHash: "0xmint0002",
        timestamp: inDays(-38),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[2],
    tokenId: "TKT-0003",
    eventId: eventIds[0],
    currentOwner: wallets.user3,
    originalPrice: 0.05,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket0003",
    status: "used",
    soldAt: inDays(-33),
    usedAt: inDays(-30),
    usedTxHash:
      "0xaaa3333333333333333333333333333333333333333333333333333333333333",
    verifiedBy: wallets.verifier1,
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user3,
        txHash: "0xmint0003",
        timestamp: inDays(-37),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[3],
    tokenId: "TKT-0004",
    eventId: eventIds[0],
    currentOwner: wallets.user4,
    originalPrice: 0.03,
    ticketType: "early_bird",
    metadataUri: "ipfs://QmTicket0004",
    status: "used",
    soldAt: inDays(-36),
    usedAt: inDays(-28),
    usedTxHash:
      "0xaaa4444444444444444444444444444444444444444444444444444444444444",
    verifiedBy: wallets.verifier1,
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user4,
        txHash: "0xmint0004",
        timestamp: inDays(-42),
        price: 0.03,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[4],
    tokenId: "TKT-0005",
    eventId: eventIds[0],
    currentOwner: wallets.user2,
    originalPrice: 0.05,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket0005",
    status: "expired",
    soldAt: inDays(-35),
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user2,
        txHash: "0xmint0005",
        timestamp: inDays(-38),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  // ── Event 1 tickets (ticketing phase) ──
  {
    _id: ticketIds[5],
    tokenId: "TKT-1001",
    eventId: eventIds[1],
    currentOwner: wallets.user1,
    originalPrice: 0.05,
    ticketType: "vip",
    metadataUri: "ipfs://QmTicket1001",
    status: "sold",
    soldAt: inDays(-5),
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user1,
        txHash: "0xmint1001",
        timestamp: inDays(-5),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[6],
    tokenId: "TKT-1002",
    eventId: eventIds[1],
    currentOwner: wallets.user3,
    originalPrice: 0.05,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket1002",
    status: "sold",
    soldAt: inDays(-4),
    isListed: true,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user3,
        txHash: "0xmint1002",
        timestamp: inDays(-4),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[7],
    tokenId: "TKT-1003",
    eventId: eventIds[1],
    currentOwner: wallets.user4,
    originalPrice: 0.05,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket1003",
    status: "sold",
    soldAt: inDays(-3),
    isListed: true,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user4,
        txHash: "0xmint1003",
        timestamp: inDays(-3),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[8],
    tokenId: "TKT-1004",
    eventId: eventIds[1],
    currentOwner: wallets.user2,
    originalPrice: 0.05,
    ticketType: "early_bird",
    metadataUri: "ipfs://QmTicket1004",
    status: "sold",
    soldAt: inDays(-6),
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user2,
        txHash: "0xmint1004",
        timestamp: inDays(-6),
        price: 0.05,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[9],
    tokenId: "TKT-1005",
    eventId: eventIds[1],
    currentOwner: wallets.user1,
    originalPrice: 0.05,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket1005",
    status: "sold",
    soldAt: inDays(-2),
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user2,
        txHash: "0xmint1005",
        timestamp: inDays(-3),
        price: 0.05,
        type: "mint",
      },
      {
        from: wallets.user2,
        to: wallets.user1,
        txHash: "0xresale1005",
        timestamp: inDays(-2),
        price: 0.06,
        type: "resale",
      },
    ],
  },
  // ── Event 3 tickets (cancelled — expired) ──
  {
    _id: ticketIds[10],
    tokenId: "TKT-3001",
    eventId: eventIds[3],
    currentOwner: wallets.user1,
    originalPrice: 0.04,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket3001",
    status: "expired",
    soldAt: inDays(-45),
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user1,
        txHash: "0xmint3001",
        timestamp: inDays(-45),
        price: 0.04,
        type: "mint",
      },
    ],
  },
  {
    _id: ticketIds[11],
    tokenId: "TKT-3002",
    eventId: eventIds[3],
    currentOwner: wallets.user2,
    originalPrice: 0.04,
    ticketType: "standard",
    metadataUri: "ipfs://QmTicket3002",
    status: "expired",
    soldAt: inDays(-44),
    isListed: false,
    transferHistory: [
      {
        from: "0x0000000000000000000000000000000000000000",
        to: wallets.user2,
        txHash: "0xmint3002",
        timestamp: inDays(-44),
        price: 0.04,
        type: "mint",
      },
    ],
  },
];

// ─────────────────────────────────────────────
// 4. Contributions
// ─────────────────────────────────────────────
const contributions = [
  // Event 0 — organizer stake
  {
    _id: contributionIds[0],
    eventId: eventIds[0],
    contributor: wallets.organizer1,
    type: "organizer_stake",
    amount: 5,
    sharePercentage: 40,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000001",
    blockNumber: 1_000_001,
    timestamp: inDays(-65),
    status: "confirmed",
  },
  // Event 0 — donator contributions
  {
    _id: contributionIds[1],
    eventId: eventIds[0],
    contributor: wallets.user1,
    type: "donator_contribution",
    amount: 25,
    sharePercentage: 30,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000002",
    blockNumber: 1_000_010,
    timestamp: inDays(-63),
    status: "confirmed",
  },
  {
    _id: contributionIds[2],
    eventId: eventIds[0],
    contributor: wallets.user2,
    type: "donator_contribution",
    amount: 25,
    sharePercentage: 30,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000003",
    blockNumber: 1_000_020,
    timestamp: inDays(-62),
    status: "confirmed",
  },
  // Event 1 — organizer stake
  {
    _id: contributionIds[3],
    eventId: eventIds[1],
    contributor: wallets.organizer2,
    type: "organizer_stake",
    amount: 3,
    sharePercentage: 35,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000004",
    blockNumber: 1_001_001,
    timestamp: inDays(-25),
    status: "confirmed",
  },
  {
    _id: contributionIds[4],
    eventId: eventIds[1],
    contributor: wallets.user3,
    type: "donator_contribution",
    amount: 15,
    sharePercentage: 32.5,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000005",
    blockNumber: 1_001_010,
    timestamp: inDays(-23),
    status: "confirmed",
  },
  {
    _id: contributionIds[5],
    eventId: eventIds[1],
    contributor: wallets.user4,
    type: "donator_contribution",
    amount: 14,
    sharePercentage: 32.5,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000006",
    blockNumber: 1_001_015,
    timestamp: inDays(-22),
    status: "confirmed",
  },
  // Event 2 — funding phase, partial contributions
  {
    _id: contributionIds[6],
    eventId: eventIds[2],
    contributor: wallets.organizer1,
    type: "organizer_stake",
    amount: 2,
    sharePercentage: 0,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000007",
    blockNumber: 1_002_001,
    timestamp: inDays(-5),
    status: "confirmed",
  },
  {
    _id: contributionIds[7],
    eventId: eventIds[2],
    contributor: wallets.user1,
    type: "donator_contribution",
    amount: 4,
    sharePercentage: 0,
    txHash:
      "0xcontrib000000000000000000000000000000000000000000000000000000008",
    blockNumber: 1_002_005,
    timestamp: inDays(-3),
    status: "pending",
  },
];

// ─────────────────────────────────────────────
// 5. Listings (marketplace)
// ─────────────────────────────────────────────
const listings = [
  // Active listing — event 1
  {
    _id: listingIds[0],
    ticketId: ticketIds[6], // TKT-1002
    tokenId: "TKT-1002",
    eventId: eventIds[1],
    seller: wallets.user3,
    price: 0.07,
    maxPrice: 0.1,
    status: "active",
    txHash:
      "0xlist000000000000000000000000000000000000000000000000000000000001",
    expiresAt: inDays(7),
  },
  // Active listing — event 1
  {
    _id: listingIds[1],
    ticketId: ticketIds[7], // TKT-1003
    tokenId: "TKT-1003",
    eventId: eventIds[1],
    seller: wallets.user4,
    price: 0.06,
    maxPrice: 0.1,
    status: "active",
    txHash:
      "0xlist000000000000000000000000000000000000000000000000000000000002",
    expiresAt: inDays(5),
  },
  // Sold listing — event 0 (historical)
  {
    _id: listingIds[2],
    ticketId: ticketIds[4], // TKT-0005
    tokenId: "TKT-0005",
    eventId: eventIds[0],
    seller: wallets.user1,
    price: 0.06,
    status: "sold",
    txHash:
      "0xlist000000000000000000000000000000000000000000000000000000000003",
    soldTo: wallets.user2,
    soldAt: inDays(-35),
    soldTxHash:
      "0xsoldhash000000000000000000000000000000000000000000000000000003",
  },
  // Cancelled listing — event 1
  {
    _id: listingIds[3],
    ticketId: ticketIds[8], // TKT-1004
    tokenId: "TKT-1004",
    eventId: eventIds[1],
    seller: wallets.user2,
    price: 0.08,
    status: "cancelled",
    txHash:
      "0xlist000000000000000000000000000000000000000000000000000000000004",
  },
];

// ─────────────────────────────────────────────
// 6. Shares
// ─────────────────────────────────────────────
const shares = [
  // Event 0 shares (completed — rewards claimed)
  {
    _id: shareIds[0],
    eventId: eventIds[0],
    holder: wallets.organizer1,
    contributionAmount: 5,
    sharePercentage: 40,
    shareTokenId: "SHARE-EVT0001-ORG",
    claimedReward: 9.12,
    pendingReward: 0,
  },
  {
    _id: shareIds[1],
    eventId: eventIds[0],
    holder: wallets.user1,
    contributionAmount: 25,
    sharePercentage: 30,
    shareTokenId: "SHARE-EVT0001-U1",
    claimedReward: 6.84,
    pendingReward: 0,
  },
  {
    _id: shareIds[2],
    eventId: eventIds[0],
    holder: wallets.user2,
    contributionAmount: 25,
    sharePercentage: 30,
    shareTokenId: "SHARE-EVT0001-U2",
    claimedReward: 6.84,
    pendingReward: 0,
  },
  // Event 1 shares (ticketing — no rewards yet)
  {
    _id: shareIds[3],
    eventId: eventIds[1],
    holder: wallets.organizer2,
    contributionAmount: 3,
    sharePercentage: 35,
    shareTokenId: "SHARE-EVT0002-ORG",
    claimedReward: 0,
    pendingReward: 0,
  },
  {
    _id: shareIds[4],
    eventId: eventIds[1],
    holder: wallets.user3,
    contributionAmount: 15,
    sharePercentage: 32.5,
    shareTokenId: "SHARE-EVT0002-U3",
    claimedReward: 0,
    pendingReward: 0,
  },
  {
    _id: shareIds[5],
    eventId: eventIds[1],
    holder: wallets.user4,
    contributionAmount: 14,
    sharePercentage: 32.5,
    shareTokenId: "SHARE-EVT0002-U4",
    claimedReward: 0,
    pendingReward: 0,
  },
];

// ─────────────────────────────────────────────
// 7. Penalties
// ─────────────────────────────────────────────
const penalties = [
  // Event 3 — cancelled by organizer
  {
    _id: penaltyIds[0],
    eventId: eventIds[3],
    organizer: wallets.organizer2,
    stakeAmount: 4,
    penaltyAmount: 2,
    penaltyPercentage: 50,
    reason: "cancelled",
    txHash:
      "0xpenalty0000000000000000000000000000000000000000000000000000000001",
    processedAt: inDays(-38),
    status: "processed",
  },
  // Event 0 — minor infraction
  {
    _id: penaltyIds[1],
    eventId: eventIds[0],
    organizer: wallets.organizer1,
    stakeAmount: 5,
    penaltyAmount: 0.5,
    penaltyPercentage: 10,
    reason: "threshold_not_met",
    txHash:
      "0xpenalty0000000000000000000000000000000000000000000000000000000002",
    processedAt: inDays(-26),
    status: "processed",
  },
];

// ─────────────────────────────────────────────
// 8. Revenue Distributions
// ─────────────────────────────────────────────
const revenueDistributions = [
  // Event 0 — fully distributed
  {
    _id: distributionIds[0],
    eventId: eventIds[0],
    totalRevenue: 24,
    platformFee: 1.2,
    platformFeePercentage: 5,
    organizerShare: 9.12,
    organizerSharePercentage: 40,
    donatorPool: 13.68,
    status: "completed",
    triggeredAt: inDays(-26),
    completedAt: inDays(-25),
    txHash:
      "0xdistrib000000000000000000000000000000000000000000000000000000001",
    ticketUsageRatio: 95.83,
    triggerType: "threshold_reached",
  },
  // Event 1 — pending (not yet triggered)
  {
    _id: distributionIds[1],
    eventId: eventIds[1],
    totalRevenue: 6,
    platformFee: 0.3,
    platformFeePercentage: 5,
    organizerShare: 1.995,
    organizerSharePercentage: 35,
    donatorPool: 3.705,
    status: "pending",
    ticketUsageRatio: 0,
    triggerType: "manual",
  },
  // Event 3 — failed (cancelled event)
  {
    _id: distributionIds[2],
    eventId: eventIds[3],
    totalRevenue: 0,
    platformFee: 0,
    platformFeePercentage: 5,
    organizerShare: 0,
    organizerSharePercentage: 40,
    donatorPool: 0,
    status: "failed",
    triggeredAt: inDays(-38),
    txHash:
      "0xdistrib000000000000000000000000000000000000000000000000000000003",
    ticketUsageRatio: 0,
    triggerType: "manual",
  },
];

// ─────────────────────────────────────────────
// 9. Reward Claims
// ─────────────────────────────────────────────
const rewardClaims = [
  // Event 0 — all three shareholders claimed
  {
    _id: rewardClaimIds[0],
    distributionId: distributionIds[0],
    eventId: eventIds[0],
    claimer: wallets.organizer1,
    sharePercentage: 40,
    rewardAmount: 9.12,
    txHash:
      "0xclaim00000000000000000000000000000000000000000000000000000000001",
    claimedAt: inDays(-25),
    status: "confirmed",
  },
  {
    _id: rewardClaimIds[1],
    distributionId: distributionIds[0],
    eventId: eventIds[0],
    claimer: wallets.user1,
    sharePercentage: 30,
    rewardAmount: 6.84,
    txHash:
      "0xclaim00000000000000000000000000000000000000000000000000000000002",
    claimedAt: inDays(-25),
    status: "confirmed",
  },
  {
    _id: rewardClaimIds[2],
    distributionId: distributionIds[0],
    eventId: eventIds[0],
    claimer: wallets.user2,
    sharePercentage: 30,
    rewardAmount: 6.84,
    txHash:
      "0xclaim00000000000000000000000000000000000000000000000000000000003",
    claimedAt: inDays(-24),
    status: "confirmed",
  },
  // Pending reward claim
  {
    _id: rewardClaimIds[3],
    distributionId: distributionIds[1],
    eventId: eventIds[1],
    claimer: wallets.user3,
    sharePercentage: 32.5,
    rewardAmount: 1.204125,
    status: "pending",
  },
];

// ─────────────────────────────────────────────
// 10. Blockchain Sync States
// ─────────────────────────────────────────────
const blockchainSyncStates = [
  {
    _id: syncStateIds[0],
    contractName: "Fund",
    contractAddress: "0xfund0000000000000000000000000000000000aa",
    lastProcessedBlock: 1_002_010,
    lastSyncAt: new Date(),
    status: "synced",
  },
  {
    _id: syncStateIds[1],
    contractName: "Ticket",
    contractAddress: "0xticket00000000000000000000000000000000bb",
    lastProcessedBlock: 1_002_008,
    lastSyncAt: new Date(),
    status: "synced",
  },
  {
    _id: syncStateIds[2],
    contractName: "Marketplace",
    contractAddress: "0xmarket00000000000000000000000000000000cc",
    lastProcessedBlock: 1_002_005,
    lastSyncAt: inDays(-1),
    status: "syncing",
  },
];

// ═════════════════════════════════════════════
// SEED RUNNER
// ═════════════════════════════════════════════
const seed = async () => {
  try {
    await connectDB();

    console.log("🗑️  Clearing existing data...");
    await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      Ticket.deleteMany({}),
      Contribution.deleteMany({}),
      Listing.deleteMany({}),
      Share.deleteMany({}),
      Penalty.deleteMany({}),
      RevenueDistribution.deleteMany({}),
      RewardClaim.deleteMany({}),
      BlockchainSyncState.deleteMany({}),
    ]);

    console.log("🌱 Seeding Users...");
    await User.insertMany(users);

    console.log("🌱 Seeding Events...");
    await Event.insertMany(events);

    console.log("🌱 Seeding Tickets...");
    await Ticket.insertMany(tickets);

    console.log("🌱 Seeding Contributions...");
    await Contribution.insertMany(contributions);

    console.log("🌱 Seeding Listings...");
    await Listing.insertMany(listings);

    console.log("🌱 Seeding Shares...");
    await Share.insertMany(shares);

    console.log("🌱 Seeding Penalties...");
    await Penalty.insertMany(penalties);

    console.log("🌱 Seeding Revenue Distributions...");
    await RevenueDistribution.insertMany(revenueDistributions);

    console.log("🌱 Seeding Reward Claims...");
    await RewardClaim.insertMany(rewardClaims);

    console.log("🌱 Seeding Blockchain Sync States...");
    await BlockchainSyncState.insertMany(blockchainSyncStates);

    console.log("──────────────────────────────────");
    console.log("✅ Database seeded successfully!");
    console.log(`   Users:                  ${users.length}`);
    console.log(`   Events:                 ${events.length}`);
    console.log(`   Tickets:                ${tickets.length}`);
    console.log(`   Contributions:          ${contributions.length}`);
    console.log(`   Listings:               ${listings.length}`);
    console.log(`   Shares:                 ${shares.length}`);
    console.log(`   Penalties:              ${penalties.length}`);
    console.log(`   Revenue Distributions:  ${revenueDistributions.length}`);
    console.log(`   Reward Claims:          ${rewardClaims.length}`);
    console.log(`   Blockchain Sync States: ${blockchainSyncStates.length}`);
    console.log("──────────────────────────────────");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

seed();
