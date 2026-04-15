import { isValidObjectId } from "mongoose";
import { ethers } from "ethers";
import * as eventRepo from "../../repositories/event.repo.js";
import * as shareRepo from "../../repositories/share.repo.js";
import {
  addBigInt,
  compareBigInt,
  toBigInt,
  toStringBigInt,
} from "../../utils/bigint.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../utils/customErrors.js";
import UploadService from "../upload/upload.service.js";
import Contribution from "../../models/Contribution.model.js";
import Share from "../../models/Share.model.js";
import { getFund, provider } from "../blockchain/index.js";
import { persistLogsFromReceipt } from "../blockchain/core/receiptChainLog.js";

// Default upload service instance (lazy initialization for future use)
let defaultUploadService = null;
function getDefaultUploadService() {
  if (!defaultUploadService) {
    defaultUploadService = new UploadService();
  }
  return defaultUploadService;
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

function asBigInt(value, fieldName) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid integer string`);
  }
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
      // Ignore unrelated/decode-failed logs.
    }
  }

  return parsedEvents;
}

/**
 * Create a new event in draft status
 * @param {Object} eventData - Event data
 * @param {Object} user - User object with walletAddress and role
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Created event
 */
export async function createEvent(eventData, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const signer = getBackendSigner();
  if (signer.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new BadRequestError(
      "Caller wallet must match backend signer address for on-chain event creation",
    );
  }

  const fundWithSigner = getFund().connect(signer);

  const fundingGoal = asBigInt(eventData.fundingGoal, "fundingGoal");
  const fundingDeadline = Math.floor(
    new Date(eventData.fundingDeadline).getTime() / 1000,
  );
  if (!Number.isFinite(fundingDeadline) || fundingDeadline <= 0) {
    throw new BadRequestError("fundingDeadline must be a valid ISO datetime");
  }

  const minStakeRequired = asBigInt(
    eventData.minStakeRequired,
    "minStakeRequired",
  );
  const organizerStake = eventData.organizerStake
    ? asBigInt(eventData.organizerStake, "organizerStake")
    : minStakeRequired;

  if (organizerStake < minStakeRequired) {
    throw new BadRequestError("organizerStake must be >= minStakeRequired");
  }

  const organizerShareBps = Number(eventData.organizerShareBps ?? 7000);
  const ticketPrice = asBigInt(eventData.ticketPrice, "ticketPrice");
  const maxTickets = BigInt(eventData.totalTickets);
  const usedThreshold = BigInt(eventData.usedThreshold ?? eventData.totalTickets);

  const tx = await fundWithSigner.createEvent(
    fundingGoal,
    BigInt(fundingDeadline),
    minStakeRequired,
    BigInt(organizerShareBps),
    ticketPrice,
    maxTickets,
    usedThreshold,
    { value: organizerStake },
  );

  const receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new BadRequestError("On-chain createEvent transaction failed");
  }

  await persistLogsFromReceipt({
    receipt,
    contract: getFund(),
    contractName: "Fund",
    contractAddress: await getFund().getAddress(),
  });

  const parsedEvents = await parseFundEventsFromReceipt(receipt);
  const eventCreated = parsedEvents.find((evt) => evt?.name === "EventCreated");
  if (!eventCreated) {
    throw new BadRequestError("EventCreated not found in transaction receipt");
  }

  const contractEventId = String(eventCreated.args?.eventId ?? "");
  if (!contractEventId) {
    throw new BadRequestError("Invalid eventId emitted from EventCreated");
  }

  const event = await repository.createEvent({
    ...eventData,
    syncOnChain: undefined,
    organizerShareBps,
    ticketPrice: Number(ticketPrice),
    usedThreshold: Number(usedThreshold),
    contractEventId,
    organizer: user.walletAddress.toLowerCase(),
    status: "funding",
    organizerStake: organizerStake.toString(),
    minStakeRequired: minStakeRequired.toString(),
    maxTickets: Number(maxTickets),
    currentFunding: "0",
    ticketsSold: 0,
    totalTicketsUsed: 0,
  });

  return {
    ...event,
    onChain: {
      txHash: tx.hash.toLowerCase(),
      contractEventId,
    },
  };
}

/**
 * Get events with filters, pagination, and sorting
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated events
 */
export async function getEvents(query = {}, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  const { status, category, organizer, page, limit, sort } = query;

  // Build query with short-circuiting
  const dbQuery = {
    ...(status && { status }),
    ...(category && { category }),
    ...(organizer && { organizer: organizer.toLowerCase() }),
  };

  // Pagination options with defaults
  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || "-createdAt",
    lean: true,
  };

  return await repository.findEvents(dbQuery, options);
}

export async function assignVerifier(eventId, verifier, user) {
  if (!verifier) {
    throw new BadRequestError("Verifier wallet is required");
  }

  const event = await Event.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  const normalizedVerifier = verifier.toLowerCase();

  if (!event.verifiers) {
    event.verifiers = [];
  }

  if (!event.verifiers.includes(normalizedVerifier)) {
    event.verifiers.push(normalizedVerifier);
  }

  await event.save();

  return event;
}

/**
 * Get event by ID with stats
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object|null>} Event with stats or null
 */
export async function getEventById(eventId, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  if (!isValidObjectId(eventId)) {
    throw new BadRequestError("Invalid event id");
  }

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  return event;
}

/**
 * Update event
 * @param {string} eventId - Event ID
 * @param {Object} updates - Updates to apply
 * @param {Object} user - User object with walletAddress
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEvent(eventId, updates, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new ForbiddenError("Not authorized to update this event");
  }

  // Allowlist: only allow specific fields to be updated
  const allowedFields = [
    "title",
    "description",
    "category",
    "startDate",
    "endDate",
    "fundingGoal",
    "minStakeRequired",
    "fundingDeadline",
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

  const nextStatus = resolveOwnerStatusTransition(event.status, updates.status);
  if (nextStatus) {
    sanitizedUpdates.status = nextStatus;
  }

  // Prevent changing funding goal after funding starts
  if (
    updates.fundingGoal !== undefined &&
    event.status !== "draft" &&
    String(updates.fundingGoal) !== String(event.fundingGoal)
  ) {
    throw new BadRequestError(
      "Cannot change funding goal after funding starts",
    );
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new BadRequestError("No valid event fields were provided");
  }

  // Apply updates
  const updatedEvent = await repository.updateById(eventId, sanitizedUpdates);
  return updatedEvent;
}

/**
 * Delete event (only draft events)
 * @param {string} eventId - Event ID
 * @param {Object} user - User object with walletAddress
 * @param {Object} repos - Injected repositories (for testing)
 * @param {Object} uploadSvc - Upload service for deleting images (for testing)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteEvent(eventId, user, repos = {}, uploadSvc = null) {
  const repository = repos.eventRepo || eventRepo;
  const uploader = uploadSvc || getDefaultUploadService();

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new ForbiddenError("Not authorized to delete this event");
  }

  // Only allow deleting draft events
  if (event.status !== "draft") {
    throw new BadRequestError("Only draft events can be deleted");
  }

  // Delete all event images from Cloudinary before deleting the event
  if (event.imageUrls && event.imageUrls.length > 0) {
    try {
      await uploader.deleteMultipleImages(event.imageUrls);
    } catch (error) {
      // Log error but don't fail event deletion
      console.error("Failed to delete event images from Cloudinary:", error);
    }
  }

  return await repository.deleteById(eventId);
}

/**
 * Get event statistics
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object|null>} Event stats or null
 */
export async function getEventStats(eventId, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  // Calculate funding progress
  const fundingProgress =
    toBigInt(event.fundingGoal) > toBigInt("0")
      ? Number(
        (toBigInt(event.currentFunding) * toBigInt("100")) /
        toBigInt(event.fundingGoal),
      )
      : 0;

  // Calculate ticket availability
  const ticketsAvailable = event.totalTickets - event.ticketsSold;

  // Calculate ticket usage rate
  const ticketUsageRate =
    event.ticketsSold > 0
      ? (event.totalTicketsUsed / event.ticketsSold) * 100
      : 0;

  return {
    eventId: event._id,
    fundingProgress,
    currentFunding: event.currentFunding,
    fundingGoal: event.fundingGoal,
    ticketsSold: event.ticketsSold,
    ticketsAvailable,
    totalTickets: event.totalTickets,
    totalTicketsUsed: event.totalTicketsUsed,
    ticketUsageRate: Math.round(ticketUsageRate * 100) / 100,
  };
}

/**
 * Update funding status
 * @param {string} eventId - Event ID
 * @param {Object} fundingData - Funding data
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateFundingStatus(eventId, fundingData, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const event = await repository.findById(eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  // Prepare updates
  const updates = {};

  // Update current funding
  if (fundingData.currentFunding !== undefined) {
    updates.currentFunding = fundingData.currentFunding;
  }

  // Check if funding goal reached
  const newFunding =
    fundingData.currentFunding !== undefined
      ? fundingData.currentFunding
      : event.currentFunding;

  if (
    compareBigInt(newFunding, event.fundingGoal) >= 0 &&
    event.status === "funding"
  ) {
    updates.status = "funded";
  }

  return await repository.updateFundingStatus(eventId, updates);
}

async function rebuildSharePercentagesAndFunding(eventId) {
  const event = await eventRepo.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  const contributions = await Contribution.find({
    eventId: event._id,
    status: "confirmed",
    type: "donator_contribution",
  }).lean();

  const totalFunding = contributions.reduce(
    (sum, contribution) => addBigInt(sum, contribution.amount || "0"),
    "0",
  );

  const holders = contributions.reduce((map, contribution) => {
    const holder = contribution.contributor?.toLowerCase();
    if (!holder) return map;
    map[holder] = addBigInt(map[holder] || "0", contribution.amount || "0");
    return map;
  }, {});

  const bulkOperations = Object.entries(holders).map(
    ([holder, contributionAmount]) => ({
      updateOne: {
        filter: { eventId: event._id, holder },
        update: {
          $set: {
            contributionAmount,
            sharePercentage: calculatePercentage(
              contributionAmount,
              totalFunding,
            ),
          },
          $setOnInsert: {
            claimedReward: "0",
            pendingReward: "0",
            mintedShares: "0",
          },
        },
        upsert: true,
      },
    }),
  );

  if (bulkOperations.length > 0) {
    await Share.bulkWrite(bulkOperations);
  }

  return {
    currentFunding: totalFunding,
    status:
      compareBigInt(totalFunding, event.fundingGoal) >= 0 &&
        event.status === "funding"
        ? "funded"
        : event.status,
  };
}

export async function investInEvent(eventId, amount, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;

  if (!user || !user.walletAddress) {
    throw new BadRequestError("Authenticated user is required to invest");
  }

  if (!isValidObjectId(eventId)) {
    throw new BadRequestError("Invalid event id");
  }

  const event = await repository.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  if (event.status !== "funding") {
    throw new BadRequestError("Event is not open for investment");
  }

  let normalizedAmount;
  try {
    normalizedAmount = toStringBigInt(amount);
  } catch {
    throw new BadRequestError("Investment amount must be a positive integer");
  }

  if (compareBigInt(normalizedAmount, "0") <= 0) {
    throw new BadRequestError("Investment amount must be a positive integer");
  }

  const existingShare = await shareRepository.findByEventAndHolder(
    eventId,
    user.walletAddress,
  );

  const updatedContributionAmount = existingShare
    ? addBigInt(existingShare.contributionAmount || "0", normalizedAmount)
    : normalizedAmount;

  const sharePayload = {
    eventId,
    holder: user.walletAddress.toLowerCase(),
    contributionAmount: updatedContributionAmount,
    sharePercentage: 0,
    claimedReward: existingShare?.claimedReward ?? "0",
    pendingReward: existingShare?.pendingReward ?? "0",
    mintedShares: existingShare?.mintedShares ?? "0",
  };

  if (existingShare) {
    await Share.findOneAndUpdate(
      { eventId, holder: user.walletAddress.toLowerCase() },
      {
        $set: {
          contributionAmount: updatedContributionAmount,
        },
      },
      { new: true, runValidators: true, lean: true },
    );
  } else {
    await shareRepository.createShare(sharePayload);
  }

  const txHash =
    `invest_${eventId}_${user.walletAddress.toLowerCase()}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`.toLowerCase();

  await Contribution.create({
    eventId,
    contributor: user.walletAddress.toLowerCase(),
    type: "donator_contribution",
    amount: normalizedAmount,
    sharePercentage: 0,
    txHash,
    status: "confirmed",
    timestamp: new Date(),
  });

  const fundingUpdates = await rebuildSharePercentagesAndFunding(eventId);
  await repository.updateFundingStatus(eventId, fundingUpdates);

  const updatedShare = await Share.findOne({
    eventId,
    holder: user.walletAddress.toLowerCase(),
  })
    .populate("eventId")
    .lean();

  return updatedShare;
}

/**
 * Delete a specific image from an event
 * @param {string} eventId - Event ID
 * @param {string} imageUrl - Image URL to delete
 * @param {Object} user - User object with walletAddress
 * @param {Object} repos - Injected repositories (for testing)
 * @param {Object} uploadSvc - Upload service for deleting images (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function deleteEventImage(
  eventId,
  imageUrl,
  user,
  repos = {},
  uploadSvc = null,
) {
  const repository = repos.eventRepo || eventRepo;
  const uploader = uploadSvc || getDefaultUploadService();

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new ForbiddenError("Not authorized to modify this event");
  }

  // Check if image exists in event
  if (!event.imageUrls || !event.imageUrls.includes(imageUrl)) {
    throw new NotFoundError("Image not found in event");
  }

  // Delete image from Cloudinary
  try {
    await uploader.deleteImage(imageUrl);
  } catch (error) {
    console.error("Failed to delete image from Cloudinary:", error);
    // Continue with database update even if Cloudinary deletion fails
  }

  // Remove image URL from event
  const updatedImageUrls = event.imageUrls.filter((url) => url !== imageUrl);
  const updatedEvent = await repository.updateById(eventId, {
    imageUrls: updatedImageUrls,
  });

  return updatedEvent;
}
