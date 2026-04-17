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
