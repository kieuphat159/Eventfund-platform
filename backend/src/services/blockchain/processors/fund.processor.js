import { provider } from "../core/provider.js";
import { getFund } from "../core/contracts/index.js";
import {
  getOrInitSyncState,
  markError,
  markSynced,
  markSyncing,
  updateProgress,
} from "../core/blockTracker.js";
import {
  getNumberEnv,
  planReorgSafeSync,
  readReorgPolicyFromEnv,
} from "../sync/reorgPolicy.js";
import { addBigInt, compareBigInt, toBigInt } from "../../../utils/bigint.js";

// ==================== REPOSITORIES ====================
import eventRepo from "../../../repositories/event.repo.js";
import contributionRepo from "../../../repositories/contribution.repo.js";
import shareRepo from "../../../repositories/share.repo.js";
import revenueDistributionRepo from "../../../repositories/revenueDistribution.repo.js";
import rewardClaimRepo from "../../../repositories/rewardClaim.repo.js";
import penaltyRepo from "../../../repositories/penalty.repo.js";
import chainLogRepo from "../../../repositories/chainLog.repo.js";
import { scheduleAutoRefundsForTerminalEvent } from "../../events/terminalRefunds.service.js";

const CONTRACT_NAME = "Fund";
const PROCESSOR_NAME = "FundProcessor";

// -------------------------
// Helper utils
// -------------------------
const toStringId = (v) =>
  v === undefined || v === null ? undefined : String(v);
const toNumberSafe = (v) => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toAmountString = (v) =>
  v === undefined || v === null ? "0" : String(v);

const lowerAddress = (v) => (v ? String(v).toLowerCase() : undefined);

function getEventStatusLabel(statusValue) {
  const map = {
    0: "draft",
    1: "funding",
    2: "funded",
    3: "ticketing",
    4: "completed",
    5: "cancelled",
  };
  const n = Number(statusValue);
  const label = map[n];
  // Fallback to "failed" instead of "unknown_X" to match enum
  return label ?? "failed";
}

function getCancellationReasonLabel(reasonValue) {
  const map = {
    0: "funding_goal_not_met",
    1: "organizer_cancelled",
    2: "ticket_sales_not_met",
  };

  return map[Number(reasonValue)] ?? "organizer_cancelled";
}

function getTerminalStatusFromCancellationReason(reasonValue) {
  const reason = getCancellationReasonLabel(reasonValue);
  return reason === "organizer_cancelled" ? "cancelled" : "failed";
}

// -------------------------
// REBUILD FUND STATE
// -------------------------
async function rebuildFundState(eventObjectId) {
  await contributionRepo.rebuildFundState(eventObjectId);
}

async function rebuildShareState(eventObjectId) {
  await shareRepo.rebuildShareStateFromContributions(eventObjectId);
}

// -------------------------
// FULL REBUILD FROM CHAINLOG (dùng khi detect reorg)
// Replay toan bo ChainLog cua 1 contractEventId de tinh lai state
// -------------------------
async function rebuildFullEventStateFromChainLog(contractEventId, contractAddress) {
  const logs = await chainLogRepo.findLogs(
    { contractName: CONTRACT_NAME, contractAddress, "args.eventId": contractEventId },
    { sort: { blockNumber: 1, transactionIndex: 1, logIndex: 1 } }
  );

  if (logs.length === 0) return;

  // Reset state ve default
  const state = {
    status: "funding",
    escrowStatus: "holding",
    totalTicketsUsed: 0,
    totalPenaltyAmount: 0,
    ticketRevenueDeposited: 0,
    royaltyRevenueDeposited: 0,
    refundedAmount: 0,
    extraRefundPoolDeposited: 0,
    escrowedRevenue: 0,
    refundPool: 0,
    totalRevenue: "0",
    organizerStakeWithdrawn: 0,
    cancellationReason: null,
    cancellationNote: null,
    cancelledAt: null,
    cancelledBy: null,
    // Clear timestamps
    fundingFinalizedAt: null,
    ticketingStartedAt: null,
    completedAt: null,
    revenueDistributedAt: null,
    refundEnabledAt: null,
    lastRefundedAt: null,
    lastRefundPoolDepositAt: null,
    lastTicketRevenueAt: null,
    lastRoyaltyRevenueAt: null,
    lastContributionRefundAt: null,
    stakeWithdrawnAt: null,
    lastPenaltyAt: null,
    // Clear processedTxHashes — rebuild tu dau nen reset guard
    processedTxHashes: [],
  };

  // Replay tung log
  for (const log of logs) {
    const args = log.args || {};
    switch (log.eventName) {
      case "EventCreated":
        state.status = "funding";
        state.escrowStatus = "holding";
        break;
      case "FundingSuccessful":
        state.status = "funded";
        break;
      case "FundingFinalized":
        state.status = getEventStatusLabel(args.statusAfterFinalize);
        state.fundingFinalizedAt = new Date();
        break;
      case "EventCancelled":
        state.status = getTerminalStatusFromCancellationReason(args.reason);
        state.cancellationReason = getCancellationReasonLabel(args.reason);
        state.cancelledAt = new Date();
        if (args.ticketRefundsEnabled) {
          state.escrowStatus = "refund_enabled";
          state.refundPool = toNumberSafe(args.refundPoolAmount);
          state.refundEnabledAt = new Date();
        }
        break;
      case "TicketingStarted":
        state.status = "ticketing";
        state.ticketingStartedAt = new Date();
        break;
      case "Completed":
        state.status = "completed";
        state.totalTicketsUsed = toNumberSafe(args.usedTickets);
        state.completedAt = new Date();
        break;
      case "RevenueReleased":
        state.status = "completed";
        state.escrowStatus = "released";
        state.totalRevenue = toStringId(args.totalRevenue);
        state.revenueDistributedAt = new Date();
        break;
      case "RefundsEnabled":
        state.escrowStatus = "refund_enabled";
        state.refundPool = toNumberSafe(args.refundPoolAmount);
        state.refundEnabledAt = new Date();
        break;
      case "RefundPoolDeposited":
        state.refundPool = toNumberSafe(args.newRefundPool);
        state.escrowStatus = "refund_pool_funded";
        state.extraRefundPoolDeposited += toNumberSafe(args.amount);
        state.lastRefundPoolDepositAt = new Date();
        break;
      case "TicketRefundPaid":
        state.refundedAmount += toNumberSafe(args.amount);
        state.escrowStatus = "refunding";
        state.lastRefundedAt = new Date();
        break;
      case "TicketRevenueDeposited":
        state.escrowStatus = "holding_revenue";
        state.escrowedRevenue = toNumberSafe(args.newEscrowedRevenue);
        state.ticketRevenueDeposited += toNumberSafe(args.amount);
        state.lastTicketRevenueAt = new Date();
        break;
      case "RoyaltyDeposited":
        state.escrowStatus = "holding_revenue";
        state.escrowedRevenue = toNumberSafe(args.newEscrowedRevenue);
        state.royaltyRevenueDeposited += toNumberSafe(args.amount);
        state.lastRoyaltyRevenueAt = new Date();
        break;
      case "PenaltyApplied":
        state.totalPenaltyAmount += toNumberSafe(args.amount);
        state.lastPenaltyAt = new Date();
        break;
      case "ContributionRefunded":
        if (state.status !== "failed" && state.status !== "cancelled") {
          state.status = "cancelled";
        }
        state.escrowStatus = "refunded";
        state.refundedAmount += toNumberSafe(args.amount);
        state.lastContributionRefundAt = new Date();
        break;
      case "StakeWithdrawn":
        state.organizerStakeWithdrawn = toNumberSafe(args.amount);
        state.stakeWithdrawnAt = new Date();
        break;
      default:
        break;
    }
  }

  // $set toan bo state len Event document
  await eventRepo.updateByContractEventId(
    contractEventId,
    { $set: state },
    contractAddress,
  );

  // Rebuild currentFunding va sharePercentage tu Contribution
  const eventDoc = await eventRepo.findByContractEventId(
    contractEventId,
    contractAddress,
  );
  if (eventDoc) {
    await rebuildFundState(eventDoc._id);

    // Xoa toan bo Share cua event nay, rebuild lai tu ChainLog canonical
    // Giai quyet: Share cua donator bi reorg van con (Bug 1)
    //             Share.claimedReward khong duoc reset (Bug 2)
    await shareRepo.deleteByEventId(eventDoc._id);

    // Re-process SharesIssued logs con lai → tao lai Share dung
    for (const log of logs) {
      if (log.eventName === "SharesIssued") {
        const holder = lowerAddress(log.args?.donator);
        const sharesMinted = toNumberSafe(log.args?.sharesMinted);
        if (holder) {
          await shareRepo.upsertSharesIssued(eventDoc._id, holder, sharesMinted);
        }
      }
    }

    // Re-process RewardClaimed logs con lai → rebuild claimedReward dung
    for (const log of logs) {
      if (log.eventName === "RewardClaimed") {
        const claimer = lowerAddress(log.args?.donator);
        const amount = toNumberSafe(log.args?.amount);
        if (claimer) {
          await shareRepo.incrementClaimedReward(
            eventDoc._id,
            claimer,
            amount,
            log.transactionHash
          );
        }
      }
    }

    // Rebuild currentFunding va sharePercentage sau khi Share da duoc rebuild
    await rebuildFundState(eventDoc._id);
    await rebuildShareState(eventDoc._id);
  }
}

// -------------------------
// HANDLE FUNCTIONS (Idempotent)
// -------------------------
async function handleEventCreated(log) {
  const { args, transactionHash, blockNumber, contractAddress } = log;
  const contractEventId = toStringId(args.eventId);
  const normalizedContractAddress = lowerAddress(contractAddress);
  const onChainOrganizer = lowerAddress(args.organizer);

  const normalizedFundingGoal = toStringId(args.fundingGoal);
  const normalizedMinStakeRequired = toStringId(args.minStakeRequired);
  const normalizedTicketPrice = toNumberSafe(args.ticketPrice);
  const normalizedMaxTickets = toNumberSafe(args.maxTickets);
  const normalizedUsedThreshold = toNumberSafe(args.usedThreshold);

  const matchedDraft = await eventRepo.findMatchingDraftForOnChainEvent({
    organizer: onChainOrganizer,
    fundingGoal: normalizedFundingGoal,
    minStakeRequired: normalizedMinStakeRequired,
    ticketPrice: normalizedTicketPrice,
    maxTickets: normalizedMaxTickets,
    usedThreshold: normalizedUsedThreshold,
  });

  if (matchedDraft?._id) {
    await eventRepo.updateById(matchedDraft._id, {
      $set: {
        contractEventId,
        fundContractAddress: normalizedContractAddress,
        onChainOrganizer,
        fundingGoal: normalizedFundingGoal,
        fundingDeadline: toNumberSafe(args.fundingDeadline) > 0
          ? new Date(toNumberSafe(args.fundingDeadline) * 1000)
          : undefined,
        minStakeRequired: normalizedMinStakeRequired,
        organizerShareBps: toNumberSafe(args.organizerShareBps),
        ticketPrice: normalizedTicketPrice,
        maxTickets: normalizedMaxTickets,
        totalTickets: normalizedMaxTickets,
        usedThreshold: normalizedUsedThreshold,
        organizerStake: toStringId(args.stakeAmount),
        status: "funding",
        escrowStatus: "holding",
      },
    });
  } else {
    await eventRepo.upsertByContractEventId(contractEventId, {
      fundContractAddress: normalizedContractAddress,
      organizer: onChainOrganizer,
      onChainOrganizer,
      fundingGoal: normalizedFundingGoal, // String in schema
      fundingDeadline: toNumberSafe(args.fundingDeadline) > 0
        ? new Date(toNumberSafe(args.fundingDeadline) * 1000)
        : undefined,
      minStakeRequired: normalizedMinStakeRequired,
      organizerShareBps: toNumberSafe(args.organizerShareBps),
      ticketPrice: normalizedTicketPrice,
      maxTickets: normalizedMaxTickets,
      usedThreshold: normalizedUsedThreshold,
      organizerStake: toStringId(args.stakeAmount),
      status: "funding",
      escrowStatus: "holding",
    });
  }

  if (toNumberSafe(args.stakeAmount) > 0) {
    await contributionRepo.upsertOrganizerStake({
      txHash: transactionHash.toLowerCase(),
      eventContractId: contractEventId,
      fundContractAddress: normalizedContractAddress,
      organizer: onChainOrganizer,
      amount: toNumberSafe(args.stakeAmount),
      blockNumber,
    });
  }
}

async function handleContributionMade(log, eventDoc) {
  const { args, transactionHash, blockNumber } = log;

  await contributionRepo.upsertDonatorContribution({
    txHash: transactionHash.toLowerCase(),
    eventId: eventDoc._id,
    contributor: lowerAddress(args.donator),
    amount: toNumberSafe(args.amount),
    blockNumber,
  });

  await rebuildFundState(eventDoc._id);
  await rebuildShareState(eventDoc._id);
}

async function handleSharesIssued(log, eventDoc) {
  const { args } = log;
  const holder = lowerAddress(args.donator);
  const sharesMinted = toAmountString(args.sharesMinted);

  // mintedShares not incremented here; rebuildFundState is the source of truth
  await shareRepo.upsertSharesIssued(eventDoc._id, holder, sharesMinted);
  await rebuildFundState(eventDoc._id);
  await rebuildShareState(eventDoc._id);
}

async function handleFundingSuccessful(eventDoc) {
  await eventRepo.updateFundingStatus(eventDoc._id, { $set: { status: "funded" } });
}

async function handleFundingFinalized(log, eventDoc) {
  await eventRepo.updateById(eventDoc._id, {
    $set: {
      status: getEventStatusLabel(log.args.statusAfterFinalize),
      // sharesFinalized omitted: derivable from status/timeline
      // totalShares omitted: query from Share collection
      fundingFinalizedAt: new Date(),
    },
  });
}

async function handleEventCancelled(log, eventDoc) {
  const { args } = log;
  const patch = {
    status: getTerminalStatusFromCancellationReason(args.reason),
    cancellationReason: getCancellationReasonLabel(args.reason),
    cancelledAt: new Date(),
  };

  if (args.ticketRefundsEnabled) {
    patch.escrowStatus = "refund_enabled";
    patch.refundPool = toNumberSafe(args.refundPoolAmount);
    patch.refundEnabledAt = new Date();
  }

  const updatedEvent = await eventRepo.updateById(eventDoc._id, {
    $set: patch,
  });

  scheduleAutoRefundsForTerminalEvent(updatedEvent || { ...eventDoc, ...patch });
}

async function handleTicketingStarted(log, eventDoc) {
  await eventRepo.updateById(eventDoc._id, {
    $set: {
      status: "ticketing",
      // totalMinted omitted: use TicketStats.totalMinted
      // ticketType omitted: tied to ticketTiers/Ticket, not Event
      ticketingStartedAt: new Date(),
    },
  });
}

async function handleCompleted(log, eventDoc) {
  const { args } = log;
  await eventRepo.updateById(eventDoc._id, {
    $set: {
      status: "completed",
      totalTicketsUsed: toNumberSafe(args.usedTickets), // map to schema field
      completedAt: new Date(),
    },
  });
}

async function handleRevenueReleased(log, eventDoc) {
  const { args, transactionHash } = log;

  await revenueDistributionRepo.upsertRevenueDistribution({
    txHash: transactionHash.toLowerCase(),
    eventId: eventDoc._id,
    totalRevenue: toNumberSafe(args.totalRevenue),
    platformFee: toNumberSafe(args.platformFee),
    platformFeePercentage: toNumberSafe(args.totalRevenue) > 0
      ? (toNumberSafe(args.platformFee) / toNumberSafe(args.totalRevenue)) * 100
      : 0,
    organizerShare: toNumberSafe(args.organizerShare),
    organizerSharePercentage: toNumberSafe(args.totalRevenue) > 0
      ? (toNumberSafe(args.organizerShare) / toNumberSafe(args.totalRevenue)) * 100
      : 0,
    donatorPool: toNumberSafe(args.donatorPool),
    accRewardPerShare: toNumberSafe(args.newAccRewardPerShare),
    status: "completed",
    triggerType: "manual", // was "manual_release" - corrected to match enum
  });

  await eventRepo.updateById(eventDoc._id, {
    $set: {
      status: "completed",
      escrowStatus: "released",
      totalRevenue: toStringId(args.totalRevenue),
      // platformFee, organizerShare, donatorPool omitted: stored in RevenueDistribution
      // revenueReleased boolean omitted: derivable from escrowStatus = "released"
      revenueDistributedAt: new Date(),
    },
  });
}

async function handleRewardClaimed(log, eventDoc) {
  const { args, transactionHash } = log;
  const claimer = lowerAddress(args.donator);

  // Resolve distributionId: find latest completed distribution for this event
  const distribution = await revenueDistributionRepo.findLatestByEventId(eventDoc._id);

  // Resolve sharePercentage from Share record
  const shareDoc = await shareRepo.findByEventAndHolder(eventDoc._id, claimer);
  const sharePercentage = shareDoc?.sharePercentage ?? 0;

  await rewardClaimRepo.upsertRewardClaim({
    txHash: transactionHash.toLowerCase(),
    eventId: eventDoc._id,
    distributionId: distribution?._id,
    claimer,
    sharePercentage,
    rewardAmount: toNumberSafe(args.amount),
    status: "confirmed",
  });

  await shareRepo.incrementClaimedReward(
    eventDoc._id,
    claimer,
    toNumberSafe(args.amount),
    transactionHash
  );
}

async function handleRefundsEnabled(log, eventDoc) {
  const { args } = log;
  await eventRepo.updateById(eventDoc._id, {
    $set: {
      escrowStatus: "refund_enabled",
      // refundsEnabled boolean omitted: derivable from escrowStatus
      refundPool: toNumberSafe(args.refundPoolAmount),
      refundEnabledAt: new Date(),
    },
  });
}

async function handleTicketRefundPaid(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  await eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, "refundedAmount", {
    inc: { refundedAmount: toNumberSafe(args.amount) },
    set: {
      escrowStatus: "refunding",
      lastRefundedAt: new Date(),
    },
  });
}

async function handleRefundPoolDeposited(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  await eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, "extraRefundPoolDeposited", {
    inc: {
      extraRefundPoolDeposited: toNumberSafe(args.amount),
    },
    set: {
      refundPool: toNumberSafe(args.newRefundPool),
      escrowStatus: "refund_pool_funded",
      lastRefundPoolDepositAt: new Date(),
    },
  });
}

async function handlePenaltyApplied(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  // Map reason to valid enum values; fallback to "threshold_not_met"
  const validReasons = ["cancelled", "fraud", "threshold_not_met"];
  const reason = validReasons.includes(args.reason) ? args.reason : "threshold_not_met";

  await penaltyRepo.upsertPenalty({
    txHash,
    eventId: eventDoc._id,
    organizer: lowerAddress(eventDoc.organizer),
    stakeAmount: toNumberSafe(eventDoc.organizerStake),
    penaltyAmount: toNumberSafe(args.amount),
    penaltyPercentage: toNumberSafe(args.penaltyBps) / 100,
    reason,
  });

  await eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, "totalPenaltyAmount", {
    inc: { totalPenaltyAmount: toNumberSafe(args.amount) },
    set: { lastPenaltyAt: new Date() },
  });
}

async function handleTicketRevenueDeposited(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  await eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, "ticketRevenueDeposited", {
    inc: { ticketRevenueDeposited: toNumberSafe(args.amount) },
    set: {
      escrowStatus: "holding_revenue",
      escrowedRevenue: toNumberSafe(args.newEscrowedRevenue),
      lastTicketRevenueAt: new Date(),
    },
  });
}

async function handleRoyaltyDeposited(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  await eventRepo.applyIdempotentDeltaByTxHash(eventDoc._id, txHash, "royaltyRevenueDeposited", {
    inc: { royaltyRevenueDeposited: toNumberSafe(args.amount) },
    set: {
      escrowStatus: "holding_revenue",
      escrowedRevenue: toNumberSafe(args.newEscrowedRevenue),
      lastRoyaltyRevenueAt: new Date(),
    },
  });
}

async function handleContributionRefunded(log, eventDoc) {
  const { args, transactionHash } = log;
  const contributor = lowerAddress(args.donator);
  const amount = toAmountString(args.amount);

  await contributionRepo.markDonatorContributionsAsRefunded(
    eventDoc._id,
    contributor,
    {
      refundedAt: new Date(),
      refundTxHash: txHash,
    },
  );

  const txHash = transactionHash.toLowerCase();
  const applied = await eventRepo.applyIdempotentDeltaByTxHash(
    eventDoc._id,
    txHash,
    "refundedAmount_contribution",
    {
      inc: { refundedAmount: amount },
      set: {
        status:
          eventDoc?.cancellationReason === "ticket_sales_not_met" ||
          eventDoc?.cancellationReason === "funding_goal_not_met"
            ? "failed"
            : "cancelled",
        escrowStatus: "refunded",
        lastContributionRefundAt: new Date(),
      },
    }
  );

  // Ensure terminal status is still refreshed for repeated processing of same tx.
  if (!applied) {
    await eventRepo.updateById(eventDoc._id, {
      $set: {
        status:
          eventDoc?.cancellationReason === "ticket_sales_not_met" ||
          eventDoc?.cancellationReason === "funding_goal_not_met"
            ? "failed"
            : "cancelled",
        escrowStatus: "refunded",
        lastContributionRefundAt: new Date(),
      },
    });
  }

  await rebuildFundState(eventDoc._id);
  await rebuildShareState(eventDoc._id);
}

async function handleStakeWithdrawn(log, eventDoc) {
  const { args } = log;
  await eventRepo.updateById(eventDoc._id, {
    $set: {
      organizerStakeWithdrawn: toNumberSafe(args.amount),
      stakeWithdrawnAt: new Date(),
    },
  });
}

// -------------------------
// MAIN PROCESSOR
// -------------------------
async function processFundLog(log) {
  const { eventName, args, contractAddress } = log;
  if (!eventName) return;

  if (eventName === "EventCreated") {
    await handleEventCreated(log);
    return;
  }

  const contractEventId = toStringId(args?.eventId);
  const eventDoc = await eventRepo.findByContractEventId(
    contractEventId,
    lowerAddress(contractAddress),
  );
  if (!eventDoc) return;

  switch (eventName) {
    case "ContributionMade": await handleContributionMade(log, eventDoc); break;
    case "SharesIssued": await handleSharesIssued(log, eventDoc); break;
    case "FundingSuccessful": await handleFundingSuccessful(eventDoc); break;
    case "FundingFinalized": await handleFundingFinalized(log, eventDoc); break;
    case "EventCancelled": await handleEventCancelled(log, eventDoc); break;
    case "TicketingStarted": await handleTicketingStarted(log, eventDoc); break;
    case "Completed": await handleCompleted(log, eventDoc); break;
    case "RevenueReleased": await handleRevenueReleased(log, eventDoc); break;
    case "RewardClaimed": await handleRewardClaimed(log, eventDoc); break;
    case "RefundsEnabled": await handleRefundsEnabled(log, eventDoc); break;
    case "TicketRefundPaid": await handleTicketRefundPaid(log, eventDoc); break;
    case "RefundPoolDeposited": await handleRefundPoolDeposited(log, eventDoc); break;
    case "PenaltyApplied": await handlePenaltyApplied(log, eventDoc); break;
    case "TicketRevenueDeposited": await handleTicketRevenueDeposited(log, eventDoc); break;
    case "RoyaltyDeposited": await handleRoyaltyDeposited(log, eventDoc); break;
    case "ContributionRefunded": await handleContributionRefunded(log, eventDoc); break;
    case "StakeWithdrawn": await handleStakeWithdrawn(log, eventDoc); break;
    default: break;
  }
}

// -------------------------
// MAIN LOOP (giữ nguyên)
// -------------------------
export async function processFundLogsOnce() {
  const fund = getFund();
  const { confirmations, reorgBuffer, chunkSize } = readReorgPolicyFromEnv();
  const startBlock = getNumberEnv("FUND_START_BLOCK", 0);

  const contractAddress = (await fund.getAddress()).toLowerCase();

  const syncState = await getOrInitSyncState({
    contractName: PROCESSOR_NAME,
    contractAddress,
    startBlock,
  });

  const latest = await provider.getBlockNumber();
  const plan = planReorgSafeSync({
    latestBlock: latest,
    confirmations,
    startBlock,
    lastProcessedBlock: syncState.lastProcessedBlock,
    reorgBuffer,
  });

  if (!plan.shouldSync) {
    return {
      latest,
      target: plan.targetBlock,
      processedTo: syncState.lastProcessedBlock,
    };
  }

  await markSyncing(PROCESSOR_NAME);

  let currentFrom = plan.fromBlock;
  const target = plan.targetBlock;

  // Tap hop contractEventId can full rebuild neu detect reorg
  const reorgAffectedEventIds = new Set();
  // TxHashes cua cac logs bi reorg (de xoa derived data)
  const reorgAffectedTxHashes = new Set();
  // Blocks bi reorg (bien mat hoac blockHash khac)
  const reorgDetectedBlocks = new Set();

  // Build map blockNumber -> { blockHash, txHashes } tu recentBlockHashes da luu
  // Giu ca txHashes de dung khi detect block bien mat
  const savedBlockHashMap = new Map(
    (syncState.recentBlockHashes || []).map(({ blockNumber, blockHash, txHashes }) => [
      blockNumber,
      { blockHash, txHashes: txHashes || [] },
    ])
  );

  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

    const logs = await chainLogRepo.findLogs(
      {
        contractName: CONTRACT_NAME,
        contractAddress,
        blockNumber: { $gte: currentFrom, $lte: currentTo },
      },
      { sort: { blockNumber: 1, transactionIndex: 1, logIndex: 1 } }
    );

    // ── Reorg detection: kiem tra ca block co blockHash khac VA block bien mat
    if (savedBlockHashMap.size > 0) {
      const currentBlockHashMap = new Map();
      for (const log of logs) {
        if (!currentBlockHashMap.has(log.blockNumber)) {
          currentBlockHashMap.set(log.blockNumber, log.blockHash);
        }
      }

      for (const [blockNum, savedEntry] of savedBlockHashMap) {
        if (blockNum < currentFrom || blockNum > currentTo) continue;

        const currentHash = currentBlockHashMap.get(blockNum);

        if (currentHash === undefined) {
          // Block bien mat → reorg
          console.log(`[FundProcessor] Reorg: block ${blockNum} disappeared`);
          // Lay txHashes tu savedEntry (da luu truoc khi block bi xoa)
          for (const txHash of (savedEntry.txHashes || [])) {
            reorgAffectedTxHashes.add(txHash);
          }
          reorgDetectedBlocks.add(blockNum);
        } else if (currentHash !== savedEntry.blockHash) {
          // Block co blockHash khac -> reorg
          console.log(`[FundProcessor] Reorg: block ${blockNum} hash changed`);
          // Chi xoa txHashes cua block cu (savedEntry). Tx canonical moi phai duoc giu lai.
          for (const txHash of (savedEntry.txHashes || [])) {
            reorgAffectedTxHashes.add(txHash);
          }
          for (const log of logs) {
            if (log.blockNumber === blockNum) {
              const eid = toStringId(log.args?.eventId);
              if (eid) reorgAffectedEventIds.add(eid);
            }
          }
        }
      }
    }

    for (const log of logs) {
      await processFundLog(log);
    }

    // Cap nhat recentBlockHashes: giu lai reorgBuffer blocks cuoi, luu ca txHashes
    const newBlockHashes = [];
    for (const log of logs) {
      let entry = newBlockHashes.find(b => b.blockNumber === log.blockNumber);
      if (!entry) {
        entry = { blockNumber: log.blockNumber, blockHash: log.blockHash, txHashes: [] };
        newBlockHashes.push(entry);
      }
      if (log.transactionHash && !entry.txHashes.includes(log.transactionHash.toLowerCase())) {
        entry.txHashes.push(log.transactionHash.toLowerCase());
      }
    }

    // Merge voi saved, giu lai reorgBuffer entries moi nhat, BAO GOM txHashes
    const mergedFullMap = new Map();
    // Dua vao saved truoc
    for (const [blockNumber, entry] of savedBlockHashMap) {
      mergedFullMap.set(blockNumber, entry);
    }
    // Override/them voi new (new co txHashes day du)
    for (const entry of newBlockHashes) {
      mergedFullMap.set(entry.blockNumber, { blockHash: entry.blockHash, txHashes: entry.txHashes });
    }
    // Chi giu reorgBuffer blocks cuoi
    const sortedEntries = [...mergedFullMap.entries()]
      .sort(([a], [b]) => b - a)
      .slice(0, reorgBuffer);
    const updatedRecentBlockHashes = sortedEntries.map(([blockNumber, entry]) => ({
      blockNumber,
      blockHash: entry.blockHash,
      txHashes: entry.txHashes,
    }));

    // Cap nhat savedBlockHashMap cho chunk tiep theo
    savedBlockHashMap.clear();
    for (const [blockNumber, entry] of sortedEntries) {
      savedBlockHashMap.set(blockNumber, entry);
    }

    const lastLogInChunk = logs[logs.length - 1];
    const lastBlockHashInChunk = lastLogInChunk?.blockHash ?? syncState.lastBlockHash;

    await updateProgress({
      contractName: PROCESSOR_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      lastBlockHash: lastBlockHashInChunk,
      recentBlockHashes: updatedRecentBlockHashes,
      status: "syncing",
    });

    currentFrom = currentTo + 1;
  }

  // ── Xu ly block bien mat: collect eventIds tu ChainLog con lai
  // txHashes da duoc collect truc tiep trong detection loop tu savedEntry.txHashes
  for (const _blockNum of reorgDetectedBlocks) {
    // Collect eventIds tu tat ca ChainLog con lai (canonical)
    const relatedLogs = await chainLogRepo.findLogs(
      { contractName: CONTRACT_NAME, contractAddress },
      {}
    );
    for (const l of relatedLogs) {
      const eid = toStringId(l.args?.eventId);
      if (eid) reorgAffectedEventIds.add(eid);
    }
  }

  // ── Full rebuild cho cac event bi anh huong boi reorg
  if (reorgAffectedEventIds.size > 0 || reorgAffectedTxHashes.size > 0) {
    console.log(`[FundProcessor] Reorg cleanup: ${reorgAffectedTxHashes.size} txHashes, ${reorgAffectedEventIds.size} events`);

    // Buoc 3: Xoa derived data cua cac tx bi reorg
    if (reorgAffectedTxHashes.size > 0) {
      const txHashArr = [...reorgAffectedTxHashes];
      await contributionRepo.deleteByTxHashes(txHashArr);
      await penaltyRepo.deleteByTxHashes(txHashArr);
      await revenueDistributionRepo.deleteByTxHashes(txHashArr);
      await rewardClaimRepo.deleteByTxHashes(txHashArr);
      // Xoa processedTxHashes guard tren Event de cho phep re-process
      await eventRepo.clearProcessedTxHashes(txHashArr);
      // Xoa processedRewardTxHashes tren Share
      await shareRepo.clearProcessedRewardTxHashes(txHashArr);
      console.log(`[FundProcessor] Deleted derived data for ${txHashArr.length} reorged txHashes`);
    }

    // Buoc 4+5: Rebuild Event state va Fund state
    for (const contractEventId of reorgAffectedEventIds) {
      await rebuildFullEventStateFromChainLog(contractEventId, contractAddress);
    }
  }

  await markSynced(PROCESSOR_NAME);

  return {
    latest,
    target,
    processedTo: target,
  };
}

export async function runFundProcessorLoop() {
  const intervalMs = getNumberEnv("CHAIN_PROCESS_INTERVAL_MS", 10_000);

  while (true) {
    try {
      await processFundLogsOnce();
    } catch (err) {
      await markError(PROCESSOR_NAME, err);
      console.error("Fund processor error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
