import { Penalty as DefaultPenalty } from '../models/index.js';

/**
 * Upsert Penalty by txHash (idempotent)
 */
export async function upsertPenalty(data, models = {}) {
  const Penalty = models.Penalty || DefaultPenalty;

  return await Penalty.findOneAndUpdate(
    { txHash: data.txHash?.toLowerCase() },
    {
      $set: {
        eventId: data.eventId,
        organizer: data.organizer,
        stakeAmount: data.stakeAmount,
        penaltyAmount: data.penaltyAmount,
        penaltyPercentage: data.penaltyPercentage,
        // penaltyBps omitted: not in Penalty schema
        reason: data.reason,
        status: data.status || "processed",
        processedAt: data.processedAt || new Date(),
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
 * Xoa Penalty theo txHashes (dung khi reorg)
 */
export async function deleteByTxHashes(txHashes, models = {}) {
  const Penalty = models.Penalty || DefaultPenalty;
  return await Penalty.deleteMany({ txHash: { $in: txHashes } });
}

export default { upsertPenalty, deleteByTxHashes };
