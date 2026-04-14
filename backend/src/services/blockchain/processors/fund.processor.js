import { ChainLog } from "../../../models/ChainLog.js";
import Event from "../../../models/Event.model.js";
import Contribution from "../../../models/Contribution.model.js";
import Share from "../../../models/Share.model.js";
import RevenueDistribution from "../../../models/RevenueDistribution.model.js";
import RewardClaim from "../../../models/RewardClaim.model.js";
import Penalty from "../../../models/Penalty.model.js";

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
  return map[n] ?? `unknown_${statusValue}`;
}

/**
 * Rebuild lại funding + shares từ bảng Contribution
 * Chỉ tính những contribution confirmed chưa bị refunded
 */
async function rebuildFundState(eventObjectId) {
  const contributions = await Contribution.find({
    eventId: eventObjectId,
    status: "confirmed",
    type: "donator_contribution",
  }).lean();

  const totalFunding = contributions.reduce(
    (sum, c) => addBigInt(sum, c.amount || "0"),
    "0",
  );

  await Event.updateOne(
    { _id: eventObjectId },
    { $set: { currentFunding: totalFunding } },
  );

  const holderMap = {};

  for (const c of contributions) {
    const addr = lowerAddress(c.contributor);
    if (!addr) continue;

    if (!holderMap[addr]) {
      holderMap[addr] = {
        contributionAmount: "0",
      };
    }

    holderMap[addr].contributionAmount = addBigInt(
      holderMap[addr].contributionAmount,
      c.amount || "0",
    );
  }

  const shareOps = Object.entries(holderMap).map(([holder, data]) => {
    const sharePercentage =
      compareBigInt(totalFunding, "0") > 0
        ? Number((toBigInt(data.contributionAmount) * 10000n) / toBigInt(totalFunding)) /
          100
        : 0;

    return {
      updateOne: {
        filter: { eventId: eventObjectId, holder },
        update: {
          $set: {
            contributionAmount: data.contributionAmount,
            sharePercentage,
          },
          $setOnInsert: {
            claimedReward: "0",
            pendingReward: "0",
            mintedShares: "0",
          },
        },
        upsert: true,
      },
    };
  });

  if (shareOps.length > 0) {
    await Share.bulkWrite(shareOps);
  }
}

/**
 * Tìm Event theo contractEventId.
 * Nếu chưa có thì trả null.
 */
async function findReferencedEvent(contractEventId) {
  if (!contractEventId) return null;

  return Event.findOne({ contractEventId })
    .select("_id organizer organizerStake contractEventId")
    .lean();
}

/**
 * Xử lý EventCreated
 * Tạo mới hoặc cập nhật Event local DB
 */
async function handleEventCreated(log) {
  const { args, transactionHash, blockNumber } = log;

  const contractEventId = toStringId(args.eventId);
  const organizer = lowerAddress(args.organizer);

  await Event.updateOne(
    { contractEventId },
    {
      $set: {
        contractEventId,
        organizer,
        fundingGoal: toAmountString(args.fundingGoal),
        fundingDeadline: args.fundingDeadline
          ? new Date(Number(args.fundingDeadline) * 1000)
          : undefined,
        minStakeRequired: toAmountString(args.minStakeRequired),
        organizerShareBps: toNumberSafe(args.organizerShareBps),
        totalTickets: toNumberSafe(args.maxTickets),
        ticketUsageThreshold: toNumberSafe(args.usedThreshold),
        organizerStake: toAmountString(args.stakeAmount),
        currentFunding: "0",
        totalRevenue: "0",
        refundedAmount: "0",
        status: "funding",
        escrowStatus: "holding",
        createdByTxHash: transactionHash?.toLowerCase(),
        createdBlockNumber: blockNumber,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  // stake ban đầu của organizer cũng lưu vào Contribution cho dễ rebuild
  if (compareBigInt(toAmountString(args.stakeAmount), "0") > 0) {
    const eventDoc = await findReferencedEvent(contractEventId);
    if (!eventDoc) return;

    await Contribution.updateOne(
      {
        txHash: transactionHash.toLowerCase(),
        type: "organizer_stake",
      },
      {
        $set: {
          eventId: eventDoc._id,
          contributor: organizer,
          amount: toAmountString(args.stakeAmount),
          type: "organizer_stake",
          status: "confirmed",
          contractEventId,
          txHash: transactionHash.toLowerCase(),
          blockNumber,
          timestamp: new Date(),
        },
      },
      { upsert: true },
    );
  }
}

/**
 * Xử lý contribution của donator
 */
async function handleContributionMade(log, eventDoc) {
  const { args, transactionHash, blockNumber } = log;

  const contributor = lowerAddress(args.donator);
  const amount = toAmountString(args.amount);

  await Contribution.updateOne(
    {
      txHash: transactionHash.toLowerCase(),
      type: "donator_contribution",
    },
    {
      $set: {
        eventId: eventDoc._id,
        contributor,
        amount,
        type: "donator_contribution",
        status: "confirmed",
        contractEventId: eventDoc.contractEventId,
        txHash: transactionHash.toLowerCase(),
        blockNumber,
        timestamp: new Date(),
      },
    },
    { upsert: true },
  );

  await rebuildFundState(eventDoc._id);
}

/**
 * Xử lý SharesIssued
 * Có thể dùng để cập nhật Share ngay nếu muốn bám theo on-chain shares
 */
async function handleSharesIssued(log, eventDoc) {
  const { args } = log;

  const holder = lowerAddress(args.donator);
  const sharesMinted = toAmountString(args.sharesMinted);

  await Share.updateOne(
    { eventId: eventDoc._id, holder },
    [
      {
        $set: {
          mintedShares: {
            $toString: {
              $add: [
                { $convert: { input: "$mintedShares", to: "decimal", onError: 0, onNull: 0 } },
                { $convert: { input: sharesMinted, to: "decimal", onError: 0, onNull: 0 } },
              ],
            },
          },
          claimedReward: { $ifNull: ["$claimedReward", "0"] },
          pendingReward: { $ifNull: ["$pendingReward", "0"] },
        },
      },
    ],
    { upsert: true },
  );

  await rebuildFundState(eventDoc._id);
}

async function handleFundingSuccessful(eventDoc) {
  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: "funded",
      },
    },
  );
}

async function handleFundingFinalized(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: getEventStatusLabel(args.statusAfterFinalize),
        sharesFinalized: true,
        totalShares: toAmountString(args.totalShares),
        fundingFinalizedAt: new Date(),
      },
    },
  );
}

async function handleTicketingStarted(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: "ticketing",
        totalMinted: toNumberSafe(args.mintedQty),
        ticketType: toNumberSafe(args.ticketType),
        ticketingStartedAt: new Date(),
      },
    },
  );
}

async function handleCompleted(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: "completed",
        totalTicketsUsed: toNumberSafe(args.usedTickets),
        completedAt: new Date(),
      },
    },
  );
}

async function handleRevenueReleased(log, eventDoc) {
  const { args, transactionHash } = log;

  const totalRevenue = toAmountString(args.totalRevenue);
  const platformFee = toAmountString(args.platformFee);
  const organizerShare = toAmountString(args.organizerShare);
  const donatorPool = toAmountString(args.donatorPool);
  const newAccRewardPerShare = toAmountString(args.newAccRewardPerShare);

  await RevenueDistribution.updateOne(
    { txHash: transactionHash.toLowerCase() },
    {
      $set: {
        eventId: eventDoc._id,
        totalRevenue,
        platformFee,
        platformFeePercentage:
          compareBigInt(totalRevenue, "0") > 0
            ? Number((toBigInt(platformFee) * 10000n) / toBigInt(totalRevenue)) /
              100
            : 0,
        organizerShare,
        organizerSharePercentage:
          compareBigInt(totalRevenue, "0") > 0
            ? Number(
                (toBigInt(organizerShare) * 10000n) / toBigInt(totalRevenue),
              ) / 100
            : 0,
        donatorPool,
        accRewardPerShare: newAccRewardPerShare,
        status: "completed",
        txHash: transactionHash.toLowerCase(),
        triggeredAt: new Date(),
        completedAt: new Date(),
        triggerType: "manual_release",
      },
    },
    { upsert: true },
  );

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: "completed",
        escrowStatus: "released",
        totalRevenue,
        platformFee,
        organizerShare,
        donatorPool,
        revenueReleased: true,
        revenueDistributedAt: new Date(),
      },
    },
  );
}

async function handleRewardClaimed(log, eventDoc) {
  const { args, transactionHash } = log;

  const claimer = lowerAddress(args.donator);
  const amount = toAmountString(args.amount);

  await RewardClaim.updateOne(
    { txHash: transactionHash.toLowerCase() },
    {
      $set: {
        eventId: eventDoc._id,
        claimer,
        rewardAmount: amount,
        status: "confirmed",
        txHash: transactionHash.toLowerCase(),
        claimedAt: new Date(),
      },
    },
    { upsert: true },
  );

  await Share.updateOne(
    { eventId: eventDoc._id, holder: claimer },
    [
      {
        $set: {
          claimedReward: {
            $toString: {
              $add: [
                { $convert: { input: "$claimedReward", to: "decimal", onError: 0, onNull: 0 } },
                { $convert: { input: amount, to: "decimal", onError: 0, onNull: 0 } },
              ],
            },
          },
        },
      },
    ],
  );
}

async function handleRefundsEnabled(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        escrowStatus: "refund_enabled",
        refundsEnabled: true,
        refundPool: toAmountString(args.refundPoolAmount),
        refundEnabledAt: new Date(),
      },
    },
  );
}

async function handleTicketRefundPaid(log, eventDoc) {
  const { args } = log;

  const amount = toAmountString(args.amount);

  await Event.updateOne(
    { _id: eventDoc._id },
    [
      {
        $set: {
          refundedAmount: {
            $toString: {
              $add: [
                { $convert: { input: "$refundedAmount", to: "decimal", onError: 0, onNull: 0 } },
                { $convert: { input: amount, to: "decimal", onError: 0, onNull: 0 } },
              ],
            },
          },
          escrowStatus: "refunding",
          lastRefundedAt: new Date(),
        },
      },
    ],
  );
}

async function handleRefundPoolDeposited(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        refundPool: toAmountString(args.newRefundPool),
        escrowStatus: "refund_pool_funded",
        lastRefundPoolDepositAt: new Date(),
      },
    },
  );
}

async function handlePenaltyApplied(log, eventDoc) {
  const { args, transactionHash } = log;

  const penaltyAmount = toAmountString(args.amount);
  const penaltyBps = toNumberSafe(args.penaltyBps);

  await Penalty.updateOne(
    { txHash: transactionHash.toLowerCase() },
    {
      $set: {
        eventId: eventDoc._id,
        organizer: lowerAddress(eventDoc.organizer),
        stakeAmount: eventDoc.organizerStake || "0",
        penaltyAmount,
        penaltyPercentage: penaltyBps / 100,
        penaltyBps,
        reason: args.reason ?? "unknown",
        txHash: transactionHash.toLowerCase(),
        status: "processed",
        processedAt: new Date(),
      },
    },
    { upsert: true },
  );

  await Event.updateOne(
    { _id: eventDoc._id },
    [
      {
        $set: {
          totalPenaltyAmount: {
            $toString: {
              $add: [
                { $convert: { input: "$totalPenaltyAmount", to: "decimal", onError: 0, onNull: 0 } },
                { $convert: { input: penaltyAmount, to: "decimal", onError: 0, onNull: 0 } },
              ],
            },
          },
          lastPenaltyAt: new Date(),
        },
      },
    ],
  );
}

async function handleTicketRevenueDeposited(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    [
      {
        $set: {
          escrowStatus: "holding_revenue",
          escrowedRevenue: toAmountString(args.newEscrowedRevenue),
          ticketRevenueDeposited: {
            $toString: {
              $add: [
                {
                  $convert: {
                    input: "$ticketRevenueDeposited",
                    to: "decimal",
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $convert: {
                    input: toAmountString(args.amount),
                    to: "decimal",
                    onError: 0,
                    onNull: 0,
                  },
                },
              ],
            },
          },
          lastTicketRevenueAt: new Date(),
        },
      },
    ],
  );
}

async function handleRoyaltyDeposited(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    [
      {
        $set: {
          escrowStatus: "holding_revenue",
          escrowedRevenue: toAmountString(args.newEscrowedRevenue),
          royaltyRevenueDeposited: {
            $toString: {
              $add: [
                {
                  $convert: {
                    input: "$royaltyRevenueDeposited",
                    to: "decimal",
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $convert: {
                    input: toAmountString(args.amount),
                    to: "decimal",
                    onError: 0,
                    onNull: 0,
                  },
                },
              ],
            },
          },
          lastRoyaltyRevenueAt: new Date(),
        },
      },
    ],
  );
}

async function handleContributionRefunded(log, eventDoc) {
  const { args } = log;

  const contributor = lowerAddress(args.donator);
  const amount = toAmountString(args.amount);

  await Contribution.updateMany(
    {
      eventId: eventDoc._id,
      contributor,
      status: "confirmed",
    },
    {
      $set: {
        status: "refunded",
        refundedAt: new Date(),
      },
    },
  );

  await Event.updateOne(
    { _id: eventDoc._id },
    [
      {
        $set: {
          refundedAmount: {
            $toString: {
              $add: [
                { $convert: { input: "$refundedAmount", to: "decimal", onError: 0, onNull: 0 } },
                { $convert: { input: amount, to: "decimal", onError: 0, onNull: 0 } },
              ],
            },
          },
          status: "cancelled",
          escrowStatus: "refunded",
          lastContributionRefundAt: new Date(),
        },
      },
    ],
  );

  await rebuildFundState(eventDoc._id);
}

async function handleStakeWithdrawn(log, eventDoc) {
  const { args } = log;

  await Event.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        organizerStakeWithdrawn: toAmountString(args.amount),
        stakeWithdrawnAt: new Date(),
      },
    },
  );
}

// -------------------------
// Main log processor
// -------------------------
async function processFundLog(log) {
  const { eventName, args } = log;

  if (!eventName) return;

  // EventCreated phải xử lý trước vì lúc này event local có thể chưa tồn tại
  if (eventName === "EventCreated") {
    await handleEventCreated(log);
    return;
  }

  const contractEventId = toStringId(args?.eventId);
  const eventDoc = await findReferencedEvent(contractEventId);

  if (!eventDoc) return;

  switch (eventName) {
    case "ContributionMade":
      await handleContributionMade(log, eventDoc);
      break;

    case "SharesIssued":
      await handleSharesIssued(log, eventDoc);
      break;

    case "FundingSuccessful":
      await handleFundingSuccessful(eventDoc);
      break;

    case "FundingFinalized":
      await handleFundingFinalized(log, eventDoc);
      break;

    case "TicketingStarted":
      await handleTicketingStarted(log, eventDoc);
      break;

    case "Completed":
      await handleCompleted(log, eventDoc);
      break;

    case "RevenueReleased":
      await handleRevenueReleased(log, eventDoc);
      break;

    case "RewardClaimed":
      await handleRewardClaimed(log, eventDoc);
      break;

    case "RefundsEnabled":
      await handleRefundsEnabled(log, eventDoc);
      break;

    case "TicketRefundPaid":
      await handleTicketRefundPaid(log, eventDoc);
      break;

    case "RefundPoolDeposited":
      await handleRefundPoolDeposited(log, eventDoc);
      break;

    case "PenaltyApplied":
      await handlePenaltyApplied(log, eventDoc);
      break;

    case "TicketRevenueDeposited":
      await handleTicketRevenueDeposited(log, eventDoc);
      break;

    case "RoyaltyDeposited":
      await handleRoyaltyDeposited(log, eventDoc);
      break;

    case "ContributionRefunded":
      await handleContributionRefunded(log, eventDoc);
      break;

    case "StakeWithdrawn":
      await handleStakeWithdrawn(log, eventDoc);
      break;

    default:
      break;
  }
}

// -------------------------
// Main processor loop once
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

    const logs = await ChainLog.find({
      contractName: CONTRACT_NAME,
      contractAddress,
      blockNumber: { $gte: currentFrom, $lte: currentTo },
    })
      .sort({ blockNumber: 1, transactionIndex: 1, logIndex: 1 })
      .lean();

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

// -------------------------
// Infinite loop runner
// -------------------------
export async function runFundProcessorLoop() {
  const intervalMs = getNumberEnv("CHAIN_PROCESS_INTERVAL_MS", 10_000);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await processFundLogsOnce();
    } catch (err) {
      await markError(PROCESSOR_NAME, err);
      // eslint-disable-next-line no-console
      console.error("Fund processor error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
