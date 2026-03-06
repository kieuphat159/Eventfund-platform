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

const CONTRACT_NAME = "Fund";
const PROCESSOR_NAME = "FundProcessor";

// --- Helper Utilities ---
const toStringId = (v) =>
  v === undefined || v === null ? undefined : String(v);
const lowerAddress = (v) => (v ? String(v).toLowerCase() : undefined);

/**
 * REBUILD LOGIC: Tính toán lại toàn bộ trạng thái tài chính của một Event.
 * Đảm bảo tính nhất quán giữa Contribution, Share và Event Funding.
 */
async function rebuildFundState(eventObjectId) {
  // 1. Lấy tất cả contribution đã xác nhận
  const contributions = await Contribution.find({
    eventId: eventObjectId,
    status: "confirmed",
  }).lean();

  const totalFunding = contributions.reduce(
    (sum, c) => sum + (c.amount || 0),
    0,
  );

  // 2. Cập nhật con số tổng vào Event
  await Event.updateOne(
    { _id: eventObjectId },
    { $set: { currentFunding: totalFunding } },
  );

  if (totalFunding === 0) return;

  // 3. Tính toán lại tỷ lệ cổ phần (%) cho từng Holder
  const holderMap = {};
  for (const c of contributions) {
    const addr = lowerAddress(c.contributor);
    if (!holderMap[addr]) {
      holderMap[addr] = { amount: 0 };
    }
    holderMap[addr].amount += c.amount;
  }

  const shareOps = Object.entries(holderMap).map(([holder, data]) => {
    const percentage = (data.amount / totalFunding) * 100;
    return {
      updateOne: {
        filter: { eventId: eventObjectId, holder },
        update: {
          $set: {
            contributionAmount: data.amount,
            sharePercentage: percentage,
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
 * LOGIC XỬ LÝ EVENT CHI TIẾT
 */
async function processFundLog(log) {
  const { eventName, args, transactionHash, blockNumber } = log;
  const txHash = transactionHash.toLowerCase();
  const contractEventId = toStringId(args.eventId);

  // Tìm Event tham chiếu
  const eventDoc = await Event.findOne({ contractEventId })
    .select("_id organizer")
    .lean();
  if (!eventDoc) return;

  switch (eventName) {
    case "ContributionReceived": {
      const amount = Number(args.amount);
      const contributor = lowerAddress(args.contributor);
      const isOrganizer = contributor === lowerAddress(eventDoc.organizer);

      await Contribution.updateOne(
        { txHash }, // Idempotency dựa trên txHash
        {
          $set: {
            eventId: eventDoc._id,
            contributor,
            amount,
            type: isOrganizer ? "organizer_stake" : "donator_contribution",
            status: "confirmed",
            txHash,
            blockNumber,
            timestamp: new Date(),
          },
        },
        { upsert: true },
      );

      await rebuildFundState(eventDoc._id);
      break;
    }

    case "RevenueDistributed": {
      const totalRevenue = Number(args.totalRevenue);
      const platformFee = Number(args.platformFee);

      await RevenueDistribution.updateOne(
        { txHash },
        {
          $set: {
            eventId: eventDoc._id,
            totalRevenue,
            platformFee,
            platformFeePercentage:
              totalRevenue > 0 ? (platformFee / totalRevenue) * 100 : 0,
            organizerShare: Number(args.organizerShare),
            organizerSharePercentage:
              totalRevenue > 0
                ? (Number(args.organizerShare) / totalRevenue) * 100
                : 0,
            donatorPool: Number(args.donatorPool),
            status: "completed",
            txHash,
            triggeredAt: new Date(),
            completedAt: new Date(),
            triggerType: "threshold_reached",
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
            totalRevenue: totalRevenue,
            revenueDistributedAt: new Date(),
          },
        },
      );
      break;
    }

    case "OrganizerPenalized": {
      const penaltyAmount = Number(args.penaltyAmount);
      const originalStake = Number(args.originalStake);

      await Penalty.updateOne(
        { txHash },
        {
          $set: {
            eventId: eventDoc._id,
            organizer: lowerAddress(eventDoc.organizer),
            stakeAmount: originalStake,
            penaltyAmount,
            penaltyPercentage:
              originalStake > 0 ? (penaltyAmount / originalStake) * 100 : 0,
            reason: args.reason || "threshold_not_met",
            txHash,
            status: "processed",
            processedAt: new Date(),
          },
        },
        { upsert: true },
      );
      break;
    }

    case "RewardClaimed": {
      const amount = Number(args.amount);
      const claimer = lowerAddress(args.claimer);

      await RewardClaim.updateOne(
        { txHash },
        {
          $set: {
            eventId: eventDoc._id,
            claimer,
            rewardAmount: amount,
            status: "confirmed",
            txHash,
            claimedAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Cập nhật số dư đã nhận vào bảng Share
      await Share.updateOne(
        { eventId: eventDoc._id, holder: claimer },
        { $inc: { claimedReward: amount } },
      );
      break;
    }

    case "FundRefunded": {
      await Contribution.updateMany(
        { eventId: eventDoc._id },
        { $set: { status: "refunded" } },
      );
      await Event.updateOne(
        { _id: eventDoc._id },
        { $set: { status: "failed", escrowStatus: "refunded" } },
      );
      break;
    }
  }
}

/**
 * HÀM CHẠY ĐỒNG BỘ CHÍNH
 */
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

  if (!plan.shouldSync) return { latest, target: plan.targetBlock };

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
  return { latest, target };
}

export async function runFundProcessorLoop() {
  const intervalMs = getNumberEnv("CHAIN_PROCESS_INTERVAL_MS", 10000);
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
