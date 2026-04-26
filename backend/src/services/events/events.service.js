import { isValidObjectId } from "mongoose";
import { ethers } from "ethers";
import * as eventRepo from "../../repositories/event.repo.js";
import * as userRepo from "../../repositories/user.repo.js";
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
import Event from "../../models/Event.model.js";
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

const createEventWithInvestmentInterface = new ethers.Interface([
  "function createEventWithInvestment(uint256 fundingGoal,uint256 fundingDeadline,uint256 minStakeRequired,uint256 organizerShareBps,uint256 ticketPrice,uint256 maxTickets,uint256 usedThreshold,bool investmentEnabled) payable returns (uint256 eventId)",
]);

let cachedNoInvestCreateSupport = null;
const TX_RECEIPT_WAIT_TIMEOUT_MS = Number(
  process.env.TX_RECEIPT_WAIT_TIMEOUT_MS || 120000,
);

function getBackendSigner() {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new BadRequestError(
      "Missing BACKEND_SIGNER_PRIVATE_KEY for relayer event creation",
    );
  }

  return new ethers.Wallet(privateKey, provider);
}

function getBlockchainErrorMessage(error) {
  if (!error || typeof error !== "object") {
    return String(error || "Unknown blockchain error");
  }

  return (
    error.shortMessage ||
    error.reason ||
    error.message ||
    error.info?.error?.message ||
    error.error?.message ||
    "Unknown blockchain error"
  );
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

async function supportsNoInvestCreate(fundContract, fundWithSigner) {
  const address = (await fundContract.getAddress()).toLowerCase();
  const noInvestCreate = fundWithSigner.createEventWithInvestment;

  if (
    typeof noInvestCreate !== "function" ||
    typeof noInvestCreate.staticCall !== "function"
  ) {
    cachedNoInvestCreateSupport = {
      address,
      supported: false,
    };
    return false;
  }

  if (
    cachedNoInvestCreateSupport &&
    cachedNoInvestCreateSupport.address === address
  ) {
    return cachedNoInvestCreateSupport.supported;
  }

  try {
    await noInvestCreate.staticCall(0n, 0n, 1n, 7000n, 1n, 1n, 1n, false, {
      value: 1n,
    });

    cachedNoInvestCreateSupport = {
      address,
      supported: true,
    };
    return true;
  } catch {
    cachedNoInvestCreateSupport = {
      address,
      supported: false,
    };
    return false;
  }
}

function validateTransactionHash(txHash) {
  if (!txHash || !ethers.isHexString(txHash, 32)) {
    throw new BadRequestError("Invalid transaction hash");
  }
}

async function getMinedReceipt(txHash) {
  let receipt = null;

  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    receipt = null;
  }

  if (receipt) {
    return receipt;
  }

  try {
    receipt = await provider.waitForTransaction(
      txHash,
      1,
      TX_RECEIPT_WAIT_TIMEOUT_MS,
    );
  } catch {
    receipt = null;
  }

  return receipt || null;
}

async function parseFundEventsFromReceipt(receipt) {
  const fund = getFund();
  const fundAddress = (await fund.getAddress()).toLowerCase();
  const parsedEvents = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== fundAddress) {
      continue;
    }

    try {
      const parsed = fund.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });
      parsedEvents.push(parsed);
    } catch {
      // Ignore decode failures for unrelated logs.
    }
  }

  return parsedEvents;
}

function getAuthenticatedWalletAddress(
  user,
  requestedAddress = null,
  fieldName = "walletAddress",
) {
  const eoa = user?.walletAddress?.toLowerCase();
  const smart = user?.smartAccountAddress?.toLowerCase();

  if (requestedAddress) {
    const normalizedRequested = String(requestedAddress).toLowerCase();
    if (normalizedRequested === eoa || normalizedRequested === smart) {
      return normalizedRequested;
    }

    throw new BadRequestError(`${fieldName} must match authenticated wallet`);
  }

  // Default to EOA, fallback to smart account when EOA is unavailable.
  const candidate = eoa || smart;
  if (!candidate) {
    throw new BadRequestError("Authenticated user wallet is required");
  }
  return candidate;
}

function getUserSigningAddress(user, requestedAddress = null) {
  return getAuthenticatedWalletAddress(
    user,
    requestedAddress,
    "organizerAddress",
  );
}

function getUserOwnedAddresses(user) {
  return Array.from(
    new Set(
      [user?.walletAddress, user?.smartAccountAddress]
        .filter(Boolean)
        .map((address) => String(address).toLowerCase()),
    ),
  );
}

function isEventOwnedByUser(event, user) {
  const owner = event.organizer?.toLowerCase();
  return owner && getUserOwnedAddresses(user).includes(owner);
}

function resolveCreatedEventStatus(createdEvent) {
  const fundingGoal = createdEvent?.args?.fundingGoal;
  return Number(fundingGoal ?? 0) > 0 ? "funding" : "funded";
}

function buildConfirmedEventPatch(draftEvent, extra = {}) {
  return {
    title: draftEvent.title,
    description: draftEvent.description,
    category: draftEvent.category,
    organizer: draftEvent.organizer,
    organizerStake: draftEvent.organizerStake,
    minStakeRequired: draftEvent.minStakeRequired,
    fundingGoal: draftEvent.fundingGoal,
    currentFunding: draftEvent.currentFunding,
    organizerShareBps: draftEvent.organizerShareBps,
    fundingDeadline: draftEvent.fundingDeadline,
    ticketPrice: draftEvent.ticketPrice,
    maxTickets: draftEvent.maxTickets,
    usedThreshold: draftEvent.usedThreshold,
    startDate: draftEvent.startDate,
    endDate: draftEvent.endDate,
    ticketingStartAt: draftEvent.ticketingStartAt,
    ticketingEndAt: draftEvent.ticketingEndAt,
    venue: draftEvent.venue,
    imageUrls: draftEvent.imageUrls,
    metadataUri: draftEvent.metadataUri,
    totalTickets: draftEvent.totalTickets,
    ticketsSold: draftEvent.ticketsSold,
    totalTicketsUsed: draftEvent.totalTicketsUsed,
    ticketTiers: draftEvent.ticketTiers,
    ticketUsageThreshold: draftEvent.ticketUsageThreshold,
    ...extra,
  };
}

function asBigInt(value, fieldName) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid integer string`);
  }
}

function calculatePercentage(part, total) {
  const partValue = toBigInt(part || "0");
  const totalValue = toBigInt(total || "0");
  if (totalValue <= 0n) return 0;

  // Keep two decimal places.
  return Number((partValue * 10000n) / totalValue) / 100;
}

function resolveOwnerStatusTransition(currentStatus, requestedStatus) {
  if (!requestedStatus) {
    return null;
  }

  if (requestedStatus === currentStatus) {
    return requestedStatus;
  }

  const allowedTransitions = {
    draft: ["cancelled"],
    funding: ["cancelled"],
    funded: [],
    ticketing: [],
    ongoing: [],
    completed: [],
    cancelled: [],
    failed: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(requestedStatus)) {
    throw new BadRequestError(
      `Cannot change status from ${currentStatus} to ${requestedStatus}`,
    );
  }

  return requestedStatus;
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

function resolveImmediateFundingDeadline(eventData) {
  const startDate = eventData?.startDate ? new Date(eventData.startDate) : null;
  if (startDate && Number.isFinite(startDate.getTime())) {
    return new Date(Math.max(startDate.getTime() - 1000, 0));
  }

  return new Date();
}

function parseOptionalIsoDateTime(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid ISO datetime`);
  }

  return parsed;
}

function resolveTicketingTimeline(eventData, fundingDeadlineDate) {
  const startDate = parseOptionalIsoDateTime(eventData?.startDate, "startDate");
  const ticketingStartAt = parseOptionalIsoDateTime(
    eventData?.ticketingStartAt,
    "ticketingStartAt",
  );
  const ticketingEndAt = parseOptionalIsoDateTime(
    eventData?.ticketingEndAt,
    "ticketingEndAt",
  );

  if (ticketingEndAt && !ticketingStartAt) {
    throw new BadRequestError(
      "ticketingStartAt is required when ticketingEndAt is provided",
    );
  }

  if (ticketingStartAt && fundingDeadlineDate) {
    if (ticketingStartAt <= fundingDeadlineDate) {
      throw new BadRequestError(
        "ticketingStartAt must be after fundingDeadline",
      );
    }
  }

  if (
    ticketingStartAt &&
    ticketingEndAt &&
    ticketingEndAt <= ticketingStartAt
  ) {
    throw new BadRequestError("ticketingEndAt must be after ticketingStartAt");
  }

  if (ticketingEndAt && startDate && ticketingEndAt >= startDate) {
    throw new BadRequestError("ticketingEndAt must be before event startDate");
  }

  return {
    ticketingStartAt,
    ticketingEndAt,
  };
}

function resolveFundingConfig(eventData) {
  const investmentExplicitlyDisabled = eventData?.investmentEnabled === false;

  if (investmentExplicitlyDisabled) {
    const organizerStake = eventData.organizerStake
      ? asBigInt(eventData.organizerStake, "organizerStake")
      : eventData.minStakeRequired
        ? asBigInt(eventData.minStakeRequired, "minStakeRequired")
        : 0n;

    if (organizerStake <= 0n) {
      throw new BadRequestError(
        "organizerStake must be greater than 0 when investment is disabled",
      );
    }

    return {
      investmentEnabled: false,
      fundingGoal: 0n,
      minStakeRequired: organizerStake,
      organizerStake,
      fundingDeadlineDate: null,
    };
  }

  const fundingGoalInput = eventData.fundingGoal;
  const hasFundingGoal =
    fundingGoalInput !== undefined &&
    fundingGoalInput !== null &&
    String(fundingGoalInput).trim() !== "";

  if (!hasFundingGoal) {
    const organizerStake = eventData.organizerStake
      ? asBigInt(eventData.organizerStake, "organizerStake")
      : 0n;

    if (organizerStake > 0n) {
      return {
        investmentEnabled: false,
        fundingGoal: 0n,
        minStakeRequired: organizerStake,
        organizerStake,
        fundingDeadlineDate: null,
      };
    }

    return {
      investmentEnabled: false,
      fundingGoal: 0n,
      minStakeRequired: 0n,
      organizerStake: 0n,
      fundingDeadlineDate: null,
    };
  }

  const fundingGoal = asBigInt(fundingGoalInput, "fundingGoal");
  if (fundingGoal < 0n) {
    throw new BadRequestError("fundingGoal must not be negative");
  }

  if (fundingGoal === 0n) {
    const organizerStake = eventData.organizerStake
      ? asBigInt(eventData.organizerStake, "organizerStake")
      : eventData.minStakeRequired
        ? asBigInt(eventData.minStakeRequired, "minStakeRequired")
        : 0n;

    if (organizerStake <= 0n) {
      throw new BadRequestError(
        "organizerStake must be greater than 0 when fundingGoal is 0",
      );
    }

    return {
      investmentEnabled: false,
      fundingGoal: 0n,
      minStakeRequired: organizerStake,
      organizerStake,
      fundingDeadlineDate: null,
    };
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

  return {
    investmentEnabled: true,
    fundingGoal,
    minStakeRequired,
    organizerStake,
    fundingDeadlineDate,
  };
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
  const {
    investmentEnabled,
    fundingGoal,
    minStakeRequired,
    organizerStake,
    fundingDeadlineDate,
  } = resolveFundingConfig(eventData);
  const { ticketingStartAt, ticketingEndAt } = resolveTicketingTimeline(
    eventData,
    fundingDeadlineDate,
  );

  const organizerShareBps = Number(eventData.organizerShareBps ?? 7000);
  const ticketPrice = resolveDraftTicketPriceNumber(eventData);
  if (
    !Number.isFinite(ticketPrice) ||
    !Number.isInteger(ticketPrice) ||
    ticketPrice <= 0
  ) {
    throw new BadRequestError(
      "ticketPrice is required and must be a positive integer (or provide ticketTiers[0].price)",
    );
  }

  const maxTickets = BigInt(eventData.totalTickets);
  if (maxTickets <= 0n) {
    throw new BadRequestError("totalTickets must be greater than 0");
  }

  const usedThreshold = BigInt(
    eventData.usedThreshold ?? eventData.totalTickets,
  );

  if (!investmentEnabled && organizerStake <= 0n) {
    throw new BadRequestError(
      "organizerStake must be greater than 0 when investment is disabled",
    );
  }

  if (usedThreshold <= 0n || usedThreshold > maxTickets) {
    throw new BadRequestError(
      "usedThreshold must be between 1 and totalTickets",
    );
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
      fundingDeadline: fundingDeadlineDate?.toISOString(),
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
    status: investmentEnabled ? "funding" : "draft",
    organizerStake: organizerStake.toString(),
    minStakeRequired: minStakeRequired.toString(),
    fundingGoal: fundingGoal.toString(),
    fundingDeadline: fundingDeadlineDate,
    ticketingStartAt,
    ticketingEndAt,
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
    const effectiveFundingDeadlineDate = investmentEnabled
      ? fundingDeadlineDate || resolveImmediateFundingDeadline(eventData)
      : null;

    const tx = investmentEnabled
      ? await fundWithSigner.createEvent(
          fundingGoal,
          BigInt(Math.floor(effectiveFundingDeadlineDate.getTime() / 1000)),
          minStakeRequired,
          BigInt(organizerShareBps),
          BigInt(ticketPrice),
          maxTickets,
          usedThreshold,
          {
            value: organizerStake,
          },
        )
      : await sendCreateEventWithInvestmentTx(
          fundReadOnly,
          fundWithSigner,
          [
            0n,
            0n,
            organizerStake,
            BigInt(organizerShareBps),
            BigInt(ticketPrice),
            maxTickets,
            usedThreshold,
            false,
          ],
          {
            value: organizerStake,
          },
        );

    const receipt = await tx.wait();
    if (!receipt) {
      throw new BadRequestError(
        "Relayer transaction receipt was not available",
      );
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
      if (
        !log?.address ||
        log.address.toLowerCase() !== fundAddress.toLowerCase()
      )
        continue;

      try {
        const parsed = fundReadOnly.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed?.name === "EventCreated") {
          contractEventId = String(parsed.args?.eventId);
          onChainOrganizer = String(
            parsed.args?.organizer || backendSigner.address,
          ).toLowerCase();
          break;
        }
      } catch {
        // Ignore non-Fund logs.
      }
    }

    if (!contractEventId) {
      throw new BadRequestError(
        "Relayer tx mined but EventCreated was not found in receipt",
      );
    }

    let updated = await repository.updateById(event._id, {
      contractEventId,
      fundContractAddress: fundAddress.toLowerCase(),
      onChainOrganizer,
      status: investmentEnabled ? "funding" : "funded",
      fundingDeadline: effectiveFundingDeadlineDate,
    });

    return updated || event;
  } catch (error) {
    await repository.deleteById(event._id);

    const rawMessage = getBlockchainErrorMessage(error);
    const normalizedMessage = rawMessage.toLowerCase();
    const isLikelyContractRevert =
      normalizedMessage.includes("execution reverted") ||
      normalizedMessage.includes("badparam") ||
      normalizedMessage.includes("call exception");

    if (!investmentEnabled && isLikelyContractRevert) {
      const fundReadOnly = getFund();
      const backendSigner = getBackendSigner();
      const fundWithSigner = fundReadOnly.connect(backendSigner);
      const contractSupportsNoInvestCreate = await supportsNoInvestCreate(
        fundReadOnly,
        fundWithSigner,
      );

      if (!contractSupportsNoInvestCreate) {
        throw new BadRequestError(
          "The deployed Fund contract does not match the latest no-invest stake logic yet. Redeploy the updated Fund contract, update FUND_ADDRESS, and restart backend before creating self-funded events.",
        );
      }

      throw new BadRequestError(
        `Create self-funded event transaction reverted: ${rawMessage}`,
      );
    }

    if (investmentEnabled && isLikelyContractRevert) {
      throw new BadRequestError(
        `Create event transaction reverted: ${rawMessage}`,
      );
    }

    throw error;
  }
}

/**
 * Build user-signed create-event intent and persist draft event.
 */
export async function createCreateEventIntent(eventData, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const fund = getFund();
  const {
    investmentEnabled,
    fundingGoal,
    minStakeRequired,
    organizerStake,
    fundingDeadlineDate,
  } = resolveFundingConfig(eventData);
  const { ticketingStartAt, ticketingEndAt } = resolveTicketingTimeline(
    eventData,
    fundingDeadlineDate,
  );
  if (investmentEnabled && !fundingDeadlineDate) {
    throw new BadRequestError(
      "Funding goal and funding deadline are required for on-chain event creation",
    );
  }

  const organizerShareBps = Number(eventData.organizerShareBps ?? 7000);
  const ticketPrice = resolveDraftTicketPriceNumber(eventData);
  if (
    !Number.isFinite(ticketPrice) ||
    !Number.isInteger(ticketPrice) ||
    ticketPrice <= 0
  ) {
    throw new BadRequestError(
      "ticketPrice is required and must be a positive integer (or provide ticketTiers[0].price)",
    );
  }

  const maxTickets = BigInt(eventData.totalTickets);
  if (maxTickets <= 0n) {
    throw new BadRequestError("totalTickets must be greater than 0");
  }

  const usedThreshold = BigInt(
    eventData.usedThreshold ?? eventData.totalTickets,
  );

  if (usedThreshold <= 0n || usedThreshold > maxTickets) {
    throw new BadRequestError(
      "usedThreshold must be between 1 and totalTickets",
    );
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
      fundingDeadline: fundingDeadlineDate?.toISOString(),
      totalTickets: Number(maxTickets),
      usedThreshold: Number(usedThreshold),
      ticketPrice,
    }));

  const organizer = getUserSigningAddress(user, eventData.organizerAddress);

  const draftEvent = await repository.createEvent({
    ...eventData,
    organizer,
    status: "draft",
    organizerShareBps,
    ticketPrice,
    usedThreshold: Number(usedThreshold),
    organizerStake: organizerStake.toString(),
    minStakeRequired: minStakeRequired.toString(),
    fundingGoal: fundingGoal.toString(),
    fundingDeadline: fundingDeadlineDate,
    ticketingStartAt,
    ticketingEndAt,
    maxTickets: Number(maxTickets),
    currentFunding: "0",
    ticketsSold: 0,
    totalTicketsUsed: 0,
    metadataUri,
  });

  const [fundAddress, network] = await Promise.all([
    fund.getAddress(),
    provider.getNetwork(),
  ]);

  const data = investmentEnabled
    ? fund.interface.encodeFunctionData("createEvent", [
        fundingGoal,
        BigInt(Math.floor(fundingDeadlineDate.getTime() / 1000)),
        minStakeRequired,
        BigInt(organizerShareBps),
        BigInt(ticketPrice),
        maxTickets,
        usedThreshold,
      ])
    : null;

  const noInvestData = createEventWithInvestmentInterface.encodeFunctionData(
    "createEventWithInvestment",
    [
      0n,
      0n,
      organizerStake,
      BigInt(organizerShareBps),
      BigInt(ticketPrice),
      maxTickets,
      usedThreshold,
      false,
    ],
  );

  return {
    draftEventId: String(draftEvent._id),
    organizer,
    transaction: {
      to: fundAddress,
      data: data ?? noInvestData,
      value: organizerStake.toString(),
      chainId: network.chainId.toString(),
      functionName: investmentEnabled
        ? "createEvent"
        : "createEventWithInvestment",
    },
  };
}

/**
 * Confirm user-signed create-event transaction and sync DB state.
 */
export async function confirmCreateEventTransaction(
  payload = {},
  user,
  repos = {},
) {
  const repository = repos.eventRepo || eventRepo;
  const { txHash, draftEventId, organizerWallet } = payload;

  validateTransactionHash(txHash);

  const normalizedOrganizer = getUserSigningAddress(user, organizerWallet);

  let receipt;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    throw new BadRequestError("Transaction not mined yet");
  }

  if (!receipt) {
    throw new BadRequestError("Transaction not mined yet");
  }

  if (Number(receipt.status) !== 1) {
    throw new BadRequestError("Transaction failed on-chain");
  }

  const parsedEvents = await parseFundEventsFromReceipt(receipt);
  const createdEvents = parsedEvents.filter(
    (event) => event?.name === "EventCreated",
  );
  const createdEvent = createdEvents.find((event) => {
    const organizerFromChain = String(
      event.args?.organizer || "",
    ).toLowerCase();
    return organizerFromChain === normalizedOrganizer;
  });

  if (!createdEvent) {
    throw new BadRequestError(
      "EventCreated event not found in transaction receipt",
    );
  }

  const contractEventId = String(createdEvent.args?.eventId);
  const organizerFromChain = String(
    createdEvent.args?.organizer || "",
  ).toLowerCase();

  let draftEvent = null;

  if (draftEventId) {
    if (!isValidObjectId(draftEventId)) {
      throw new BadRequestError("Invalid draft event id");
    }

    draftEvent = await repository.findById(draftEventId);
    if (!draftEvent) {
      throw new NotFoundError("Draft event not found");
    }
  }

  if (!draftEvent) {
    const draftMatch = {
      fundingGoal: String(createdEvent.args?.fundingGoal),
      minStakeRequired: String(createdEvent.args?.minStakeRequired),
      ticketPrice: Number(createdEvent.args?.ticketPrice),
      maxTickets: Number(createdEvent.args?.maxTickets),
      usedThreshold: Number(createdEvent.args?.usedThreshold),
    };

    const organizerCandidates = Array.from(
      new Set([organizerFromChain, ...getUserOwnedAddresses(user)]),
    );

    for (const organizerCandidate of organizerCandidates) {
      draftEvent = await repository.findMatchingDraftForOnChainEvent({
        organizer: organizerCandidate,
        ...draftMatch,
      });

      if (draftEvent) {
        break;
      }
    }
  }

  if (!draftEvent) {
    throw new NotFoundError("Matching draft event not found for confirmation");
  }

  if (!isEventOwnedByUser(draftEvent, user)) {
    throw new ForbiddenError("Not authorized to confirm this event");
  }

  const fund = getFund();
  const fundAddress = (await fund.getAddress()).toLowerCase();
  const nextStatus = resolveCreatedEventStatus(createdEvent);

  if (
    draftEvent.contractEventId === contractEventId &&
    draftEvent.fundContractAddress?.toLowerCase() === fundAddress
  ) {
    return {
      synced: false,
      alreadySynced: true,
      txHash: txHash.toLowerCase(),
      event: draftEvent,
    };
  }

  await persistLogsFromReceipt({
    receipt,
    contract: fund,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  const existingOnChainEvent = repository.findByOnChainIdentity
    ? await repository.findByOnChainIdentity({
        contractEventId,
        fundContractAddress: fundAddress,
      })
    : null;

  if (
    existingOnChainEvent &&
    String(existingOnChainEvent._id) !== String(draftEvent._id)
  ) {
    if (!isEventOwnedByUser(existingOnChainEvent, user)) {
      throw new ForbiddenError("Not authorized to confirm this event");
    }

    const mergedEvent = await repository.updateById(
      existingOnChainEvent._id,
      buildConfirmedEventPatch(draftEvent, {
        contractEventId,
        fundContractAddress: fundAddress,
        onChainOrganizer: organizerFromChain,
        status: nextStatus,
      }),
    );

    if (!draftEvent.contractEventId) {
      await repository.deleteById(draftEvent._id);
    }

    return {
      synced: true,
      alreadySynced: false,
      txHash: txHash.toLowerCase(),
      contractEventId,
      event: mergedEvent,
    };
  }

  const updatedEvent = await repository.updateById(
    draftEvent._id,
    buildConfirmedEventPatch(draftEvent, {
      contractEventId,
      fundContractAddress: fundAddress,
      onChainOrganizer: organizerFromChain,
      status: nextStatus,
    }),
  );

  return {
    synced: true,
    alreadySynced: false,
    txHash: txHash.toLowerCase(),
    contractEventId,
    event: updatedEvent,
  };
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
  const verifierUser = await (userRepo.findByWalletAddress
    ? userRepo.findByWalletAddress(normalizedVerifier)
    : null);

  if (!verifierUser) {
    throw new NotFoundError("Verifier user not found");
  }

  if (verifierUser.role !== "verifier") {
    throw new BadRequestError("Selected user must have verifier role");
  }

  if (verifierUser.isActive === false) {
    throw new BadRequestError("Selected verifier is inactive");
  }

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
    "ticketingStartAt",
    "ticketingEndAt",
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

/**
 * Build an on-chain investment intent for user wallet signing
 */
export async function createInvestmentIntent(
  eventId,
  amount,
  user,
  repos = {},
) {
  const repository = repos.eventRepo || eventRepo;

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

  if (!event.contractEventId) {
    throw new BadRequestError("Event has not been synced to on-chain yet");
  }

  let normalizedAmount = "0";
  try {
    normalizedAmount = toStringBigInt(amount);
  } catch {
    throw new BadRequestError("Investment amount must be a positive integer");
  }
  if (compareBigInt(normalizedAmount, "0") <= 0) {
    throw new BadRequestError("Investment amount must be a positive integer");
  }

  const investor = getAuthenticatedWalletAddress(user, null, "investorWallet");
  const fund = getFund();

  const [fundAddress, network] = await Promise.all([
    fund.getAddress(),
    provider.getNetwork(),
  ]);

  const eventFundAddress = event.fundContractAddress?.toLowerCase();
  if (eventFundAddress && eventFundAddress !== fundAddress.toLowerCase()) {
    throw new BadRequestError(
      "Event is linked to a different Fund contract than backend configuration",
    );
  }

  const data = fund.interface.encodeFunctionData("contribute", [
    BigInt(event.contractEventId),
  ]);

  return {
    eventId: String(event._id),
    contractEventId: String(event.contractEventId),
    investor,
    amount: normalizedAmount,
    transaction: {
      to: fundAddress,
      data,
      value: normalizedAmount,
      chainId: network.chainId.toString(),
      functionName: "contribute",
    },
  };
}

/**
 * Confirm an on-chain investment transaction and sync DB
 */
export async function confirmInvestmentTransaction(
  eventId,
  payload = {},
  user,
  repos = {},
) {
  const repository = repos.eventRepo || eventRepo;
  const { txHash, investorWallet } = payload;

  validateTransactionHash(txHash);

  if (!isValidObjectId(eventId)) {
    throw new BadRequestError("Invalid event id");
  }

  const event = await repository.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  if (!event.contractEventId) {
    throw new BadRequestError("Event has not been synced to on-chain yet");
  }

  const normalizedInvestor = getAuthenticatedWalletAddress(
    user,
    investorWallet,
    "investorWallet",
  );

  const fund = getFund();
  const fundAddress = (await fund.getAddress()).toLowerCase();

  if (
    event.fundContractAddress &&
    event.fundContractAddress.toLowerCase() !== fundAddress
  ) {
    throw new BadRequestError(
      "Event is linked to a different Fund contract than backend configuration",
    );
  }

  const receipt = await getMinedReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError(
      "Transaction not mined yet. Please retry shortly.",
    );
  }
  if (Number(receipt.status) !== 1) {
    throw new BadRequestError("Transaction failed on-chain");
  }

  const parsedEvents = await parseFundEventsFromReceipt(receipt);
  const contributionEvents = parsedEvents.filter(
    (parsedEvent) => parsedEvent?.name === "ContributionMade",
  );

  const matchedContribution = contributionEvents.find((parsedEvent) => {
    const chainEventId = String(parsedEvent.args?.eventId ?? "");
    const chainInvestor = String(parsedEvent.args?.donator ?? "").toLowerCase();

    return (
      chainEventId === String(event.contractEventId) &&
      chainInvestor === normalizedInvestor
    );
  });

  if (!matchedContribution) {
    throw new BadRequestError(
      "ContributionMade event not found in transaction receipt for this user/event",
    );
  }

  let amountFromChain = "0";
  try {
    amountFromChain = toStringBigInt(String(matchedContribution.args?.amount));
  } catch {
    throw new BadRequestError(
      "Invalid contribution amount from on-chain receipt",
    );
  }

  if (compareBigInt(amountFromChain, "0") <= 0) {
    throw new BadRequestError("On-chain contribution amount must be positive");
  }

  await persistLogsFromReceipt({
    receipt,
    contract: fund,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  const normalizedTxHash = txHash.toLowerCase();
  const existingContribution = await Contribution.findOne({
    txHash: normalizedTxHash,
    type: "donator_contribution",
  }).lean();

  let alreadySynced = false;
  if (existingContribution) {
    const sameEvent =
      String(existingContribution.eventId || "") === String(event._id);
    const sameContributor =
      String(existingContribution.contributor || "").toLowerCase() ===
      normalizedInvestor;

    if (!sameEvent || !sameContributor) {
      throw new BadRequestError(
        "Transaction hash already belongs to another contribution record",
      );
    }

    alreadySynced = true;
  } else {
    await Contribution.create({
      eventId: event._id,
      contributor: normalizedInvestor,
      type: "donator_contribution",
      amount: amountFromChain,
      sharePercentage: 0,
      txHash: normalizedTxHash,
      status: "confirmed",
      blockNumber: receipt.blockNumber,
      timestamp: new Date(),
    });
  }

  const fundingUpdates = await rebuildSharePercentagesAndFunding(
    String(event._id),
  );
  const updatedEvent = await repository.updateFundingStatus(
    eventId,
    fundingUpdates,
  );

  const updatedShare = await Share.findOne({
    eventId: event._id,
    holder: normalizedInvestor,
  })
    .populate("eventId")
    .lean();

  return {
    synced: !alreadySynced,
    alreadySynced,
    txHash: normalizedTxHash,
    event: updatedEvent,
    share: updatedShare,
  };
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
