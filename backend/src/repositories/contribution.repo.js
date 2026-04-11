import { Contribution as DefaultContribution, Event as DefaultEvent } from '../models/index.js';

/**
 * Upsert Organizer Stake (idempotent)
 * data.eventContractId: on-chain string ID — resolved to ObjectId here
 * data.eventId: ObjectId (if already resolved, takes precedence)
 */
export async function upsertOrganizerStake(data, models = {}) {
  const Contribution = models.Contribution || DefaultContribution;
  const Event = models.Event || DefaultEvent;

  // Resolve eventId ObjectId from contractEventId if not provided directly
  let eventId = data.eventId;
  if (!eventId && data.eventContractId) {
    const eventDoc = await Event.findOne({ contractEventId: data.eventContractId }).lean();
    eventId = eventDoc?._id;
  }

  return await Contribution.updateOne(
    { txHash: data.txHash, type: "organizer_stake" },
    {
      $set: {
        eventId,
        contributor: data.organizer,
        amount: data.amount,
        type: "organizer_stake",
        status: "confirmed",
        blockNumber: data.blockNumber,
        timestamp: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Upsert Donator Contribution (idempotent)
 */
export async function upsertDonatorContribution(data, models = {}) {
  const Contribution = models.Contribution || DefaultContribution;

  return await Contribution.updateOne(
    { txHash: data.txHash, type: "donator_contribution" },
    {
      $set: {
        eventId: data.eventId,
        contributor: data.contributor,
        amount: data.amount,
        type: "donator_contribution",
        status: "confirmed",
        blockNumber: data.blockNumber,
        timestamp: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Rebuild Fund State (được tách ra từ processor)
 * Chỉ tính contribution confirmed
 */
export async function rebuildFundState(eventObjectId, models = {}) {
  const Contribution = models.Contribution || DefaultContribution;
  const Event = models.Event || DefaultEvent;

  const contributions = await Contribution.find({
    eventId: eventObjectId,
    status: "confirmed",
  }).lean();

  const totalFunding = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  await Event.updateOne(
    { _id: eventObjectId },
    { $set: { currentFunding: String(totalFunding) } } // String to match schema type
  );

  // Có thể thêm logic rebuild Share ở đây nếu muốn
  return totalFunding;
}

/**
 * Mark all confirmed contributions of a contributor as refunded (idempotent)
 * Dùng cho event ContributionRefunded
 */
export async function markContributionsAsRefunded(eventId, contributor, models = {}) {
  const Contribution = models.Contribution || DefaultContribution;

  return await Contribution.updateMany(
    {
      eventId,
      contributor: contributor.toLowerCase(),
      status: "confirmed",
    },
    {
      $set: {
        status: "refunded",
        refundedAt: new Date(),
      },
    }
  );
}

/**
 * Xoa Contribution theo txHashes (dung khi reorg)
 */
export async function deleteByTxHashes(txHashes, models = {}) {
  const Contribution = models.Contribution || DefaultContribution;
  return await Contribution.deleteMany({ txHash: { $in: txHashes } });
}

export default { upsertOrganizerStake, upsertDonatorContribution, rebuildFundState, markContributionsAsRefunded, deleteByTxHashes };
