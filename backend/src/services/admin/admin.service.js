import * as userRepo from "../../repositories/user.repo.js";
import * as eventRepo from "../../repositories/event.repo.js";
import * as ticketRepo from "../../repositories/ticket.repo.js";
import * as listingRepo from "../../repositories/listing.repo.js";
import * as shareRepo from "../../repositories/share.repo.js";
import mongoose from "mongoose";
import { ethers } from "ethers";
import Contribution from "../../models/Contribution.model.js";
import UploadService from "../upload/upload.service.js";
import { NotFoundError, BadRequestError } from "../../utils/customErrors.js";
import { getFund, getTicket, provider } from "../blockchain/index.js";
import { persistLogsFromReceipt } from "../blockchain/core/receiptChainLog.js";
import { addBigInt, compareBigInt } from "../../utils/bigint.js";
import { scheduleAutoRefundsForTerminalEvent } from "../events/terminalRefunds.service.js";

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
const startTicketingWithPriceInterface = new ethers.Interface([
  "function startTicketingWithPrice(uint256 eventId,uint8 ticketType,uint256 quantity,uint256 batchPrice) returns (uint256[] memory tokenIds)",
]);
const COMPLETION_THRESHOLD_BPS = 3600n;
const BPS_DENOMINATOR = 10000n;

function getHardcodedUsedThreshold(maxTickets) {
  // Hardcoded temporary policy: completed when >= 36% tickets are used.
  // Round up to avoid allowing less than 36% because of integer truncation.
  return (maxTickets * COMPLETION_THRESHOLD_BPS + (BPS_DENOMINATOR - 1n)) / BPS_DENOMINATOR;
}

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

async function sendStartTicketingWithPriceTx(
  fundContract,
  fundWithSigner,
  args,
) {
  if (typeof fundWithSigner.startTicketingWithPrice === "function") {
    return fundWithSigner.startTicketingWithPrice(...args);
  }

  const runner = fundWithSigner.runner;
  if (!runner?.sendTransaction) {
    throw new BadRequestError(
      "Signer runner is unavailable for startTicketingWithPrice",
    );
  }

  const to = await fundContract.getAddress();
  return runner.sendTransaction({
    to,
    data: startTicketingWithPriceInterface.encodeFunctionData(
      "startTicketingWithPrice",
      args,
    ),
    value: 0n,
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

function mapTierNameToChainTicketType(name = "") {
  const normalized = String(name).trim().toLowerCase();
  if (normalized.includes("vip")) return 1;
  if (normalized.includes("early")) return 2;
  if (normalized.includes("group")) return 3;
  return 0;
}

function buildTicketMintPlan(event, options = {}) {
  const normalizedTiers = Array.isArray(event?.ticketTiers)
    ? event.ticketTiers
        .map((tier) => ({
          name: String(tier?.name || "").trim(),
          totalSupply: Number(tier?.totalSupply ?? 0),
          price: tier?.price,
        }))
        .filter(
          (tier) =>
            tier.name &&
            Number.isInteger(tier.totalSupply) &&
            tier.totalSupply > 0 &&
            tier.price !== undefined &&
            tier.price !== null &&
            tier.price !== "",
        )
    : [];

  if (normalizedTiers.length > 0) {
    return normalizedTiers.map((tier) => ({
      quantity: tier.totalSupply,
      ticketType: mapTierNameToChainTicketType(tier.name),
      price: BigInt(tier.price),
    }));
  }

  const quantity = Number(options.quantity ?? event?.maxTickets ?? event?.totalTickets ?? 0);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BadRequestError(
      "quantity is required and must be a positive integer for ticketing transition",
    );
  }

  const price = toBigIntValue(
    event?.ticketPrice,
    BigInt(event?.ticketTiers?.[0]?.price ?? 0),
  );
  if (price <= 0n) {
    throw new BadRequestError("ticketPrice is required to mint tickets");
  }

  return [
    {
      quantity,
      ticketType: Number(options.ticketType ?? 0),
      price,
    },
  ];
}

function resolveTotalTicketsFromUpdate(currentEvent, updates) {
  const nextTicketTiers =
    updates.ticketTiers !== undefined
      ? updates.ticketTiers
      : currentEvent.ticketTiers;
  const tierTotal = Array.isArray(nextTicketTiers)
    ? nextTicketTiers.reduce((sum, tier) => {
        const supply = Number(tier?.totalSupply ?? 0);
        return Number.isInteger(supply) && supply > 0 ? sum + supply : sum;
      }, 0)
    : 0;

  const requestedTotal =
    updates.totalTickets !== undefined
      ? Number(updates.totalTickets)
      : Number(currentEvent.totalTickets);

  if (tierTotal > 0) {
    if (
      Number.isInteger(requestedTotal) &&
      requestedTotal > 0 &&
      requestedTotal !== tierTotal
    ) {
      throw new BadRequestError(
        "totalTickets must equal the sum of ticketTiers totalSupply",
      );
    }

    return tierTotal;
  }

  if (!Number.isInteger(requestedTotal) || requestedTotal <= 0) {
    throw new BadRequestError("totalTickets must be greater than 0");
  }

  return requestedTotal;
}

function requiresPerTierPricing(mintPlan, event) {
  const basePrice = toBigIntValue(
    event?.ticketPrice,
    BigInt(event?.ticketTiers?.[0]?.price ?? 0),
  );

  return mintPlan.some((batch) => batch.price !== basePrice);
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

const CHAIN_CANCELLATION_REASON = {
  funding_goal_not_met: 0,
  organizer_cancelled: 1,
  ticket_sales_not_met: 2,
};

const CHAIN_CANCELLATION_REASON_LABEL = {
  0: "funding_goal_not_met",
  1: "organizer_cancelled",
  2: "ticket_sales_not_met",
};

function getCancellationReasonLabel(reasonValue) {
  return (
    CHAIN_CANCELLATION_REASON_LABEL[Number(reasonValue)] ||
    "organizer_cancelled"
  );
}

function mapCancellationReasonToTerminalStatus(reasonCode) {
  return reasonCode === "organizer_cancelled" ? "cancelled" : "failed";
}

function normalizeCancellationReason(inputReason, event = null) {
  const rawReason = typeof inputReason === "string" ? inputReason.trim() : "";
  const normalizedReason = rawReason.toLowerCase();

  if (normalizedReason === "organizer_cancelled") {
    return {
      reasonCode: normalizedReason,
      cancellationNote: null,
    };
  }

  return {
    reasonCode: "organizer_cancelled",
    cancellationNote: rawReason || null,
  };
}

function normalizeFailureReason(inputReason, event = null) {
  const rawReason = typeof inputReason === "string" ? inputReason.trim() : "";
  const normalizedReason = rawReason.toLowerCase();

  if (
    normalizedReason === "funding_goal_not_met" ||
    normalizedReason === "ticket_sales_not_met"
  ) {
    return {
      reasonCode: normalizedReason,
      cancellationNote: null,
    };
  }

  if (event?.status === "ticketing") {
    return {
      reasonCode: "ticket_sales_not_met",
      cancellationNote: rawReason || null,
    };
  }

  return {
    reasonCode: "funding_goal_not_met",
    cancellationNote: rawReason || null,
  };
}

function buildTerminalStatusPatch(status, reasonMeta, actor = null) {
  const actorAddress = actor?.walletAddress || actor?.smartAccountAddress;

  return {
    status,
    cancellationReason: reasonMeta.reasonCode,
    cancellationNote: reasonMeta.cancellationNote,
    cancelledAt: new Date(),
    ...(actorAddress ? { cancelledBy: actorAddress.toLowerCase() } : {}),
  };
}

function resolveImmediateFundingDeadline(event) {
  const startDate = event?.startDate ? new Date(event.startDate) : null;
  if (startDate && Number.isFinite(startDate.getTime())) {
    return BigInt(Math.max(Math.floor(startDate.getTime() / 1000) - 1, 0));
  }

  return BigInt(Math.floor(Date.now() / 1000));
}

function isWithinTicketingWindow(event, now = new Date()) {
  const ticketingStartAt = event?.ticketingStartAt
    ? new Date(event.ticketingStartAt)
    : null;
  if (ticketingStartAt && Number.isFinite(ticketingStartAt.getTime())) {
    if (now < ticketingStartAt) {
      throw new BadRequestError(
        `Cannot start ticketing before ticketingStartAt (${ticketingStartAt.toISOString()})`,
      );
    }
  }

  const ticketingEndAt = event?.ticketingEndAt
    ? new Date(event.ticketingEndAt)
    : null;
  if (ticketingEndAt && Number.isFinite(ticketingEndAt.getTime())) {
    if (now > ticketingEndAt) {
      throw new BadRequestError(
        `Cannot start ticketing after ticketingEndAt (${ticketingEndAt.toISOString()})`,
      );
    }
  }

  return true;
}

function mapFundCustomErrorToMessage(errorName) {
  const messages = {
    NotAuthorized:
      "Backend signer is not authorized for this action on-chain. Use organizer wallet signature.",
    NotOrganizer:
      "Only the organizer wallet can mark event as completed on-chain. Use organizer flow or configure BACKEND_SIGNER_PRIVATE_KEY to organizer wallet.",
    EventNotFound: "Event was not found on-chain.",
    AlreadyFinalized: "Event is already finalized on-chain.",
    Unsafe:
      "Event cannot transition in its current on-chain state. Ensure lifecycle status conditions are satisfied.",
    BadParam:
      "On-chain parameters are invalid for current event state (e.g. no escrowed revenue for release).",
    NotFunding: "Event is not in funding state on-chain.",
    NotFunded: "Event is not in funded state on-chain.",
    NotTicketing:
      "Event is not in ticketing state on-chain. Completed transition requires ticketing status.",
    NotCompleted: "Event is not completed on-chain.",
    FundingClosed: "Funding is already closed on-chain.",
    ShareLocked: "Event shares are already finalized on-chain.",
    TicketContractNotSet: "Ticket contract is not configured on-chain.",
  };

  return messages[errorName] || null;
}

function extractBlockchainErrorData(error) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const queue = [error];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (
      typeof current.data === "string" &&
      current.data.startsWith("0x") &&
      current.data.length >= 10
    ) {
      return current.data;
    }

    if (current.error) queue.push(current.error);
    if (current.info?.error) queue.push(current.info.error);
    if (current.cause) queue.push(current.cause);
  }

  return null;
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

  if (typeof err.revert?.name === "string") {
    const mapped = mapFundCustomErrorToMessage(err.revert.name);
    if (mapped) {
      return mapped;
    }
  }

  const errorData = extractBlockchainErrorData(err);
  if (errorData) {
    try {
      const fund = getFund();
      if (typeof fund?.interface?.parseError === "function") {
        const parsedError = fund.interface.parseError(errorData);
        const errorName = parsedError?.name;
        const mapped = errorName
          ? mapFundCustomErrorToMessage(errorName)
          : null;
        if (mapped) {
          return mapped;
        }
      }
    } catch {
      // Ignore parse failures and fall back to raw message.
    }
  }

  const normalized = String(message).toLowerCase();
  if (normalized.includes("missing revert data")) {
    return "Transaction reverted on-chain without revert data. Verify FUND_ADDRESS points to the expected deployed Fund contract and ABI is in sync.";
  }

  if (normalized.includes("execution reverted")) {
    return "Transaction reverted on-chain. Check event lifecycle conditions (funding/ticketing/completed) and caller authorization.";
  }

  if (normalized.includes("estimate gas")) {
    return "On-chain precheck failed (estimate gas reverted). The transition is invalid in current state or signer is not authorized.";
  }

  return String(message);
}

function isIgnorableReleaseRevenueError(error) {
  if (error && typeof error === "object") {
    const revertName = error.revert?.name;
    if (revertName === "BadParam" || revertName === "AlreadyFinalized") {
      return true;
    }
  }

  const message = getOnChainErrorMessage(error).toLowerCase();
  return (
    message.includes("already finalized") ||
    message.includes("missing revert data") ||
    message.includes("estimate gas")
  );
}

async function tryReleaseRevenueAfterCompleted(
  fundWithSigner,
  chainEventId,
  fund,
  fundAddress,
) {
  try {
    const releaseTx = await fundWithSigner.releaseRevenue(chainEventId);
    const releaseReceipt = await releaseTx.wait();

    if (!releaseReceipt || Number(releaseReceipt.status) !== 1) {
      throw new BadRequestError("On-chain release revenue transaction failed");
    }

    await persistLogsFromReceipt({
      receipt: releaseReceipt,
      contract: fund,
      contractName: "Fund",
      contractAddress: fundAddress,
    });

    try {
      const stakeTx = await fundWithSigner.withdrawStake(chainEventId);
      const stakeReceipt = await stakeTx.wait();

      if (stakeReceipt && Number(stakeReceipt.status) === 1) {
        await persistLogsFromReceipt({
          receipt: stakeReceipt,
          contract: fund,
          contractName: "Fund",
          contractAddress: fundAddress,
        });
      }
    } catch (stakeError) {
      const message = getOnChainErrorMessage(stakeError).toLowerCase();
      const revertName = stakeError?.revert?.name;
      if (
        !["Unsafe", "NothingToClaim"].includes(revertName) &&
        !message.includes("nothingtoclaim") &&
        !message.includes("missing revert data") &&
        !message.includes("estimate gas")
      ) {
        throw stakeError;
      }
    }
  } catch (error) {
    if (isIgnorableReleaseRevenueError(error)) {
      return;
    }

    throw new BadRequestError(
      `Event completed on-chain but release revenue failed: ${getOnChainErrorMessage(error)}`,
    );
  }
}

function getTicketingMintBatchSize() {
  const raw = Number(process.env.TICKETING_MINT_BATCH_SIZE ?? 1000);
  if (!Number.isFinite(raw) || raw <= 0) return 1000;
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
  const investmentEnabled =
    event.investmentEnabled === false ? false : fundingGoal > 0n;
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
  const usedThreshold = getHardcodedUsedThreshold(maxTickets);
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

  if (
    sanitizedUpdates.ticketTiers !== undefined ||
    sanitizedUpdates.totalTickets !== undefined
  ) {
    sanitizedUpdates.totalTickets = resolveTotalTicketsFromUpdate(
      event,
      sanitizedUpdates,
    );
    sanitizedUpdates.maxTickets = sanitizedUpdates.totalTickets;
  }

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
  const actor = options?.actor || null;

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
      if (newStatus === "cancelled") {
        const reasonMeta = normalizeCancellationReason(options.reason, event);
        return await eventRepository.updateById(
          eventId,
          buildTerminalStatusPatch("cancelled", reasonMeta, actor),
        );
      }

      const reasonMeta = normalizeFailureReason(options.reason, event);
      return await eventRepository.updateById(
        eventId,
        buildTerminalStatusPatch("failed", reasonMeta, actor),
      );
    }

    if (newStatus === "ongoing") {
      if (event.status !== "ticketing") {
        throw new BadRequestError(
          `Cannot move event to ongoing from status ${event.status}`,
        );
      }

      return await eventRepository.updateById(eventId, { status: "ongoing" });
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

  if (newStatus === "completed") {
    const signerAddress = String(signer.address || "").toLowerCase();
    const organizerAddress = String(
      event.onChainOrganizer || event.organizer || "",
    ).toLowerCase();
    const adminAddress = String(await fund.admin()).toLowerCase();

    if (
      organizerAddress &&
      signerAddress !== organizerAddress &&
      signerAddress !== adminAddress
    ) {
      throw new BadRequestError(
        "Cannot mark completed with current backend signer. Fund.setCompletedIfThresholdMet requires organizer or admin wallet.",
      );
    }
  }

  let tx;
  let receipt;
  let resolvedStatus = newStatus;

  if (newStatus === "cancelled") {
    const reasonMeta = normalizeCancellationReason(options.reason, event);
    const cancellationPatch = buildTerminalStatusPatch(
      "cancelled",
      reasonMeta,
      actor,
    );

    try {
      if (reasonMeta.reasonCode === "funding_goal_not_met") {
        tx = await fundWithSigner.finalizeFunding(chainEventId);
      } else {
        tx = await fundWithSigner.cancelEvent(
          chainEventId,
          CHAIN_CANCELLATION_REASON[reasonMeta.reasonCode],
        );
      }
    } catch (error) {
      throw new BadRequestError(
        `Failed to cancel event on-chain: ${getOnChainErrorMessage(error)}`,
      );
    }

    receipt = await tx.wait();
    if (!receipt || Number(receipt.status) !== 1) {
      throw new BadRequestError("On-chain cancellation failed");
    }

    await persistLogsFromReceipt({
      receipt,
      contract: fund,
      contractName: "Fund",
      contractAddress: fundAddress,
    });

    const parsedEvents = await parseFundEventsFromReceipt(receipt);
    if (reasonMeta.reasonCode === "funding_goal_not_met") {
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
      if (resolvedStatus !== "cancelled") {
        throw new BadRequestError(
          `Cannot cancel event because funding finalized with status ${resolvedStatus}`,
        );
      }
    } else {
      const cancelled = parsedEvents.find(
        (evt) => evt?.name === "EventCancelled",
      );
      if (!cancelled) {
        throw new BadRequestError(
          "EventCancelled event not found in transaction receipt",
        );
      }
    }

      const updatedEvent = await eventRepository.updateById(eventId, {
        ...cancellationPatch,
        status: resolvedStatus === "failed" ? "failed" : cancellationPatch.status,
      });
      scheduleAutoRefundsForTerminalEvent(updatedEvent);
      return updatedEvent;
    }

  if (newStatus === "failed") {
    const reasonMeta = normalizeFailureReason(options.reason, event);
    const failurePatch = buildTerminalStatusPatch("failed", reasonMeta, actor);

    try {
      if (reasonMeta.reasonCode === "funding_goal_not_met") {
        tx = await fundWithSigner.finalizeFunding(chainEventId);
      } else {
        tx = await fundWithSigner.cancelEvent(
          chainEventId,
          CHAIN_CANCELLATION_REASON[reasonMeta.reasonCode],
        );
      }
    } catch (error) {
      throw new BadRequestError(
        `Failed to mark event as failed on-chain: ${getOnChainErrorMessage(error)}`,
      );
    }

    receipt = await tx.wait();
    if (!receipt || Number(receipt.status) !== 1) {
      throw new BadRequestError("On-chain failure transition failed");
    }

    await persistLogsFromReceipt({
      receipt,
      contract: fund,
      contractName: "Fund",
      contractAddress: fundAddress,
    });

    const parsedEvents = await parseFundEventsFromReceipt(receipt);
    const cancelled = parsedEvents.find(
      (evt) => evt?.name === "EventCancelled",
    );
    if (!cancelled) {
      throw new BadRequestError(
        "EventCancelled event not found in transaction receipt",
      );
    }

    const chainReasonCode = getCancellationReasonLabel(cancelled.args?.reason);
    resolvedStatus = mapCancellationReasonToTerminalStatus(chainReasonCode);

    const updatedEvent = await eventRepository.updateById(eventId, {
      ...failurePatch,
      status: resolvedStatus,
      cancellationReason: chainReasonCode,
    });
    scheduleAutoRefundsForTerminalEvent(updatedEvent);
    return updatedEvent;
  }

  if (newStatus === "ongoing") {
    if (event.status !== "ticketing") {
      throw new BadRequestError(
        `Cannot move event to ongoing from status ${event.status}`,
      );
    }

    return await eventRepository.updateById(eventId, { status: "ongoing" });
  }

  if (newStatus === "ticketing") {
    isWithinTicketingWindow(event);

    // Ticketing is a one-way transition. If the event is already ticketing,
    // do not mint again or we will duplicate inventory records.
    if (event.status === "ticketing") {
      return event;
    }

    const onChainStatus = mapFundStatusToAppStatus(
      await fund.getEventStatus(chainEventId),
    );

    if (onChainStatus === "ticketing") {
      return await eventRepository.updateById(eventId, {
        status: "ticketing",
      });
    }

    if (onChainStatus === "funded" && event.status !== "funded") {
      event = await eventRepository.updateById(eventId, {
        status: "funded",
      });
    }

    if (onChainStatus === "funding") {
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
    } else if (event.status !== "funded") {
      event = await eventRepository.updateById(eventId, {
        status: "funded",
      });
    }

    const ticket = getTicket();
    const ticketAddress = await ticket.getAddress();
    const chainEventIdString = String(event.contractEventId);
    const mintBatchSize = getTicketingMintBatchSize();

    const mintPlan = buildTicketMintPlan(event, options);
    const supportsStartTicketingWithPrice =
      typeof fundWithSigner.startTicketingWithPrice === "function" ||
      !!fundWithSigner.runner?.sendTransaction;

    if (
      !supportsStartTicketingWithPrice &&
      requiresPerTierPricing(mintPlan, event)
    ) {
      throw new BadRequestError(
        "Current Fund deployment does not support per-tier ticket pricing yet. Redeploy/update Fund before starting ticketing for events with mixed ticket prices.",
      );
    }

    for (const plannedBatch of mintPlan) {
      let remaining = plannedBatch.quantity;

      while (remaining > 0) {
        const mintQty = Math.min(remaining, mintBatchSize);

        try {
          if (typeof fundWithSigner.startTicketingWithPrice === "function") {
            tx = await sendStartTicketingWithPriceTx(
              fund,
              fundWithSigner,
              [
                chainEventId,
                plannedBatch.ticketType,
                BigInt(mintQty),
                plannedBatch.price,
              ],
            );
          } else if (
            plannedBatch.price ===
            toBigIntValue(
              event?.ticketPrice,
              BigInt(event?.ticketTiers?.[0]?.price ?? 0),
            )
          ) {
            tx = await fundWithSigner.startTicketing(
              chainEventId,
              plannedBatch.ticketType,
              BigInt(mintQty),
            );
          } else {
            throw new BadRequestError(
              "Current Fund deployment does not support per-tier ticket pricing yet. Redeploy/update Fund before starting ticketing for events with mixed ticket prices.",
            );
          }
        } catch (error) {
          if (error instanceof BadRequestError) {
            throw error;
          }
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
            mintedBatchEvent.args?.price ?? plannedBatch.price,
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

    if (resolvedStatus === "cancelled") {
      const cancelled = parsedEvents.find(
        (evt) => evt?.name === "EventCancelled",
      );
      if (cancelled) {
        const chainReasonCode = getCancellationReasonLabel(
          cancelled.args?.reason,
        );
        resolvedStatus = mapCancellationReasonToTerminalStatus(chainReasonCode);
      }
    }
  }

  if (newStatus === "completed") {
    await tryReleaseRevenueAfterCompleted(
      fundWithSigner,
      chainEventId,
      fund,
      fundAddress,
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
