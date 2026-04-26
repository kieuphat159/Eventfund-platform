import * as userRepo from "../../repositories/user.repo.js";
import * as eventRepo from "../../repositories/event.repo.js";
import * as ticketRepo from "../../repositories/ticket.repo.js";
import * as listingRepo from "../../repositories/listing.repo.js";
import * as shareRepo from "../../repositories/share.repo.js";
import mongoose from "mongoose";
import { ethers } from "ethers";
import Contribution from "../../models/Contribution.model.js";
import Event from "../../models/Event.model.js";
import Listing from "../../models/Listing.model.js";
import User from "../../models/User.model.js";
import { ChainLog } from "../../models/ChainLog.js";
import UploadService from "../upload/upload.service.js";
import { NotFoundError, BadRequestError } from "../../utils/customErrors.js";
import { getFund, getTicket, provider } from "../blockchain/index.js";
import { persistLogsFromReceipt } from "../blockchain/core/receiptChainLog.js";
import { addBigInt, compareBigInt } from "../../utils/bigint.js";

const WEI_PER_ETH = 10n ** 18n;

function toBigIntSafe(value, fallback = 0n) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function weiToEthNumber(value, precision = 4) {
  const wei = toBigIntSafe(value, 0n);
  const scaled = Number((wei * 10n ** 6n) / WEI_PER_ETH) / 10 ** 6;
  const factor = 10 ** Math.max(0, precision);
  return Math.round(scaled * factor) / factor;
}

function resolveAlertAgeLabel(dateValue) {
  const timestamp = new Date(dateValue || Date.now()).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";

  const diffMs = Math.max(Date.now() - timestamp, 0);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

function resolveStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function monthKeyFromDate(dateValue) {
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function labelFromMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

// Default upload service instance (lazy initialization for future use)
let defaultUploadService = null;
function getDefaultUploadService() {
  if (!defaultUploadService) {
    defaultUploadService = new UploadService();
  }
  return defaultUploadService;
}

const createEventWithInvestmentInterface = new ethers.Interface([
  "function createEventWithInvestment(uint256 fundingGoal,uint256 fundingDeadline,uint256 minStakeRequired,uint256 organizerShareBps,uint256 ticketPrice,uint256 maxTickets,uint256 usedThreshold,bool investmentEnabled) payable returns (uint256 eventId)",
]);

function getBackendSigner() {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new BadRequestError(
      "Missing BACKEND_SIGNER_PRIVATE_KEY for on-chain execution",
    );
  }

  return new ethers.Wallet(privateKey, provider);
}

async function sendCreateEventWithInvestmentTx(
  fundContract,
  fundWithSigner,
  args,
  overrides,
) {
  if (typeof fundWithSigner.createEventWithInvestment === "function") {
    return fundWithSigner.createEventWithInvestment(...args, overrides);
  }

  const runner = fundWithSigner.runner;
  if (!runner?.sendTransaction) {
    throw new BadRequestError(
      "Signer runner is unavailable for createEventWithInvestment",
    );
  }

  const to = await fundContract.getAddress();
  return runner.sendTransaction({
    to,
    data: createEventWithInvestmentInterface.encodeFunctionData(
      "createEventWithInvestment",
      args,
    ),
    value: overrides?.value ?? 0n,
  });
}

function mapFundStatusToAppStatus(statusCode) {
  const map = {
    0: "draft",
    1: "funding",
    2: "funded",
    3: "ticketing",
    4: "completed",
    5: "cancelled",
  };

  return map[Number(statusCode)] || "failed";
}

function mapChainTicketTypeToDb(ticketTypeValue) {
  const value = Number(ticketTypeValue);
  if (value === 1) return "vip";
  if (value === 2) return "early_bird";
  if (value === 3) return "etc";
  return "standard";
}

function toBigIntValue(value, fallback = 0n) {
  if (value === undefined || value === null || value === "") return fallback;
  return BigInt(value);
}

function calculateAverage(total, count) {
  const normalizedCount = Number(count || 0);
  if (!Number.isFinite(normalizedCount) || normalizedCount <= 0) {
    return "0";
  }

  return (BigInt(total || "0") / BigInt(normalizedCount)).toString();
}

function resolveImmediateFundingDeadline(event) {
  const startDate = event?.startDate ? new Date(event.startDate) : null;
  if (startDate && Number.isFinite(startDate.getTime())) {
    return BigInt(Math.max(Math.floor(startDate.getTime() / 1000) - 1, 0));
  }

  return BigInt(Math.floor(Date.now() / 1000));
}

function getOnChainErrorMessage(error) {
  if (!error || typeof error !== "object") {
    return String(error || "Unknown blockchain error");
  }

  const err = error;
  const message =
    err.shortMessage ||
    err.reason ||
    err?.info?.error?.message ||
    err?.error?.message ||
    err.message ||
    "Unknown blockchain error";

  const normalized = String(message).toLowerCase();
  if (
    normalized.includes("execution reverted") ||
    normalized.includes("missing revert data") ||
    normalized.includes("estimate gas")
  ) {
    return "Transaction reverted on-chain. Try reducing mint quantity per batch and ensure the event can transition to the requested status.";
  }

  return String(message);
}

function getTicketingMintBatchSize() {
  const raw = Number(process.env.TICKETING_MINT_BATCH_SIZE ?? 100);
  if (!Number.isFinite(raw) || raw <= 0) return 100;
  return Math.floor(raw);
}

async function parseFundEventsFromReceipt(receipt) {
  const fund = getFund();
  const fundAddress = (await fund.getAddress()).toLowerCase();
  const parsedEvents = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== fundAddress) continue;

    try {
      const parsed = fund.interface.parseLog(log);
      parsedEvents.push(parsed);
    } catch {
      // Ignore unrelated logs.
    }
  }

  return parsedEvents;
}

async function parseTicketEventsFromReceipt(receipt) {
  const ticket = getTicket();
  const ticketAddress = (await ticket.getAddress()).toLowerCase();
  const parsedEvents = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== ticketAddress) continue;

    try {
      const parsed = ticket.interface.parseLog(log);
      parsedEvents.push(parsed);
    } catch {
      // Ignore unrelated logs.
    }
  }

  return parsedEvents;
}

async function publishDraftEventOnChain(event, eventRepository) {
  const signer = getBackendSigner();
  const fund = getFund();
  const fundWithSigner = fund.connect(signer);

  const fundingGoal = toBigIntValue(event.fundingGoal, 0n);
  const investmentEnabled = fundingGoal > 0n;
  const minStakeRequired = investmentEnabled
    ? toBigIntValue(event.minStakeRequired, fundingGoal / 10n)
    : toBigIntValue(
        event.minStakeRequired,
        toBigIntValue(event.organizerStake, 0n),
      );
  const organizerStake = investmentEnabled
    ? toBigIntValue(event.organizerStake, minStakeRequired)
    : toBigIntValue(event.organizerStake, minStakeRequired);
  const organizerShareBps = BigInt(event.organizerShareBps ?? 7000);
  const ticketPrice = toBigIntValue(
    event.ticketPrice,
    BigInt(event.ticketTiers?.[0]?.price ?? 0),
  );
  const maxTickets = BigInt(event.maxTickets ?? event.totalTickets ?? 0);
  const usedThreshold = BigInt(
    event.usedThreshold ?? event.totalTickets ?? maxTickets,
  );
  const fundingDeadline = investmentEnabled
    ? BigInt(Math.floor(new Date(event.fundingDeadline).getTime() / 1000))
    : 0n;

  if (ticketPrice <= 0n) {
    throw new BadRequestError(
      "ticketPrice is required to publish event on-chain",
    );
  }

  if (maxTickets <= 0n) {
    throw new BadRequestError(
      "totalTickets must be greater than 0 to publish event on-chain",
    );
  }

  if (organizerStake <= 0n) {
    throw new BadRequestError(
      "organizerStake must be greater than 0 to publish event on-chain",
    );
  }

  const tx = investmentEnabled
    ? await fundWithSigner.createEvent(
        fundingGoal,
        fundingDeadline,
        minStakeRequired,
        organizerShareBps,
        ticketPrice,
        maxTickets,
        usedThreshold,
        {
          value: organizerStake,
        },
      )
    : await sendCreateEventWithInvestmentTx(
        fund,
        fundWithSigner,
        [
          0n,
          0n,
          organizerStake,
          organizerShareBps,
          ticketPrice,
          maxTickets,
          usedThreshold,
          false,
        ],
        {
          value: organizerStake,
        },
      );

  const receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new BadRequestError("On-chain event creation failed");
  }

  const fundAddress = await fund.getAddress();
  await persistLogsFromReceipt({
    receipt,
    contract: fund,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  const parsedEvents = await parseFundEventsFromReceipt(receipt);
  const createdEvent = parsedEvents.find((evt) => evt?.name === "EventCreated");
  if (!createdEvent) {
    throw new BadRequestError(
      "EventCreated event not found in transaction receipt",
    );
  }

  return await eventRepository.updateById(event._id, {
    contractEventId: String(createdEvent.args?.eventId),
    fundContractAddress: String(fundAddress).toLowerCase(),
    onChainOrganizer: String(
      createdEvent.args?.organizer || signer.address,
    ).toLowerCase(),
    organizerStake: String(createdEvent.args?.stakeAmount ?? organizerStake),
    minStakeRequired: String(
      createdEvent.args?.minStakeRequired ?? minStakeRequired,
    ),
    fundingGoal: String(createdEvent.args?.fundingGoal ?? fundingGoal),
    fundingDeadline: createdEvent.args?.fundingDeadline
      ? new Date(Number(createdEvent.args.fundingDeadline) * 1000)
      : event.fundingDeadline,
    status: investmentEnabled ? "funding" : "funded",
  });
}

/**
 * Get platform-wide statistics
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Platform stats
 */
export async function getPlatformStats(repos = {}) {
  const userRepository = repos.userRepo || userRepo;
  const eventRepository = repos.eventRepo || eventRepo;
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const listingRepository = repos.listingRepo || listingRepo;

  // Nhóm các Promise theo domain
  const userStatsPromise = Promise.all([
    userRepository.countUsers(),
    userRepository.countUsers({ role: "organizer" }),
    userRepository.countUsers({ role: "verifier" }),
    userRepository.countUsers({ role: "admin" }),
  ]);

  const eventStatsPromise = Promise.all([
    eventRepository.countEvents(),
    eventRepository.countEvents({ status: "draft" }),
    eventRepository.countEvents({ status: "funding" }),
    eventRepository.countEvents({ status: "ongoing" }),
    eventRepository.countEvents({ status: "completed" }),
    eventRepository.countEvents({ status: "cancelled" }),
  ]);

  // Chạy các nhóm song song
  const [userResults, eventResults, ticketStats, listingStats, revenueStats] =
    await Promise.all([
      userStatsPromise,
      eventStatsPromise,
      ticketRepository.getTicketStats(),
      listingRepository.getListingStats(),
      eventRepository.getRevenueStats(),
    ]);

  // Destructuring
  const [totalUsers, organizers, verifiers, admins] = userResults;
  const [
    totalEvents,
    draftEvents,
    fundingEvents,
    activeEvents,
    completedEvents,
    cancelledEvents,
  ] = eventResults;

  return {
    users: {
      total: totalUsers,
      organizers,
      verifiers,
      admins,
    },
    events: {
      total: totalEvents,
      draft: draftEvents,
      funding: fundingEvents,
      active: activeEvents,
      completed: completedEvents,
      cancelled: cancelledEvents,
    },
    tickets: ticketStats,
    listings: listingStats,
    revenue: {
      total: revenueStats.totalRevenue,
      funding: revenueStats.totalFunding,
    },
  };
}

/**
 * Get admin fraud monitoring overview from existing platform data.
 */
export async function getFraudOverview(options = {}) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfToday = resolveStartOfToday();

  const [
    suspiciousContributors,
    suspiciousSellers,
    malformedEvents,
    blockedContributions,
    totalRecentContributions,
    resolvedTodayCount,
  ] = await Promise.all([
    Contribution.aggregate([
      {
        $match: {
          status: "confirmed",
          timestamp: { $gte: oneDayAgo },
        },
      },
      {
        $group: {
          _id: "$contributor",
          txCount: { $sum: 1 },
          totalAmountWei: { $sum: { $toDecimal: "$amount" } },
          lastSeenAt: { $max: "$timestamp" },
        },
      },
      { $match: { txCount: { $gte: 5 } } },
      { $sort: { txCount: -1, lastSeenAt: -1 } },
      { $limit: 10 },
    ]),
    Listing.aggregate([
      {
        $match: {
          listedAt: { $gte: sevenDaysAgo },
          status: "active",
        },
      },
      {
        $group: {
          _id: "$seller",
          activeListings: { $sum: 1 },
          lastListedAt: { $max: "$listedAt" },
        },
      },
      { $match: { activeListings: { $gte: 8 } } },
      { $sort: { activeListings: -1, lastListedAt: -1 } },
      { $limit: 10 },
    ]),
    Event.find({
      $or: [
        { totalTickets: { $lt: 1 } },
        {
          $expr: {
            $gt: ["$ticketsSold", "$totalTickets"],
          },
        },
      ],
    })
      .select("title organizer updatedAt")
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
    Contribution.find({
      status: "refunded",
      refundedAt: { $gte: sevenDaysAgo },
    })
      .select("contributor amount refundedAt")
      .sort({ refundedAt: -1 })
      .limit(20)
      .lean(),
    Contribution.countDocuments({
      timestamp: { $gte: sevenDaysAgo },
    }),
    ChainLog.countDocuments({
      createdAt: { $gte: startOfToday },
      eventName: {
        $in: ["PenaltyApplied", "TicketCancelled", "ListingCancelled"],
      },
    }),
  ]);

  const alerts = [
    ...suspiciousContributors.map((item, index) => ({
      id: `contributor-${index + 1}`,
      type: "Suspicious Activity",
      severity: item.txCount >= 10 ? "high" : "medium",
      user: String(item._id || "").toLowerCase(),
      description: `${item.txCount} contributions in the last 24 hours`,
      time: resolveAlertAgeLabel(item.lastSeenAt),
      status: "pending",
      createdAt: item.lastSeenAt || now,
    })),
    ...suspiciousSellers.map((item, index) => ({
      id: `seller-${index + 1}`,
      type: "Price Manipulation Risk",
      severity: item.activeListings >= 15 ? "high" : "medium",
      user: String(item._id || "").toLowerCase(),
      description: `${item.activeListings} active listings created recently`,
      time: resolveAlertAgeLabel(item.lastListedAt),
      status: "investigating",
      createdAt: item.lastListedAt || now,
    })),
    ...malformedEvents.map((event, index) => ({
      id: `event-${index + 1}`,
      type: "Event Integrity Issue",
      severity: "high",
      user: String(event.organizer || "").toLowerCase(),
      description: `Event \"${event.title || "Untitled"}\" has inconsistent ticket counters`,
      time: resolveAlertAgeLabel(event.updatedAt),
      status: "pending",
      createdAt: event.updatedAt || now,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  const blockedTransactions = blockedContributions.map((item) => ({
    wallet: String(item.contributor || "").toLowerCase(),
    reason: "Refunded after risk validation",
    amountWei: String(item.amount || "0"),
    amountEth: weiToEthNumber(item.amount || "0", 4),
    time: resolveAlertAgeLabel(item.refundedAt),
    createdAt: item.refundedAt || now,
  }));

  const activeAlerts = alerts.filter((alert) => alert.status !== "resolved").length;
  const blockedCount = blockedTransactions.length;
  const totalSignals = Math.max(Number(totalRecentContributions || 0), 1);
  const detectionRate = Math.max(
    0,
    Math.min(100, Number((((totalSignals - blockedCount) / totalSignals) * 100).toFixed(2))),
  );

  return {
    stats: {
      activeAlerts,
      resolvedToday: Number(resolvedTodayCount || 0),
      blockedTransactions: blockedCount,
      detectionRate,
    },
    alerts,
    blockedTransactions,
    generatedAt: now,
  };
}

/**
 * Get admin finance dashboard overview from platform data.
 */
export async function getFinanceOverview(repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;
  const listingRepository = repos.listingRepo || listingRepo;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const pastSixMonths = Array.from({ length: 6 }, (_, idx) => {
    const date = new Date(currentYear, currentMonth - (5 - idx), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const [allEvents, soldListings, revenueStats] = await Promise.all([
    Event.find({})
      .select("title organizer category createdAt totalRevenue platformFee escrowedRevenue organizerShare escrowStatus")
      .sort({ createdAt: -1 })
      .lean(),
    Listing.find({ status: "sold" })
      .select("price soldAt")
      .lean(),
    eventRepository.getRevenueStats(),
  ]);

  const ticketRevenueWei = allEvents.reduce(
    (sum, event) => sum + toBigIntSafe(event.totalRevenue, 0n),
    0n,
  );
  const platformFeeWei = allEvents.reduce(
    (sum, event) => sum + toBigIntSafe(event.platformFee, 0n),
    0n,
  );
  const marketplaceVolumeWei = soldListings.reduce(
    (sum, listing) => sum + toBigIntSafe(listing.price, 0n),
    0n,
  );
  const marketplaceFeeWei = (marketplaceVolumeWei * 2n) / 100n;
  const pendingWithdrawalsWei = allEvents
    .filter((event) => ["holding", "holding_revenue"].includes(event.escrowStatus))
    .reduce(
      (sum, event) => sum + toBigIntSafe(event.organizerShare, 0n),
      0n,
    );

  const monthlyAccumulator = Object.fromEntries(
    pastSixMonths.map((monthKey) => [monthKey, { ticket: 0n, marketplace: 0n }]),
  );

  for (const event of allEvents) {
    const key = monthKeyFromDate(event.createdAt);
    if (!key || !monthlyAccumulator[key]) continue;
    monthlyAccumulator[key].ticket += toBigIntSafe(event.totalRevenue, 0n);
  }

  for (const listing of soldListings) {
    const key = monthKeyFromDate(listing.soldAt);
    if (!key || !monthlyAccumulator[key]) continue;
    monthlyAccumulator[key].marketplace += (toBigIntSafe(listing.price, 0n) * 2n) / 100n;
  }

  const monthlyRevenue = pastSixMonths.map((monthKey) => {
    const item = monthlyAccumulator[monthKey] || { ticket: 0n, marketplace: 0n };
    return {
      month: labelFromMonthKey(monthKey),
      ticket: weiToEthNumber(item.ticket, 3),
      marketplace: weiToEthNumber(item.marketplace, 3),
      total: weiToEthNumber(item.ticket + item.marketplace, 3),
    };
  });

  const categoryRevenueMap = new Map();
  for (const event of allEvents) {
    const category = String(event.category || "Other").trim() || "Other";
    const current = categoryRevenueMap.get(category) || 0n;
    categoryRevenueMap.set(category, current + toBigIntSafe(event.totalRevenue, 0n));
  }

  const categoryRevenue = Array.from(categoryRevenueMap.entries())
    .map(([category, revenueWei]) => ({
      category,
      revenue: weiToEthNumber(revenueWei, 3),
      revenueWei: revenueWei.toString(),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const withdrawalRequests = allEvents
    .filter((event) => toBigIntSafe(event.organizerShare, 0n) > 0n)
    .slice(0, 10)
    .map((event, index) => ({
      id: `WR-${String(index + 1).padStart(3, "0")}`,
      organizer: event.title || "Untitled event",
      wallet: String(event.organizer || "").toLowerCase(),
      amountWei: String(event.organizerShare || "0"),
      amountEth: weiToEthNumber(event.organizerShare || "0", 4),
      date: event.createdAt,
      status:
        event.escrowStatus === "released"
          ? "completed"
          : event.escrowStatus === "holding_revenue"
            ? "approved"
            : "pending",
    }));

  return {
    stats: {
      totalPlatformRevenueWei: String(
        toBigIntSafe(revenueStats?.totalRevenue, 0n) + marketplaceFeeWei,
      ),
      ticketSalesRevenueWei: ticketRevenueWei.toString(),
      marketplaceFeesWei: marketplaceFeeWei.toString(),
      pendingWithdrawalsWei: pendingWithdrawalsWei.toString(),
      totalPlatformRevenueEth: weiToEthNumber(
        toBigIntSafe(revenueStats?.totalRevenue, 0n) + marketplaceFeeWei,
      ),
      ticketSalesRevenueEth: weiToEthNumber(ticketRevenueWei),
      marketplaceFeesEth: weiToEthNumber(marketplaceFeeWei),
      pendingWithdrawalsEth: weiToEthNumber(pendingWithdrawalsWei),
    },
    monthlyRevenue,
    categoryRevenue,
    withdrawalRequests,
    summary: {
      totalProcessedWei: (
        toBigIntSafe(revenueStats?.totalRevenue, 0n) + marketplaceFeeWei - pendingWithdrawalsWei
      ).toString(),
      pendingApprovalWei: pendingWithdrawalsWei.toString(),
      platformFeeRatePercent: 2.5,
    },
  };
}

/**
 * Get admin analytics dashboard overview.
 */
export async function getAnalyticsOverview(repos = {}) {
  const userRepository = repos.userRepo || userRepo;
  const eventRepository = repos.eventRepo || eventRepo;
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const pastSixMonths = Array.from({ length: 6 }, (_, idx) => {
    const date = new Date(currentYear, currentMonth - (5 - idx), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const [platformStats, allUsers, allEvents, soldListings, contributions] =
    await Promise.all([
      getPlatformStats({
        userRepo: userRepository,
        eventRepo: eventRepository,
        ticketRepo: ticketRepository,
        listingRepo: repos.listingRepo || listingRepo,
      }),
      User.find({}).select("walletAddress role createdAt").lean(),
      Event.find({})
        .select("title organizer category createdAt ticketsSold totalRevenue totalTicketsUsed")
        .lean(),
      Listing.find({ status: "sold" }).select("price soldAt").lean(),
      Contribution.find({ status: "confirmed" })
        .select("contributor amount timestamp")
        .lean(),
    ]);

  const marketplaceVolumeWei = soldListings.reduce(
    (sum, listing) => sum + toBigIntSafe(listing.price, 0n),
    0n,
  );

  const monthlyAccumulator = Object.fromEntries(
    pastSixMonths.map((monthKey) => [monthKey, { users: 0, events: 0, tickets: 0 }]),
  );

  for (const user of allUsers) {
    const key = monthKeyFromDate(user.createdAt);
    if (!key || !monthlyAccumulator[key]) continue;
    monthlyAccumulator[key].users += 1;
  }

  for (const event of allEvents) {
    const key = monthKeyFromDate(event.createdAt);
    if (!key || !monthlyAccumulator[key]) continue;
    monthlyAccumulator[key].events += 1;
    monthlyAccumulator[key].tickets += Number(event.ticketsSold || 0);
  }

  const platformActivity = pastSixMonths.map((monthKey) => ({
    month: labelFromMonthKey(monthKey),
    users: monthlyAccumulator[monthKey]?.users || 0,
    events: monthlyAccumulator[monthKey]?.events || 0,
    tickets: monthlyAccumulator[monthKey]?.tickets || 0,
  }));

  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - idx));
    return date;
  });

  const engagement = last7Days.map((dayStart) => {
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayLabel = dayStart.toLocaleString("en-US", { weekday: "short" });

    const newUsers = allUsers.filter((user) => {
      const t = new Date(user.createdAt || 0).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;

    const activeSignals = contributions.filter((item) => {
      const t = new Date(item.timestamp || 0).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;

    return {
      day: dayLabel,
      active: activeSignals,
      new: newUsers,
    };
  });

  const userTypeDistribution = [
    {
      name: "Regular Users",
      value: Math.max(
        Number(platformStats.users.total || 0) -
          Number(platformStats.users.verifiers || 0) -
          Number(platformStats.users.admins || 0),
        0,
      ),
    },
    { name: "Event Organizers", value: Number(platformStats.users.organizers || 0) },
    { name: "Verifiers", value: Number(platformStats.users.verifiers || 0) },
    { name: "Admins", value: Number(platformStats.users.admins || 0) },
  ];

  const topEvents = allEvents
    .slice()
    .sort(
      (a, b) =>
        Number(toBigIntSafe(b.totalRevenue, 0n) - toBigIntSafe(a.totalRevenue, 0n)) ||
        Number(b.ticketsSold || 0) - Number(a.ticketsSold || 0),
    )
    .slice(0, 5)
    .map((event, index) => ({
      rank: index + 1,
      name: event.title || "Untitled event",
      organizer: String(event.organizer || "").toLowerCase(),
      category: event.category || "Other",
      tickets: Number(event.ticketsSold || 0),
      revenueEth: weiToEthNumber(event.totalRevenue || "0", 3),
      attendees: Number(event.totalTicketsUsed || 0),
      rating: 4.5,
    }));

  const categoryPerformanceMap = new Map();
  for (const event of allEvents) {
    const category = String(event.category || "Other").trim() || "Other";
    const current =
      categoryPerformanceMap.get(category) ||
      ({ events: 0, tickets: 0, revenueWei: 0n });
    current.events += 1;
    current.tickets += Number(event.ticketsSold || 0);
    current.revenueWei += toBigIntSafe(event.totalRevenue, 0n);
    categoryPerformanceMap.set(category, current);
  }

  const categoryPerformance = Array.from(categoryPerformanceMap.entries())
    .map(([category, value]) => ({
      category,
      events: value.events,
      tickets: value.tickets,
      revenue: weiToEthNumber(value.revenueWei, 3),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const uniqueContributors = new Set(
    contributions.map((item) => String(item.contributor || "").toLowerCase()),
  );
  const repeatContributors = contributions.length - uniqueContributors.size;
  const retentionRate = contributions.length
    ? Number(((repeatContributors / contributions.length) * 100).toFixed(1))
    : 0;

  return {
    stats: {
      totalUsers: Number(platformStats.users.total || 0),
      totalEvents: Number(platformStats.events.total || 0),
      ticketsSold: Number(platformStats.tickets.sold || 0),
      marketplaceVolumeWei: marketplaceVolumeWei.toString(),
      marketplaceVolumeEth: weiToEthNumber(marketplaceVolumeWei, 3),
    },
    platformActivity,
    userEngagement: engagement,
    userTypeDistribution,
    topEvents,
    categoryPerformance,
    insights: {
      avgTicketsPerEvent:
        Number(platformStats.events.total || 0) > 0
          ? Number(
              (
                Number(platformStats.tickets.sold || 0) /
                Number(platformStats.events.total || 1)
              ).toFixed(2),
            )
          : 0,
      retentionRate,
    },
  };
}

/**
 * Get all users with filters
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated users
 */
export async function getUsers(query = {}, repos = {}) {
  const userRepository = repos.userRepo || userRepo;

  // Destructure with defaults
  const { role, isActive, page = 1, limit = 20, sort = "-createdAt" } = query;

  // Build query using short-circuit evaluation
  const dbQuery = {
    ...(role && { role }),
    ...(isActive !== undefined && { isActive: isActive === "true" }),
  };

  // Setup pagination options
  const options = {
    page: parseInt(page, 10),
    limit: Math.min(parseInt(limit, 10), 100),
    sort,
    lean: true,
  };

  return await userRepository.findUsers(dbQuery, options);
}

/**
 * Update user role
 * @param {string} walletAddress - Wallet address
 * @param {string} newRole - New role
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated user
 */
export async function updateUserRole(walletAddress, newRole, repos = {}) {
  const userRepository = repos.userRepo || userRepo;

  const user = await userRepository.findByWalletAddress(walletAddress);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return await userRepository.updateRole(walletAddress, newRole);
}

/**
 * Get all events (admin view)
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated events
 */
export async function getEvents(query = {}, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;

  // Destructure with defaults
  const {
    status,
    organizer,
    page = 1,
    limit = 20,
    sort = "-createdAt",
  } = query;

  // Build query using short-circuit evaluation
  const dbQuery = {
    ...(status && { status }),
    ...(organizer && { organizer: organizer.toLowerCase() }),
  };

  // Setup pagination options
  const options = {
    page: parseInt(page, 10),
    limit: Math.min(parseInt(limit, 10), 100),
    sort,
    lean: true,
  };

  return await eventRepository.findEvents(dbQuery, options);
}

/**
 * Get a single event with admin-facing investment summary
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Event with lightweight admin summary
 */
export async function getEventById(eventId, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  const investorCount = await shareRepository.countShares({ eventId });

  return {
    ...event,
    adminSummary: {
      investorCount,
    },
  };
}

/**
 * Update an event as admin
 * @param {string} eventId - Event ID
 * @param {Object} updates - Event update payload
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEvent(eventId, updates, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  const allowedFields = [
    "title",
    "description",
    "category",
    "startDate",
    "endDate",
    "fundingGoal",
    "minStakeRequired",
    "fundingDeadline",
    "status",
    "venue",
    "imageUrls",
    "metadataUri",
    "totalTickets",
    "ticketTiers",
    "ticketUsageThreshold",
  ];

  const sanitizedUpdates = {};
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  });

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new BadRequestError("No valid event fields were provided");
  }

  return await eventRepository.updateById(eventId, sanitizedUpdates);
}

/**
 * Force update event status
 * @param {string} eventId - Event ID
 * @param {string} newStatus - New status
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEventStatus(
  eventId,
  newStatus,
  options = {},
  repos = {},
) {
  // Backward compatibility: old signature was (eventId, newStatus, repos)
  if (
    options &&
    typeof options === "object" &&
    (options.eventRepo ||
      options.userRepo ||
      options.ticketRepo ||
      options.listingRepo) &&
    Object.keys(repos || {}).length === 0
  ) {
    repos = options;
    options = {};
  }

  const eventRepository = repos.eventRepo || eventRepo;

  let event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  if (event.status === newStatus) {
    return event;
  }

  if (event.status === "completed") {
    throw new BadRequestError("Cannot change status of a completed event");
  }

  if (!event.contractEventId) {
    if (newStatus === "cancelled" || newStatus === "failed") {
      return await eventRepository.updateById(eventId, { status: newStatus });
    }

    if (toBigIntValue(event.fundingGoal, 0n) > 0n) {
      throw new BadRequestError(
        "Event does not have contractEventId for on-chain transition. Publish the funding event on-chain first.",
      );
    }

    if (newStatus !== "funded" && newStatus !== "ticketing") {
      throw new BadRequestError(
        `Status ${newStatus} requires an on-chain event before transition`,
      );
    }

    event = await publishDraftEventOnChain(event, eventRepository);

    if (event.status === newStatus) {
      return event;
    }
  }

  const signer = getBackendSigner();
  const fund = getFund();
  const fundWithSigner = fund.connect(signer);
  const chainEventId = BigInt(event.contractEventId);
  const fundAddress = await fund.getAddress();

  let tx;
  let receipt;
  let resolvedStatus = newStatus;

  if (newStatus === "ticketing") {
    const ticketType = Number(options.ticketType ?? 0);
    const quantity = Number(options.quantity ?? 0);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestError(
        "quantity is required and must be a positive integer for ticketing transition",
      );
    }

    if (event.status === "draft" || event.status === "funding") {
      let finalizeTx;
      try {
        finalizeTx = await fundWithSigner.finalizeFunding(chainEventId);
      } catch (error) {
        throw new BadRequestError(
          `Failed to finalize funding on-chain: ${getOnChainErrorMessage(error)}`,
        );
      }

      const finalizeReceipt = await finalizeTx.wait();
      if (!finalizeReceipt || Number(finalizeReceipt.status) !== 1) {
        throw new BadRequestError("On-chain funding finalization failed");
      }

      await persistLogsFromReceipt({
        receipt: finalizeReceipt,
        contract: fund,
        contractName: "Fund",
        contractAddress: fundAddress,
      });

      const parsedEvents = await parseFundEventsFromReceipt(finalizeReceipt);
      const finalized = parsedEvents.find(
        (evt) => evt?.name === "FundingFinalized",
      );
      if (!finalized) {
        throw new BadRequestError(
          "FundingFinalized event not found in transaction receipt",
        );
      }

      const finalizedStatus = mapFundStatusToAppStatus(
        finalized.args?.statusAfterFinalize,
      );
      event = await eventRepository.updateById(eventId, {
        status: finalizedStatus,
      });

      if (finalizedStatus !== "funded") {
        throw new BadRequestError(
          `Cannot start ticketing because event finalized with status ${finalizedStatus}`,
        );
      }
    }

    const ticket = getTicket();
    const ticketAddress = await ticket.getAddress();
    const chainEventIdString = String(event.contractEventId);
    const mintBatchSize = getTicketingMintBatchSize();

    let remaining = quantity;
    while (remaining > 0) {
      const mintQty = Math.min(remaining, mintBatchSize);

      try {
        tx = await fundWithSigner.startTicketing(
          chainEventId,
          ticketType,
          BigInt(mintQty),
        );
      } catch (error) {
        throw new BadRequestError(
          `Failed to start ticketing for batch size ${mintQty}: ${getOnChainErrorMessage(error)}`,
        );
      }

      const mintReceipt = await tx.wait();
      if (!mintReceipt || Number(mintReceipt.status) !== 1) {
        throw new BadRequestError("On-chain ticket mint transaction failed");
      }

      await persistLogsFromReceipt({
        receipt: mintReceipt,
        contract: fund,
        contractName: "Fund",
        contractAddress: fundAddress,
      });

      await persistLogsFromReceipt({
        receipt: mintReceipt,
        contract: ticket,
        contractName: "Ticket",
        contractAddress: ticketAddress,
      });

      const ticketEvents = await parseTicketEventsFromReceipt(mintReceipt);
      const mintedBatchEvents = ticketEvents.filter(
        (evt) => evt?.name === "TicketMintedBatch",
      );

      for (const mintedBatchEvent of mintedBatchEvents) {
        const mintedEventId = String(mintedBatchEvent.args?.eventId ?? "");
        if (mintedEventId && mintedEventId !== chainEventIdString) {
          continue;
        }

        const owner = String(
          mintedBatchEvent.args?.to || event.organizer || "",
        ).toLowerCase();
        const originalPrice = String(
          mintedBatchEvent.args?.price ?? event.ticketPrice ?? 0,
        );
        const mappedTicketType = mapChainTicketTypeToDb(
          mintedBatchEvent.args?.ticketType,
        );

        for (const tokenIdValue of mintedBatchEvent.args?.ticketIds || []) {
          await ticketRepo.upsertMintedFromChain({
            tokenId: String(tokenIdValue),
            eventId: event._id,
            currentOwner: owner,
            originalPrice,
            ticketType: mappedTicketType,
            mintTxHash: tx.hash,
          });
        }
      }

      remaining -= mintQty;
    }

    return await eventRepository.updateById(eventId, { status: "ticketing" });
  }

  try {
    if (newStatus === "funded" || newStatus === "cancelled") {
      tx = await fundWithSigner.finalizeFunding(chainEventId);
    } else if (newStatus === "completed") {
      tx = await fundWithSigner.setCompletedIfThresholdMet(chainEventId);
    } else {
      throw new BadRequestError(
        `Status ${newStatus} has no direct on-chain transition in Fund contract`,
      );
    }
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError(
      `Failed to update on-chain status: ${getOnChainErrorMessage(error)}`,
    );
  }

  receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new BadRequestError("On-chain status transition failed");
  }

  await persistLogsFromReceipt({
    receipt,
    contract: fund,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  if (newStatus === "funded" || newStatus === "cancelled") {
    const parsedEvents = await parseFundEventsFromReceipt(receipt);
    const finalized = parsedEvents.find(
      (evt) => evt?.name === "FundingFinalized",
    );
    if (!finalized) {
      throw new BadRequestError(
        "FundingFinalized event not found in transaction receipt",
      );
    }
    resolvedStatus = mapFundStatusToAppStatus(
      finalized.args?.statusAfterFinalize,
    );
  }

  return await eventRepository.updateById(eventId, { status: resolvedStatus });
}

/**
 * Get investments for a single event
 * @param {string} eventId - Event ID
 * @param {Object} query - Pagination query
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated investments with summary
 */
export async function getEventInvestments(eventId, query = {}, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  const { page = 1, limit = 20, sort = "-contributionAmount" } = query;

  const investments = await shareRepository.findByEvent(eventId, {
    page: parseInt(page, 10),
    limit: Math.min(parseInt(limit, 10), 100),
    sort,
    lean: true,
  });

  const confirmedContributions = await Contribution.find({
    eventId,
    status: "confirmed",
    type: "donator_contribution",
  })
    .select("amount")
    .lean();

  const totalInvested = confirmedContributions.reduce(
    (sum, contribution) => addBigInt(sum, contribution.amount || "0"),
    "0",
  );

  const docs = Array.isArray(investments.docs) ? investments.docs : [];
  const largestInvestment = docs.reduce(
    (max, share) =>
      compareBigInt(share.contributionAmount || "0", max) > 0
        ? share.contributionAmount || "0"
        : max,
    "0",
  );

  return {
    ...investments,
    event: {
      _id: event._id,
      title: event.title,
      status: event.status,
      fundingGoal: event.fundingGoal,
      currentFunding: event.currentFunding,
    },
    summary: {
      totalInvestors: investments.totalDocs || docs.length,
      totalInvested,
      averageInvestment: calculateAverage(totalInvested, docs.length),
      largestInvestment,
      contributionCount: confirmedContributions.length,
    },
  };
}

/**
 * Get system health status
 * @param {Object} options - Options (for testing)
 * @returns {Promise<Object>} System health
 */
export async function getSystemHealth(options = {}) {
  const connection = options.connection || mongoose.connection;

  // Check database connection
  const dbState = connection.readyState;
  const dbStatus = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    database: {
      status: dbStatus[dbState] || "unknown",
      connected: dbState === 1,
    },
    services: {
      api: "operational",
    },
    timestamp: new Date(),
  };
}

/**
 * Delete user by wallet address
 * Cascades to delete user's avatar from Cloudinary
 * @param {string} walletAddress - Wallet address
 * @param {Object} repos - Injected repositories (for testing)
 * @param {Object} uploadSvc - Injected upload service (for testing)
 * @returns {Promise<Object>} Deleted user
 */
export async function deleteUser(walletAddress, repos = {}, uploadSvc = null) {
  const userRepository = repos.userRepo || userRepo;
  const uploadServiceInstance = uploadSvc || getDefaultUploadService();

  const user = await userRepository.findByWalletAddress(walletAddress);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Delete avatar from Cloudinary if exists
  if (user.avatarUrl) {
    try {
      await uploadServiceInstance.deleteImage(user.avatarUrl);
    } catch (error) {
      // Log but don't fail if avatar deletion fails
      console.warn("Failed to delete user avatar from Cloudinary", {
        walletAddress,
        avatarUrl: user.avatarUrl,
        error: error.message,
      });
    }
  }

  const deletedUser = await userRepository.deleteByWalletAddress(walletAddress);

  return deletedUser;
}
