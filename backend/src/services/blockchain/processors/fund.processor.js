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

// ==================== REPOSITORIES ====================
import eventRepo from "../../../repositories/event.repo.js";
import contributionRepo from "../../../repositories/contribution.repo.js";
import shareRepo from "../../../repositories/share.repo.js";
import revenueDistributionRepo from "../../../repositories/revenueDistribution.repo.js";
import rewardClaimRepo from "../../../repositories/rewardClaim.repo.js";
import penaltyRepo from "../../../repositories/penalty.repo.js";
import chainLogRepo from "../../../repositories/chainLog.repo.js";

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

const lowerAddress = (v) => (v ? String(v).toLowerCase() : undefined);

function getEventStatusLabel(statusValue) {
  const map = {
    0: "draft", // Changed from "none" to match Event schema enum
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

// -------------------------
// REBUILD FUND STATE
// -------------------------
async function rebuildFundState(eventObjectId) {
  await contributionRepo.rebuildFundState(eventObjectId);
}

// -------------------------
// HANDLE FUNCTIONS (Idempotent)
// -------------------------
async function handleEventCreated(log) {
  const { args, transactionHash, blockNumber } = log;
  const contractEventId = toStringId(args.eventId);
  const organizer = lowerAddress(args.organizer);

  await eventRepo.upsertByContractEventId(contractEventId, {
    organizer,
    fundingGoal: toStringId(args.fundingGoal),         // String in schema
    fundingDeadline: toNumberSafe(args.fundingDeadline) > 0
      ? new Date(toNumberSafe(args.fundingDeadline) * 1000)
      : undefined,                                      // Date in schema, convert from unix
    minStakeRequired: toStringId(args.minStakeRequired), // String in schema
    organizerShareBps: toNumberSafe(args.organizerShareBps),
    ticketPrice: toNumberSafe(args.ticketPrice),
    maxTickets: toNumberSafe(args.maxTickets),
    usedThreshold: toNumberSafe(args.usedThreshold),
    organizerStake: toStringId(args.stakeAmount), // use organizerStake (schema field)
    status: "funding",
    escrowStatus: "holding",
    // createdByTxHash and createdBlockNumber omitted: traceable via ChainLog
  });

  if (toNumberSafe(args.stakeAmount) > 0) {
    await contributionRepo.upsertOrganizerStake({
      txHash: transactionHash.toLowerCase(),
      eventContractId: contractEventId,
      organizer,
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
}

async function handleSharesIssued(log, eventDoc) {
  const { args } = log;
  const holder = lowerAddress(args.donator);
  const sharesMinted = toNumberSafe(args.sharesMinted);

  // mintedShares not incremented here; rebuildFundState is the source of truth
  await shareRepo.upsertSharesIssued(eventDoc._id, holder, sharesMinted);
  await rebuildFundState(eventDoc._id);
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

  if (await eventRepo.isTxHashProcessed(eventDoc._id, txHash, "refundedAmount")) return;

  await eventRepo.updateById(eventDoc._id, {
    $inc: { refundedAmount: toNumberSafe(args.amount) },
    $set: {
      escrowStatus: "refunding",
      lastRefundedAt: new Date(),
    },
  });

  await eventRepo.markTxHashProcessed(eventDoc._id, txHash, "refundedAmount");
}

async function handleRefundPoolDeposited(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  if (await eventRepo.isTxHashProcessed(eventDoc._id, txHash, "extraRefundPoolDeposited")) return;

  await eventRepo.updateById(eventDoc._id, {
    $set: {
      refundPool: toNumberSafe(args.newRefundPool),
      escrowStatus: "refund_pool_funded",
      lastRefundPoolDepositAt: new Date(),
    },
    $inc: {
      extraRefundPoolDeposited: toNumberSafe(args.amount),
    },
  });

  await eventRepo.markTxHashProcessed(eventDoc._id, txHash, "extraRefundPoolDeposited");
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

  if (await eventRepo.isTxHashProcessed(eventDoc._id, txHash, "totalPenaltyAmount")) return;

  await eventRepo.updateById(eventDoc._id, {
    $inc: { totalPenaltyAmount: toNumberSafe(args.amount) },
    $set: { lastPenaltyAt: new Date() },
  });

  await eventRepo.markTxHashProcessed(eventDoc._id, txHash, "totalPenaltyAmount");
}

async function handleTicketRevenueDeposited(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  if (await eventRepo.isTxHashProcessed(eventDoc._id, txHash, "ticketRevenueDeposited")) return;

  await eventRepo.updateById(eventDoc._id, {
    $set: {
      escrowStatus: "holding_revenue",
      escrowedRevenue: toNumberSafe(args.newEscrowedRevenue),
      lastTicketRevenueAt: new Date(),
    },
    $inc: { ticketRevenueDeposited: toNumberSafe(args.amount) },
  });

  await eventRepo.markTxHashProcessed(eventDoc._id, txHash, "ticketRevenueDeposited");
}

async function handleRoyaltyDeposited(log, eventDoc) {
  const { args, transactionHash } = log;
  const txHash = transactionHash.toLowerCase();

  if (await eventRepo.isTxHashProcessed(eventDoc._id, txHash, "royaltyRevenueDeposited")) return;

  await eventRepo.updateById(eventDoc._id, {
    $set: {
      escrowStatus: "holding_revenue",
      escrowedRevenue: toNumberSafe(args.newEscrowedRevenue),
      lastRoyaltyRevenueAt: new Date(),
    },
    $inc: { royaltyRevenueDeposited: toNumberSafe(args.amount) },
  });

  await eventRepo.markTxHashProcessed(eventDoc._id, txHash, "royaltyRevenueDeposited");
}

async function handleContributionRefunded(log, eventDoc) {
  const { args, transactionHash } = log;
  const contributor = lowerAddress(args.donator);
  const amount = toNumberSafe(args.amount);

  await contributionRepo.markContributionsAsRefunded(eventDoc._id, contributor);

  const txHash = transactionHash.toLowerCase();
  const alreadyProcessed = await eventRepo.isTxHashProcessed(eventDoc._id, txHash, "refundedAmount_contribution");

  await eventRepo.updateById(eventDoc._id, {
    ...(alreadyProcessed ? {} : { $inc: { refundedAmount: amount } }),
    $set: {
      status: "cancelled",
      escrowStatus: "refunded",
      lastContributionRefundAt: new Date(),
    },
  });

  if (!alreadyProcessed) {
    await eventRepo.markTxHashProcessed(eventDoc._id, txHash, "refundedAmount_contribution");
  }

  await rebuildFundState(eventDoc._id);
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
  const { eventName, args } = log;
  if (!eventName) return;

  if (eventName === "EventCreated") {
    await handleEventCreated(log);
    return;
  }

  const contractEventId = toStringId(args?.eventId);
  const eventDoc = await eventRepo.findByContractEventId(contractEventId);
  if (!eventDoc) return;

  switch (eventName) {
    case "ContributionMade": await handleContributionMade(log, eventDoc); break;
    case "SharesIssued": await handleSharesIssued(log, eventDoc); break;
    case "FundingSuccessful": await handleFundingSuccessful(eventDoc); break;
    case "FundingFinalized": await handleFundingFinalized(log, eventDoc); break;
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

  while (currentFrom <= target) {
    const currentTo = Math.min(target, currentFrom + chunkSize - 1);

  const logs = await chainLogRepo.findLogs(
  {
    contractName: CONTRACT_NAME,
    contractAddress,
    blockNumber: { $gte: currentFrom, $lte: currentTo },
  },
  {
    sort: { blockNumber: 1, transactionIndex: 1, logIndex: 1 },
  }
);

    for (const log of logs) {
      await processFundLog(log);
    }

    await updateProgress({
      contractName: PROCESSOR_NAME,
      contractAddress,
      lastProcessedBlock: currentTo,
      status: "syncing",
    });

    currentFrom = currentTo + 1;
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