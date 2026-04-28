import { RevenueDistribution as DefaultRevenueDistribution } from '../models/index.js';

/**
 * Upsert Revenue Distribution by txHash (idempotent)
 */
export async function upsertRevenueDistribution(data, models = {}) {
  const RevenueDistribution = models.RevenueDistribution || DefaultRevenueDistribution;

  return await RevenueDistribution.findOneAndUpdate(
    { txHash: data.txHash?.toLowerCase() },
    {
      $set: {
        eventId: data.eventId,
        totalRevenue: data.totalRevenue,
        platformFee: data.platformFee,
        platformFeePercentage: data.platformFeePercentage,
        organizerShare: data.organizerShare,
        organizerSharePercentage: data.organizerSharePercentage,
        donatorPool: data.donatorPool,
        accRewardPerShare: data.accRewardPerShare,
        status: data.status || "completed",
        triggeredAt: data.triggeredAt || new Date(),
        completedAt: data.completedAt || new Date(),
        triggerType: data.triggerType || "manual", // default corrected from "manual_release"
        txHash: data.txHash?.toLowerCase(),
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  ).lean();
}

/**
 * Find the latest completed RevenueDistribution for an event.
 * Used by fund.processor to resolve distributionId for RewardClaim
 */
export async function findLatestByEventId(eventId, models = {}) {
  const RevenueDistribution = models.RevenueDistribution || DefaultRevenueDistribution;

  return await RevenueDistribution.findOne(
    { eventId, status: "completed" },
    null,
    { sort: { completedAt: -1 } }
  ).lean();
}

/**
 * Xoa RevenueDistribution theo txHashes (dung khi reorg)
 */
export async function deleteByTxHashes(txHashes, models = {}) {
  const RevenueDistribution = models.RevenueDistribution || DefaultRevenueDistribution;
  return await RevenueDistribution.deleteMany({ txHash: { $in: txHashes } });
}

export default { upsertRevenueDistribution, findLatestByEventId, deleteByTxHashes };
