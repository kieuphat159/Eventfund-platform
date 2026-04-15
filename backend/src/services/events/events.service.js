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
import { uploadEventMetadataToIpfs } from "../upload/ipfs.service.js";
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
    throw new BadRequestError("Missing BACKEND_SIGNER_PRIVATE_KEY for relayer event creation");
  }

  return new ethers.Wallet(privateKey, provider);
}

function getUserSigningAddress(user, requestedAddress = null) {
  const eoa = user?.walletAddress?.toLowerCase();
  const smart = user?.smartAccountAddress?.toLowerCase();

  if (requestedAddress) {
    const normalizedRequested = String(requestedAddress).toLowerCase();
    if (normalizedRequested === eoa || normalizedRequested === smart) {
      return normalizedRequested;
    }

    throw new BadRequestError("organizerAddress must match authenticated wallet");
  }

  // Default to EOA, fallback to smart account when EOA is unavailable.
  const candidate = eoa || smart;
  if (!candidate) {
    throw new BadRequestError("Authenticated user wallet is required");
  }
  return candidate;
}

function isEventOwnedByUser(event, user) {
  const owner = event.organizer?.toLowerCase();
  const eoa = user.walletAddress?.toLowerCase();
  const smart = user.smartAccountAddress?.toLowerCase();
  return owner && (owner === eoa || owner === smart);
}

function asBigInt(value, fieldName) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid integer string`);
  }
}

function resolveDraftTicketPriceNumber(eventData) {
  if (eventData.ticketPrice !== undefined && eventData.ticketPrice !== null) {
    return Number(eventData.ticketPrice);
  }

  const firstTierPrice = eventData.ticketTiers?.[0]?.price;
  if (firstTierPrice === undefined || firstTierPrice === null) return 0;

  return Number(firstTierPrice);
}

function resolveDefaultMinStakeRequired(fundingGoal, minStakeRequired) {
  if (minStakeRequired !== undefined && minStakeRequired !== null) {
    return asBigInt(minStakeRequired, "minStakeRequired");
  }

  // Default organizer stake requirement = 10% funding goal when not provided.
  return fundingGoal / 10n;
}


/**
 * Create a new event in draft status (off-chain only)
 * @param {Object} eventData - Event data
 * @param {Object} user - User object with walletAddress and role
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Created event
 */
export async function createEvent(eventData, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const fundingGoal = asBigInt(eventData.fundingGoal, "fundingGoal");
  if (fundingGoal <= 0n) {
    throw new BadRequestError("fundingGoal must be greater than 0");
  }

  const fundingDeadlineDate = new Date(eventData.fundingDeadline);
  if (!Number.isFinite(fundingDeadlineDate.getTime())) {
    throw new BadRequestError("fundingDeadline must be a valid ISO datetime");
  }

  const minStakeRequired = resolveDefaultMinStakeRequired(
    fundingGoal,
    eventData.minStakeRequired,
  );
  if (minStakeRequired <= 0n) {
    throw new BadRequestError("minStakeRequired must be greater than 0");
  }

  const organizerStake = eventData.organizerStake
    ? asBigInt(eventData.organizerStake, "organizerStake")
    : minStakeRequired;

  if (organizerStake < minStakeRequired) {
    throw new BadRequestError("organizerStake must be >= minStakeRequired");
  }

  const organizerShareBps = Number(eventData.organizerShareBps ?? 7000);
  const ticketPrice = resolveDraftTicketPriceNumber(eventData);
  if (!Number.isFinite(ticketPrice) || !Number.isInteger(ticketPrice) || ticketPrice <= 0) {
    throw new BadRequestError(
      "ticketPrice is required and must be a positive integer (or provide ticketTiers[0].price)",
    );
  }

  const maxTickets = BigInt(eventData.totalTickets);
  if (maxTickets <= 0n) {
    throw new BadRequestError("totalTickets must be greater than 0");
  }

  const usedThreshold = BigInt(eventData.usedThreshold ?? eventData.totalTickets);

  if (usedThreshold <= 0n || usedThreshold > maxTickets) {
    throw new BadRequestError("usedThreshold must be between 1 and totalTickets");
  }

  const metadataUri =
    eventData.metadataUri ||
    (await uploadEventMetadataToIpfs({
      title: eventData.title,
      description: eventData.description,
      category: eventData.category,
      venue: eventData.venue,
      startDate: eventData.startDate,
      endDate: eventData.endDate,
      imageUrls: eventData.imageUrls || [],
      ticketTiers: eventData.ticketTiers || [],
      fundingGoal: fundingGoal.toString(),
      minStakeRequired: minStakeRequired.toString(),
      organizerStake: organizerStake.toString(),
      fundingDeadline: fundingDeadlineDate.toISOString(),
      totalTickets: Number(maxTickets),
      usedThreshold: Number(usedThreshold),
      ticketPrice,
    }));

  const event = await repository.createEvent({
    ...eventData,
    organizerShareBps,
    ticketPrice,
    usedThreshold: Number(usedThreshold),
    organizer: getUserSigningAddress(user, eventData.organizerAddress),
    status: "funding",
    organizerStake: organizerStake.toString(),
    minStakeRequired: minStakeRequired.toString(),
    fundingGoal: fundingGoal.toString(),
    fundingDeadline: fundingDeadlineDate,
    maxTickets: Number(maxTickets),
    currentFunding: "0",
    ticketsSold: 0,
    totalTicketsUsed: 0,
    metadataUri,
  });

  try {
    const fundReadOnly = getFund();
    const fundAddress = await fundReadOnly.getAddress();
    const backendSigner = getBackendSigner();
    const fundWithSigner = fundReadOnly.connect(backendSigner);

    const tx = await fundWithSigner.createEvent(
      fundingGoal,
      BigInt(Math.floor(fundingDeadlineDate.getTime() / 1000)),
      minStakeRequired,
      BigInt(organizerShareBps),
      BigInt(ticketPrice),
      maxTickets,
      usedThreshold,
      {
        value: organizerStake,
      },
    );

    const receipt = await tx.wait();
    if (!receipt) {
      throw new BadRequestError("Relayer transaction receipt was not available");
    }

    await persistLogsFromReceipt({
      receipt,
      contract: fundReadOnly,
      contractName: "Fund",
      contractAddress: fundAddress,
    });

    let contractEventId = null;
    let onChainOrganizer = null;
    for (const log of receipt.logs || []) {
      if (!log?.address || log.address.toLowerCase() !== fundAddress.toLowerCase()) continue;

      try {
        const parsed = fundReadOnly.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "EventCreated") {
          contractEventId = String(parsed.args?.eventId);
          onChainOrganizer = String(parsed.args?.organizer || backendSigner.address).toLowerCase();
          break;
        }
      } catch {
        // Ignore non-Fund logs.
      }
    }

    if (!contractEventId) {
      throw new BadRequestError("Relayer tx mined but EventCreated was not found in receipt");
    }

    const updated = await repository.updateById(event._id, {
      contractEventId,
      onChainOrganizer,
      status: "funding",
    });

    return updated || event;
  } catch (error) {
    await repository.deleteById(event._id);
    throw error;
  }
}

/**
 * Get blockchain config required for frontend direct contract interaction
 */
export async function getEventBlockchainConfig() {
  const fund = getFund();
  const [fundAddress, network] = await Promise.all([
    fund.getAddress(),
    provider.getNetwork(),
  ]);

  return {
    fundAddress: fundAddress.toLowerCase(),
    chainId: network.chainId.toString(),
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

  if (!isEventOwnedByUser(event, user)) {
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
  if (!isEventOwnedByUser(event, user)) {
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
  if (!isEventOwnedByUser(event, user)) {
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
