import { isValidObjectId } from "mongoose";
import { ethers } from "ethers";
import * as eventRepo from "../../repositories/event.repo.js";
import * as userRepo from "../../repositories/user.repo.js";
import * as shareRepo from "../../repositories/share.repo.js";
import * as contributionRepo from "../../repositories/contribution.repo.js";
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
import { getFund, getTicket, provider } from "../blockchain/index.js";
import { persistLogsFromReceipt } from "../blockchain/core/receiptChainLog.js";
import { scheduleAutoRefundsForTerminalEvent } from "./terminalRefunds.service.js";

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
      "Missing BACKEND_SIGNER_PRIVATE_KEY for relayer event creation",
    );
  }

  return new ethers.Wallet(privateKey, provider);
}

function parseOnChainEventId(event) {
  const contractEventId = String(event?.contractEventId || "").trim();
  if (!contractEventId) {
    throw new BadRequestError("Event has not been synced to on-chain yet");
  }

  if (!/^\d+$/.test(contractEventId)) {
    throw new BadRequestError(
      `Event contractEventId must be a numeric on-chain event id, got: ${contractEventId}`,
    );
  }

  return BigInt(contractEventId);
}

function getRawBlockchainErrorMessage(error) {
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

function mapFundCustomErrorToMessage(errorName) {
  const messages = {
    NotAuthorized:
      "Backend signer is not authorized to cancel this event. Organizer wallet signature is required.",
    NotOrganizer:
      "Only the organizer can perform this on-chain action from the connected wallet.",
    EventNotFound: "Event was not found on-chain.",
    AlreadyFinalized: "Event is already cancelled or finalized on-chain.",
    Unsafe: "Event cannot be cancelled in its current on-chain state.",
    BadParam:
      "Cancellation parameters are invalid for the current on-chain state.",
    NotFunding: "Event is not in funding state on-chain.",
    NotFunded: "Event is not in funded state on-chain.",
    NotTicketing: "Event is not in ticketing state on-chain.",
    NotCompleted: "Event is not completed on-chain.",
    FundingClosed: "Funding is already closed on-chain.",
    ShareLocked: "Event shares are already finalized on-chain.",
  };

  return messages[errorName] || null;
}

function getBlockchainErrorMeta(error) {
  const fallbackMessage = getRawBlockchainErrorMessage(error);
  const normalizedFallbackMessage = String(fallbackMessage).toLowerCase();

  if (
    normalizedFallbackMessage.includes("no data present") ||
    normalizedFallbackMessage.includes("likely require(false) occurred")
  ) {
    return {
      code: "NO_REVERT_DATA",
      message:
        "On-chain cancellation reverted without error data. The deployed Fund contract may not match the current ABI/source in this repo, or FUND_ADDRESS may point to an older deployment. Verify FUND_ADDRESS on Sepolia and redeploy/update contracts if needed.",
      shouldFallbackToOrganizerWallet: false,
    };
  }

  if (
    error &&
    typeof error === "object" &&
    typeof error.revert?.name === "string"
  ) {
    const message =
      mapFundCustomErrorToMessage(error.revert.name) || fallbackMessage;
    return {
      code: error.revert.name,
      message,
      shouldFallbackToOrganizerWallet:
        error.revert.name === "NotAuthorized" ||
        error.revert.name === "NotOrganizer",
    };
  }

  const errorData = extractBlockchainErrorData(error);
  if (errorData) {
    try {
      const fund = getFund();
      if (typeof fund?.interface?.parseError === "function") {
        const parsedError = fund.interface.parseError(errorData);
        const errorName = parsedError?.name;
        if (errorName) {
          const message =
            mapFundCustomErrorToMessage(errorName) || fallbackMessage;
          return {
            code: errorName,
            message,
            shouldFallbackToOrganizerWallet:
              errorName === "NotAuthorized" || errorName === "NotOrganizer",
          };
        }
      }
    } catch {
      // Fall through to the raw error message.
    }
  }

  return {
    code: null,
    message: fallbackMessage,
    shouldFallbackToOrganizerWallet: false,
  };
}

function getBlockchainErrorMessage(error) {
  return getBlockchainErrorMeta(error).message;
}

function shouldIgnoreReleaseRevenueError(error) {
  const { code, message } = getBlockchainErrorMeta(error);
  if (code === "BadParam" || code === "AlreadyFinalized") {
    return true;
  }

  const normalizedMessage = String(message || "").toLowerCase();
  return (
    normalizedMessage.includes("already finalized") ||
    normalizedMessage.includes("badparam") ||
    normalizedMessage.includes("missing revert data") ||
    normalizedMessage.includes("estimate gas")
  );
}

async function tryReleaseRevenueAfterCompletion(
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
      const { code, message } = getBlockchainErrorMeta(stakeError);
      const normalizedMessage = String(message || "").toLowerCase();
      if (
        code !== "Unsafe" &&
        code !== "NothingToClaim" &&
        !normalizedMessage.includes("nothingtoclaim") &&
        !normalizedMessage.includes("missing revert data") &&
        !normalizedMessage.includes("estimate gas")
      ) {
        throw stakeError;
      }
    }
  } catch (error) {
    if (shouldIgnoreReleaseRevenueError(error)) {
      return;
    }

    throw new BadRequestError(
      `Event completed on-chain but release revenue failed: ${getBlockchainErrorMessage(error)}`,
    );
  }
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
    investmentEnabled: draftEvent.investmentEnabled,
    organizerStake: draftEvent.organizerStake,
    minStakeRequired: draftEvent.minStakeRequired,
    minInvestmentAmount: draftEvent.minInvestmentAmount,
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
    funded: ["cancelled", "ticketing"],
    ticketing: ["cancelled", "ongoing", "completed"],
    ongoing: ["completed"],
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

function resolveTotalTickets(eventData) {
  const tierTotal = Array.isArray(eventData.ticketTiers)
    ? eventData.ticketTiers.reduce((sum, tier) => {
        const supply = Number(tier?.totalSupply ?? 0);
        return Number.isInteger(supply) && supply > 0 ? sum + supply : sum;
      }, 0)
    : 0;

  const requestedTotal = Number(eventData.totalTickets);

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

function calculateCreationFeeWei(ticketPrice, maxTickets) {
  const totalTicketValue = BigInt(ticketPrice) * maxTickets;
  const fivePercent = totalTicketValue / 20n;

  // Keep non-zero stake so on-chain create validations pass.
  return fivePercent > 0n ? fivePercent : 1n;
}

function resolveMinInvestmentAmount(eventData, investmentEnabled) {
  if (!investmentEnabled) {
    return 0n;
  }

  if (
    eventData?.minInvestmentAmount === undefined ||
    eventData?.minInvestmentAmount === null ||
    String(eventData.minInvestmentAmount).trim() === ""
  ) {
    throw new BadRequestError(
      "minInvestmentAmount is required when investment is enabled",
    );
  }

  const minInvestmentAmount = asBigInt(
    eventData.minInvestmentAmount,
    "minInvestmentAmount",
  );

  if (minInvestmentAmount <= 0n) {
    throw new BadRequestError("minInvestmentAmount must be greater than 0");
  }

  return minInvestmentAmount;
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

const CHAIN_CANCELLATION_REASON = {
  funding_goal_not_met: 0,
  organizer_cancelled: 1,
  ticket_sales_not_met: 2,
};

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

function buildCancellationPatch(reasonMeta, user = null) {
  const actorAddress = user?.walletAddress || user?.smartAccountAddress;

  return {
    status: "cancelled",
    cancellationReason: reasonMeta.reasonCode,
    cancellationNote: reasonMeta.cancellationNote,
    cancelledAt: new Date(),
    ...(actorAddress ? { cancelledBy: actorAddress.toLowerCase() } : {}),
  };
}

async function assertEventUsesCurrentFundContract(event) {
  if (!event?.contractEventId) {
    return null;
  }

  const fund = getFund();
  const currentFundAddress = (await fund.getAddress()).toLowerCase();
  const eventFundAddress = event.fundContractAddress?.toLowerCase();

  if (eventFundAddress && eventFundAddress !== currentFundAddress) {
    throw new BadRequestError(
      "Event belongs to an older Fund deployment and can no longer be managed through the current backend configuration. Use the matching historical contract or recreate the event on the current deployment.",
    );
  }

  return {
    fund,
    currentFundAddress,
  };
}

function findParsedFundEventByNameAndEventId(
  parsedEvents,
  eventName,
  chainEventId,
) {
  const normalizedChainEventId = String(chainEventId);

  return (parsedEvents || []).find((parsedEvent) => {
    if (parsedEvent?.name !== eventName) {
      return false;
    }

    return String(parsedEvent.args?.eventId ?? "") === normalizedChainEventId;
  });
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
  const investmentExplicitlyEnabled = eventData?.investmentEnabled === true;

  if (investmentExplicitlyDisabled) {
    return {
      investmentEnabled: false,
      fundingGoal: 0n,
      minStakeRequired: 0n,
      organizerStake: 0n,
      fundingDeadlineDate: null,
    };
  }

  if (investmentExplicitlyEnabled && !eventData?.fundingGoal) {
    throw new BadRequestError(
      "fundingGoal is required when investment is enabled",
    );
  }

  const fundingGoalInput = eventData.fundingGoal;
  const hasFundingGoal =
    fundingGoalInput !== undefined &&
    fundingGoalInput !== null &&
    String(fundingGoalInput).trim() !== "";

  if (!hasFundingGoal) {
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

  if (investmentExplicitlyEnabled && fundingGoal <= 0n) {
    throw new BadRequestError(
      "fundingGoal must be greater than 0 when investment is enabled",
    );
  }

  if (fundingGoal === 0n) {
    return {
      investmentEnabled: false,
      fundingGoal: 0n,
      minStakeRequired: 0n,
      organizerStake: 0n,
      fundingDeadlineDate: null,
    };
  }

  const fundingDeadlineDate = new Date(eventData.fundingDeadline);
  if (!Number.isFinite(fundingDeadlineDate.getTime())) {
    throw new BadRequestError("fundingDeadline must be a valid ISO datetime");
  }

  return {
    investmentEnabled: true,
    fundingGoal,
    minStakeRequired: 0n,
    organizerStake: 0n,
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
  const { investmentEnabled, fundingGoal, fundingDeadlineDate } =
    resolveFundingConfig(eventData);
  const { ticketingStartAt, ticketingEndAt } = resolveTicketingTimeline(
    eventData,
    fundingDeadlineDate,
  );

  const organizerShareBps = investmentEnabled ? 7000 : 10000;
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

  const resolvedTotalTickets = resolveTotalTickets(eventData);
  const maxTickets = BigInt(resolvedTotalTickets);

  const creationFeeWei = calculateCreationFeeWei(ticketPrice, maxTickets);
  const organizerStake = creationFeeWei;
  const minStakeRequired = creationFeeWei;
  const minInvestmentAmount = resolveMinInvestmentAmount(
    eventData,
    investmentEnabled,
  );

  const usedThreshold = getHardcodedUsedThreshold(maxTickets);

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
      minInvestmentAmount: minInvestmentAmount.toString(),
      organizerStake: organizerStake.toString(),
      fundingDeadline: fundingDeadlineDate?.toISOString(),
      totalTickets: Number(maxTickets),
      usedThreshold: Number(usedThreshold),
      ticketPrice,
    }));

  const event = await repository.createEvent({
    ...eventData,
    totalTickets: resolvedTotalTickets,
    investmentEnabled,
    organizerShareBps,
    ticketPrice,
    usedThreshold: Number(usedThreshold),
    organizer: getUserSigningAddress(user, eventData.organizerAddress),
    status: investmentEnabled ? "funding" : "draft",
    organizerStake: organizerStake.toString(),
    minStakeRequired: minStakeRequired.toString(),
    minInvestmentAmount: minInvestmentAmount.toString(),
    fundingGoal: fundingGoal.toString(),
    fundingDeadline: fundingDeadlineDate,
    maxTickets: Number(maxTickets),
    currentFunding: "0",
    ticketsSold: 0,
    totalTicketsUsed: 0,
    metadataUri,
    ...(ticketingStartAt ? { ticketingStartAt } : {}),
    ...(ticketingEndAt ? { ticketingEndAt } : {}),
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
      investmentEnabled,
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
  const { investmentEnabled, fundingGoal, fundingDeadlineDate } =
    resolveFundingConfig(eventData);
  const { ticketingStartAt, ticketingEndAt } = resolveTicketingTimeline(
    eventData,
    fundingDeadlineDate,
  );
  if (investmentEnabled && !fundingDeadlineDate) {
    throw new BadRequestError(
      "Funding goal and funding deadline are required for on-chain event creation",
    );
  }

  const organizerShareBps = investmentEnabled ? 7000 : 10000;
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

  const resolvedTotalTickets = resolveTotalTickets(eventData);
  const maxTickets = BigInt(resolvedTotalTickets);

  const creationFeeWei = calculateCreationFeeWei(ticketPrice, maxTickets);
  const organizerStake = creationFeeWei;
  const minStakeRequired = creationFeeWei;
  const minInvestmentAmount = resolveMinInvestmentAmount(
    eventData,
    investmentEnabled,
  );

  const usedThreshold = getHardcodedUsedThreshold(maxTickets);

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
      minInvestmentAmount: minInvestmentAmount.toString(),
      organizerStake: organizerStake.toString(),
      fundingDeadline: fundingDeadlineDate?.toISOString(),
      totalTickets: Number(maxTickets),
      usedThreshold: Number(usedThreshold),
      ticketPrice,
    }));

  const organizer = getUserSigningAddress(user, eventData.organizerAddress);

  const draftEvent = await repository.createEvent({
    ...eventData,
    totalTickets: resolvedTotalTickets,
    investmentEnabled,
    organizer,
    status: "draft",
    organizerShareBps,
    ticketPrice,
    usedThreshold: Number(usedThreshold),
    organizerStake: organizerStake.toString(),
    minStakeRequired: minStakeRequired.toString(),
    minInvestmentAmount: minInvestmentAmount.toString(),
    fundingGoal: fundingGoal.toString(),
    fundingDeadline: fundingDeadlineDate,
    maxTickets: Number(maxTickets),
    currentFunding: "0",
    ticketsSold: 0,
    totalTicketsUsed: 0,
    metadataUri,
    ...(ticketingStartAt ? { ticketingStartAt } : {}),
    ...(ticketingEndAt ? { ticketingEndAt } : {}),
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

  if (event.contractEventId) {
    throw new BadRequestError(
      "This event is on-chain. Use the on-chain verifier assignment flow instead.",
    );
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

  return await Event.findByIdAndUpdate(
    eventId,
    { $addToSet: { verifiers: normalizedVerifier } },
    { new: true, lean: true },
  );
}

/**
 * Assign verifier on-chain and sync DB
 */
export async function assignVerifierOnChain(eventId, verifier, user) {
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

  const chainEventId = parseOnChainEventId(event);
  const ticket = getTicket().connect(getBackendSigner());

  const alreadyOnChain = await ticket.isEventVerifier(
    chainEventId,
    normalizedVerifier,
  );

  if (!alreadyOnChain) {
    const tx = await ticket.addEventVerifier(chainEventId, normalizedVerifier);
    const receipt = await tx.wait();

    if (!receipt || Number(receipt.status) !== 1) {
      throw new BadRequestError(
        "Verifier assignment transaction failed on-chain",
      );
    }
  }

  return await Event.findByIdAndUpdate(
    eventId,
    { $addToSet: { verifiers: normalizedVerifier } },
    { new: true, lean: true },
  );
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

  if (
    sanitizedUpdates.ticketTiers !== undefined ||
    sanitizedUpdates.totalTickets !== undefined
  ) {
    sanitizedUpdates.totalTickets = resolveTotalTickets({
      ...event,
      ...sanitizedUpdates,
    });
    sanitizedUpdates.maxTickets = sanitizedUpdates.totalTickets;
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

  if (nextStatus === "cancelled") {
    const reasonMeta = normalizeCancellationReason(updates.reason, event);
    const cancellationPatch = buildCancellationPatch(reasonMeta, user);
    const activeFundContext = await assertEventUsesCurrentFundContract(event);

    if (!event.contractEventId) {
      const updatedEvent = await repository.updateById(eventId, {
        ...sanitizedUpdates,
        ...cancellationPatch,
      });
      scheduleAutoRefundsForTerminalEvent(updatedEvent);
      return updatedEvent;
    }

    if (updates.txHash) {
      validateTransactionHash(updates.txHash);

      const fund = activeFundContext?.fund || getFund();
      const fundAddress =
        activeFundContext?.currentFundAddress || (await fund.getAddress());
      const receipt = await getMinedReceipt(updates.txHash);

      if (!receipt) {
        throw new BadRequestError(
          "Cancellation transaction not mined yet. Please retry shortly.",
        );
      }

      if (Number(receipt.status) !== 1) {
        throw new BadRequestError("Cancellation transaction failed on-chain");
      }

      await persistLogsFromReceipt({
        receipt,
        contract: fund,
        contractName: "Fund",
        contractAddress: fundAddress,
      });

      const parsedEvents = await parseFundEventsFromReceipt(receipt);
      const chainEventId = String(event.contractEventId);

      if (reasonMeta.reasonCode === "funding_goal_not_met") {
        const finalized = findParsedFundEventByNameAndEventId(
          parsedEvents,
          "FundingFinalized",
          chainEventId,
        );
        if (!finalized) {
          throw new BadRequestError(
            "FundingFinalized event not found in cancellation receipt for this event",
          );
        }

        const finalizedStatus = mapFundStatusToAppStatus(
          finalized.args?.statusAfterFinalize,
        );
        if (finalizedStatus !== "cancelled") {
          throw new BadRequestError(
            `Cannot cancel event because funding finalized with status ${finalizedStatus}`,
          );
        }
      } else {
        const cancelled = findParsedFundEventByNameAndEventId(
          parsedEvents,
          "EventCancelled",
          chainEventId,
        );
        if (!cancelled) {
          throw new BadRequestError(
            "EventCancelled event not found in cancellation receipt for this event",
          );
        }
      }

      return await repository.updateById(eventId, {
        ...sanitizedUpdates,
        ...cancellationPatch,
      });
    }

    const signer = getBackendSigner();
    const fund = activeFundContext?.fund || getFund();
    const fundWithSigner = fund.connect(signer);
    const chainEventId = BigInt(event.contractEventId);
    const fundAddress =
      activeFundContext?.currentFundAddress || (await fund.getAddress());

    let tx;
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
      const blockchainError = getBlockchainErrorMeta(error);
      if (blockchainError.shouldFallbackToOrganizerWallet) {
        throw new BadRequestError(
          `Organizer wallet signature required: ${blockchainError.message}`,
        );
      }

      throw new BadRequestError(
        `Failed to cancel event on-chain: ${blockchainError.message}`,
      );
    }

    const receipt = await tx.wait();
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
        (parsedEvent) => parsedEvent?.name === "FundingFinalized",
      );
      if (!finalized) {
        throw new BadRequestError(
          "FundingFinalized event not found in transaction receipt",
        );
      }

      const finalizedStatus = mapFundStatusToAppStatus(
        finalized.args?.statusAfterFinalize,
      );
      if (finalizedStatus !== "cancelled") {
        throw new BadRequestError(
          `Cannot cancel event because funding finalized with status ${finalizedStatus}`,
        );
      }
    } else {
      const cancelled = parsedEvents.find(
        (parsedEvent) => parsedEvent?.name === "EventCancelled",
      );
      if (!cancelled) {
        throw new BadRequestError(
          "EventCancelled event not found in transaction receipt",
        );
      }
    }

    const updatedEvent = await repository.updateById(eventId, {
      ...sanitizedUpdates,
      ...cancellationPatch,
    });
    scheduleAutoRefundsForTerminalEvent(updatedEvent);
    return updatedEvent;
  }

  if (nextStatus === "completed") {
    const activeFundContext = await assertEventUsesCurrentFundContract(event);

    if (!event.contractEventId) {
      throw new BadRequestError("Event has not been synced to on-chain yet");
    }

    const fund = activeFundContext?.fund || getFund();
    const fundAddress =
      activeFundContext?.currentFundAddress || (await fund.getAddress());
    const chainEventId = BigInt(event.contractEventId);
    const completionPatch = {
      ...sanitizedUpdates,
      completedAt: new Date(),
    };

    if (updates.txHash) {
      validateTransactionHash(updates.txHash);

      const completionReceipt = await getMinedReceipt(updates.txHash);
      if (!completionReceipt) {
        throw new BadRequestError(
          "Completion transaction not mined yet. Please retry shortly.",
        );
      }

      if (Number(completionReceipt.status) !== 1) {
        throw new BadRequestError("Completion transaction failed on-chain");
      }

      await persistLogsFromReceipt({
        receipt: completionReceipt,
        contract: fund,
        contractName: "Fund",
        contractAddress: fundAddress,
      });

      const completedEvents =
        await parseFundEventsFromReceipt(completionReceipt);
      const completedEvent = findParsedFundEventByNameAndEventId(
        completedEvents,
        "Completed",
        event.contractEventId,
      );

      if (!completedEvent) {
        throw new BadRequestError(
          "Completed event not found in completion receipt for this event",
        );
      }

      if (updates.releaseTxHash) {
        validateTransactionHash(updates.releaseTxHash);

        const releaseReceipt = await getMinedReceipt(updates.releaseTxHash);
        if (!releaseReceipt) {
          throw new BadRequestError(
            "Revenue release transaction not mined yet. Please retry shortly.",
          );
        }

        if (Number(releaseReceipt.status) !== 1) {
          throw new BadRequestError(
            "Revenue release transaction failed on-chain",
          );
        }

        await persistLogsFromReceipt({
          receipt: releaseReceipt,
          contract: fund,
          contractName: "Fund",
          contractAddress: fundAddress,
        });

        const releaseEvents = await parseFundEventsFromReceipt(releaseReceipt);
        const revenueReleasedEvent = findParsedFundEventByNameAndEventId(
          releaseEvents,
          "RevenueReleased",
          event.contractEventId,
        );

        if (!revenueReleasedEvent) {
          throw new BadRequestError(
            "RevenueReleased event not found in revenue release receipt for this event",
          );
        }
      }

      return await repository.updateById(eventId, completionPatch);
    }

    const signer = getBackendSigner();
    const fundWithSigner = fund.connect(signer);

    let tx;
    try {
      tx = await fundWithSigner.setCompletedIfThresholdMet(chainEventId);
    } catch (error) {
      const blockchainError = getBlockchainErrorMeta(error);
      if (blockchainError.shouldFallbackToOrganizerWallet) {
        throw new BadRequestError(
          `Organizer wallet signature required: ${blockchainError.message}`,
        );
      }

      throw new BadRequestError(
        `Failed to mark event as completed on-chain: ${blockchainError.message}`,
      );
    }

    const receipt = await tx.wait();
    if (!receipt || Number(receipt.status) !== 1) {
      throw new BadRequestError("On-chain completion transaction failed");
    }

    await persistLogsFromReceipt({
      receipt,
      contract: fund,
      contractName: "Fund",
      contractAddress: fundAddress,
    });

    const parsedEvents = await parseFundEventsFromReceipt(receipt);
    const completedEvent = findParsedFundEventByNameAndEventId(
      parsedEvents,
      "Completed",
      event.contractEventId,
    );

    if (!completedEvent) {
      throw new BadRequestError(
        "Completed event not found in transaction receipt for this event.",
      );
    }

    await tryReleaseRevenueAfterCompletion(
      fundWithSigner,
      chainEventId,
      fund,
      fundAddress,
    );

    return await repository.updateById(eventId, completionPatch);
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

  const minInvestmentAmount = toStringBigInt(event.minInvestmentAmount || "0");
  if (compareBigInt(minInvestmentAmount, "0") > 0) {
    if (compareBigInt(normalizedAmount, minInvestmentAmount) < 0) {
      throw new BadRequestError(
        `Investment amount must be at least ${minInvestmentAmount}`,
      );
    }
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

  const minInvestmentAmount = toStringBigInt(event.minInvestmentAmount || "0");
  if (compareBigInt(minInvestmentAmount, "0") > 0) {
    if (compareBigInt(amountFromChain, minInvestmentAmount) < 0) {
      throw new BadRequestError(
        `Contribution amount is below minimum investment amount ${minInvestmentAmount}`,
      );
    }
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

export async function createContributionRefundIntent(
  eventId,
  user,
  repos = {},
) {
  const repository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;

  if (!isValidObjectId(eventId)) {
    throw new BadRequestError("Invalid event id");
  }

  const event = await repository.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  if (event.status !== "cancelled" && event.status !== "failed") {
    throw new BadRequestError(
      "Event must be cancelled or failed before refund claim",
    );
  }

  if (!event.contractEventId) {
    throw new BadRequestError("Event has not been synced to on-chain yet");
  }

  const investor = getAuthenticatedWalletAddress(user, null, "investorWallet");
  const existingShare = await shareRepository.findByEventAndHolder(
    eventId,
    investor,
  );

  if (
    !existingShare ||
    compareBigInt(String(existingShare.contributionAmount || "0"), "0") <= 0
  ) {
    throw new BadRequestError("No refundable investment found for this wallet");
  }

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

  const data = fund.interface.encodeFunctionData("claimContributionRefund", [
    BigInt(event.contractEventId),
  ]);

  return {
    eventId: String(event._id),
    contractEventId: String(event.contractEventId),
    investor,
    refundableAmount: String(existingShare.contributionAmount || "0"),
    transaction: {
      to: fundAddress,
      data,
      value: "0",
      chainId: network.chainId.toString(),
      functionName: "claimContributionRefund",
    },
  };
}

export async function confirmContributionRefundTransaction(
  eventId,
  payload = {},
  user,
  repos = {},
) {
  const repository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;
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
  const refundEvents = parsedEvents.filter(
    (parsedEvent) => parsedEvent?.name === "ContributionRefunded",
  );

  const matchedRefund = refundEvents.find((parsedEvent) => {
    const chainEventId = String(parsedEvent.args?.eventId ?? "");
    const chainInvestor = String(parsedEvent.args?.donator ?? "").toLowerCase();

    return (
      chainEventId === String(event.contractEventId) &&
      chainInvestor === normalizedInvestor
    );
  });

  if (!matchedRefund) {
    throw new BadRequestError(
      "ContributionRefunded event not found in transaction receipt for this user/event",
    );
  }

  const amountFromChain = toStringBigInt(
    String(matchedRefund.args?.amount ?? "0"),
  );
  if (compareBigInt(amountFromChain, "0") <= 0) {
    throw new BadRequestError("On-chain refund amount must be positive");
  }

  await persistLogsFromReceipt({
    receipt,
    contract: fund,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  const existingConfirmedContribution = await Contribution.findOne({
    eventId: event._id,
    contributor: normalizedInvestor,
    type: "donator_contribution",
    status: "confirmed",
  }).lean();

  const alreadySynced = !existingConfirmedContribution;

  if (!alreadySynced) {
    await contributionRepo.markDonatorContributionsAsRefunded(
      event._id,
      normalizedInvestor,
    );

    const fundingUpdates = await rebuildSharePercentagesAndFunding(eventId);
    await repository.updateById(eventId, {
      currentFunding: fundingUpdates.currentFunding,
      status: event.status === "failed" ? "failed" : "cancelled",
      escrowStatus: "refunded",
      refundedAmount: addBigInt(event.refundedAmount || "0", amountFromChain),
      lastContributionRefundAt: new Date(),
    });
  }

  const updatedEvent = await repository.findById(eventId);
  const updatedShare = await Share.findOne({
    eventId: event._id,
    holder: normalizedInvestor,
  })
    .populate("eventId")
    .lean();

  return {
    synced: !alreadySynced,
    alreadySynced,
    txHash: txHash.toLowerCase(),
    refundAmount: amountFromChain,
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

  const minInvestmentAmount = toStringBigInt(event.minInvestmentAmount || "0");
  if (compareBigInt(minInvestmentAmount, "0") > 0) {
    if (compareBigInt(normalizedAmount, minInvestmentAmount) < 0) {
      throw new BadRequestError(
        `Investment amount must be at least ${minInvestmentAmount}`,
      );
    }
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

/**
 * Mark event as completed when usage threshold is met on-chain
 * @param {string} eventId - Event ID
 * @param {Object} payload - Payload with optional txHash for polling
 * @param {Object} user - User object with walletAddress (organizer)
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event with completed status
 */
export async function markEventAsCompleted(
  eventId,
  payload = {},
  user,
  repos = {},
) {
  const repository = repos.eventRepo || eventRepo;
  const { txHash } = payload;

  if (!isValidObjectId(eventId)) {
    throw new BadRequestError("Invalid event id");
  }

  const event = await repository.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  // Only organizer can mark event as completed
  if (!isEventOwnedByUser(event, user)) {
    throw new ForbiddenError("Not authorized to mark this event as completed");
  }

  // App status may already be ongoing while on-chain status is still ticketing.
  if (!["ticketing", "ongoing"].includes(event.status)) {
    throw new BadRequestError(
      `Event must be in ticketing or ongoing status to mark as completed, current status: ${event.status}`,
    );
  }

  // Event must have contract ID
  if (!event.contractEventId) {
    throw new BadRequestError("Event has not been synced to on-chain yet");
  }

  const signer = getBackendSigner();
  const fund = getFund();
  const fundWithSigner = fund.connect(signer);
  const chainEventId = BigInt(event.contractEventId);
  const fundAddress = await fund.getAddress();

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

  let tx;
  try {
    tx = await fundWithSigner.setCompletedIfThresholdMet(chainEventId);
  } catch (error) {
    throw new BadRequestError(
      `Failed to mark event as completed on-chain: ${getBlockchainErrorMessage(error)}`,
    );
  }

  const receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new BadRequestError("On-chain completion transaction failed");
  }

  await persistLogsFromReceipt({
    receipt,
    contract: fund,
    contractName: "Fund",
    contractAddress: fundAddress,
  });

  const parsedEvents = await parseFundEventsFromReceipt(receipt);
  const completedEvent = parsedEvents.find(
    (parsedEvent) => parsedEvent?.name === "Completed",
  );

  if (!completedEvent) {
    throw new BadRequestError(
      "Completed event not found in transaction receipt for this event.",
    );
  }

  await tryReleaseRevenueAfterCompletion(
    fundWithSigner,
    chainEventId,
    fund,
    fundAddress,
  );

  // Update event status to completed
  const updatedEvent = await repository.updateById(eventId, {
    status: "completed",
  });

  return updatedEvent;
}
