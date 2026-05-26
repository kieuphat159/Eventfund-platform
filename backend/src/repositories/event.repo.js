import { Event as DefaultEvent } from '../models/index.js';
import cacheService from '../services/cache/redis.service.js';

function normalizeAddress(address) {
  return address ? String(address).toLowerCase() : undefined;
}

function buildOnChainIdentityFilter(contractEventId, fundContractAddress) {
  const filter = {
    contractEventId: String(contractEventId),
  };

  const normalizedFundAddress = normalizeAddress(fundContractAddress);
  if (normalizedFundAddress) {
    filter.fundContractAddress = normalizedFundAddress;
  }

  return filter;
}

/**
 * Create a new event
 * @param {Object} eventData - Event data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created event as plain object
 */
export async function createEvent(eventData, models = {}) {
  const Event = models.Event || DefaultEvent;
  const event = new Event(eventData);
  await event.save();
  return event.toObject(); // Cần toObject() vì đây là document mới tạo
}

/**
 * Find event by ID
 * @param {string} eventId - Event ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Event as plain object or null
 */
export async function findById(eventId, models = {}) {
  const Event = models.Event || DefaultEvent;

  // Try to get from cache first
  const cached = await cacheService.getEvent(eventId);
  if (cached) {
    return cached;
  }

  // Cache miss - load from database
  const event = await Event.findById(eventId).lean();

  if (event) {
    // Cache the event for future requests
    await cacheService.cacheEvent(eventId, event);
  }

  return event;
}

/**
 * Find events with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findEvents(query, options, models = {}) {
  const Event = models.Event || DefaultEvent;

  // Default options
  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false // Default to true
  };

  return await Event.paginate(query, paginationOptions);
}

/**
 * Update event by ID
 * @param {string} eventId - Event ID
 * @param {Object} updates - Update data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated event as plain object or null
 */
export async function updateById(eventId, updates, models = {}) {
  const Event = models.Event || DefaultEvent;

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    updates,
    { new: true, runValidators: true, lean: true }
  );

  // Invalidate cache after update
  if (updatedEvent) {
    await cacheService.invalidateEvent(eventId);
  }

  return updatedEvent;
}

/**
 * Delete event by ID
 * @param {string} eventId - Event ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteById(eventId, models = {}) {
  const Event = models.Event || DefaultEvent;
  const result = await Event.findByIdAndDelete(eventId);

  // Invalidate cache after deletion
  if (result) {
    await cacheService.invalidateEvent(eventId);
  }

  return result !== null;
}

/**
 * Update funding status
 * @param {string} eventId - Event ID
 * @param {Object} fundingData - Funding data (currentFunding, status)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated event as plain object or null
 */
export async function updateFundingStatus(eventId, fundingData, models = {}) {
  const Event = models.Event || DefaultEvent;

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    fundingData,
    { new: true, runValidators: true, lean: true }
  );

  // Invalidate cache after funding status update
  if (updatedEvent) {
    await cacheService.invalidateEvent(eventId);
  }

  return updatedEvent;
}

/**
 * Increment ticket counters
 * @param {string} eventId - Event ID
 * @param {Object} increments - Counter increments (ticketsSold, totalTicketsUsed)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated event as plain object or null
 */
export async function incrementTicketCounters(eventId, increments, models = {}) {
  const Event = models.Event || DefaultEvent;

  const updateOperation = {};
  if (increments.ticketsSold !== undefined) {
    updateOperation.$inc = updateOperation.$inc || {};
    updateOperation.$inc.ticketsSold = increments.ticketsSold;
  }
  if (increments.totalTicketsUsed !== undefined) {
    updateOperation.$inc = updateOperation.$inc || {};
    updateOperation.$inc.totalTicketsUsed = increments.totalTicketsUsed;
  }

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    updateOperation,
    { new: true, runValidators: true, lean: true }
  );

  // Invalidate cache after counter update
  if (updatedEvent) {
    await cacheService.invalidateEvent(eventId);
  }

  return updatedEvent;
}

/**
 * Count events by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countEvents(query = {}, models = {}) {
  const Event = models.Event || DefaultEvent;
  return await Event.countDocuments(query);
}

/**
 * Aggregate revenue statistics
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Revenue stats with totalRevenue and totalFunding as strings
 */
export async function getRevenueStats(models = {}) {
  const Event = models.Event || DefaultEvent;

  // Lấy tất cả events với chỉ các trường cần thiết
  const events = await Event.find({}, { totalRevenue: 1, currentFunding: 1 }).lean();

  // Tính tổng bằng BigInt (vì totalRevenue và currentFunding là String để tránh sai số)
  let totalRevenue = 0n;
  let totalFunding = 0n;

  for (const event of events) {
    if (event.totalRevenue) {
      totalRevenue += BigInt(event.totalRevenue);
    }
    if (event.currentFunding) {
      totalFunding += BigInt(event.currentFunding);
    }
  }

  // Chuyển lại thành String để lưu/trả về
  return {
    _id: null,
    totalRevenue: totalRevenue.toString(),
    totalFunding: totalFunding.toString()
  };
}

/**
 * Upsert Event by contractEventId (idempotent)
 * @param {string} contractEventId
 * @param {Object} data - Data to update/insert
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Updated/created event as plain object
 */
export async function upsertByContractEventId(contractEventId, data, models = {}) {
  const Event = models.Event || DefaultEvent;
  const normalizedFundAddress = normalizeAddress(data.fundContractAddress);

  // Build $set explicitly — no spread to avoid injecting stale/unknown fields
  const setFields = {
    contractEventId,
    fundContractAddress: normalizedFundAddress,
    onChainOrganizer: data.onChainOrganizer,
    fundingGoal: data.fundingGoal,
    fundingDeadline: data.fundingDeadline,
    minStakeRequired: data.minStakeRequired,
    organizerShareBps: data.organizerShareBps,
    ticketPrice: data.ticketPrice,
    maxTickets: data.maxTickets,
    totalTickets: data.totalTickets ?? data.maxTickets,
    usedThreshold: data.usedThreshold,
    organizerStake: data.organizerStake, // was organizerStakeLocked — corrected
    status: data.status,
    escrowStatus: data.escrowStatus,
    // createdByTxHash and createdBlockNumber omitted: traceable via ChainLog
  };

  // Strip undefined values so Mongoose doesn't overwrite existing fields with undefined
  Object.keys(setFields).forEach((k) => setFields[k] === undefined && delete setFields[k]);

  const result = await Event.findOneAndUpdate(
    buildOnChainIdentityFilter(contractEventId, normalizedFundAddress),
    {
      $set: setFields,
      $setOnInsert: {
        organizer: data.organizer,
        title: data.title || `On-chain Event ${contractEventId}`,
        startDate: data.startDate || data.fundingDeadline || new Date(),
        endDate:
          data.endDate ||
          (data.fundingDeadline
            ? new Date(new Date(data.fundingDeadline).getTime() + 60 * 60 * 1000)
            : new Date(Date.now() + 60 * 60 * 1000)),
        createdAt: new Date(),
        currentFunding: "0",  // String to match schema type
        totalRevenue: "0",    // String to match schema type
        refundedAmount: 0,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      lean: true
    }
  );

  return result;
}

/**
 * Update event by contractEventId (dùng trong full rebuild)
 */
export async function updateByContractEventId(
  contractEventId,
  updates,
  fundContractAddress,
  models = {},
) {
  const Event = models.Event || DefaultEvent;
  return await Event.findOneAndUpdate(
    buildOnChainIdentityFilter(contractEventId, fundContractAddress),
    updates,
    { new: true, lean: true }
  );
}

/**
 * Find event by contractEventId (dùng trong processor)
 */
export async function findByContractEventId(
  contractEventId,
  fundContractAddress,
  models = {},
) {
  const Event = models.Event || DefaultEvent;
  return await Event.findOne(
    buildOnChainIdentityFilter(contractEventId, fundContractAddress),
  ).lean();
}

/**
 * Find event by full on-chain identity.
 */
export async function findByOnChainIdentity(
  { contractEventId, fundContractAddress },
  models = {},
) {
  return findByContractEventId(contractEventId, fundContractAddress, models);
}

/**
 * Find on-chain funding events whose deadline has passed and need finalization.
 * @param {Date} now
 * @param {number} limit
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Array<Object>>}
 */
export async function findDueFundingFinalizationEvents(
  now = new Date(),
  limit = 50,
  models = {},
) {
  const Event = models.Event || DefaultEvent;
  return await Event.find({
    contractEventId: { $exists: true, $ne: null },
    status: "funding",
    fundingDeadline: { $lte: now },
  })
    .sort({ fundingDeadline: 1, createdAt: 1 })
    .limit(limit)
    .lean();
}

/**
 * Find funded on-chain events whose ticketing window has started.
 * @param {Date} now
 * @param {number} limit
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Array<Object>>}
 */
export async function findDueTicketingStartEvents(
  now = new Date(),
  limit = 50,
  models = {},
) {
  const Event = models.Event || DefaultEvent;
  return await Event.find({
    contractEventId: { $exists: true, $ne: null },
    status: { $in: ["funding", "funded"] },
    ticketingStartAt: {
      $exists: true,
      $ne: null,
    },
  })
    .sort({ ticketingStartAt: 1, createdAt: 1 })
    .limit(limit)
    .lean();
}

/**
 * Find ticketing events whose ticket sales window has ended and need resolution.
 * @param {Date} now
 * @param {number} limit
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Array<Object>>}
 */
export async function findDueTicketingResolutionEvents(
  now = new Date(),
  limit = 50,
  models = {},
) {
  const Event = models.Event || DefaultEvent;
  return await Event.find({
    contractEventId: { $exists: true, $ne: null },
    status: "ticketing",
    ticketingEndAt: { $lte: now },
  })
    .sort({ ticketingEndAt: 1, createdAt: 1 })
    .limit(limit)
    .lean();
}

/**
 * Find ongoing events whose event end date has passed and need final settlement.
 * @param {Date} now
 * @param {number} limit
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Array<Object>>}
 */
export async function findDueEventSettlementEvents(
  now = new Date(),
  limit = 50,
  models = {},
) {
  const Event = models.Event || DefaultEvent;
  return await Event.find({
    contractEventId: { $exists: true, $ne: null },
    status: "ongoing",
    endDate: { $lte: now },
  })
    .sort({ endDate: 1, createdAt: 1 })
    .limit(limit)
    .lean();
}

/**
 * Find latest draft owned by organizer that matches on-chain creation params.
 */
export async function findMatchingDraftForOnChainEvent(match, models = {}) {
  const Event = models.Event || DefaultEvent;

  return await Event.findOne({
    status: "draft",
    organizer: match.organizer,
    fundingGoal: match.fundingGoal,
    minStakeRequired: match.minStakeRequired,
    ticketPrice: match.ticketPrice,
    maxTickets: match.maxTickets,
    usedThreshold: match.usedThreshold,
    contractEventId: { $exists: false },
  })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Check xem txHash+field da duoc xu ly chua (idempotency guard cho $inc)
 * Tra ve true neu da xu ly (should skip), false neu chua (should process)
 */
export async function isTxHashProcessed(eventId, txHash, field, models = {}) {
  const Event = models.Event || DefaultEvent;
  const count = await Event.countDocuments({
    _id: eventId,
    processedTxHashes: { $elemMatch: { txHash: txHash.toLowerCase(), field } },
  });
  return count > 0;
}

/**
 * Mark txHash+field da xu ly (them vao processedTxHashes array)
 */
export async function markTxHashProcessed(eventId, txHash, field, models = {}) {
  const Event = models.Event || DefaultEvent;
  await Event.updateOne(
    { _id: eventId },
    { $addToSet: { processedTxHashes: { txHash: txHash.toLowerCase(), field } } }
  );
}

/**
 * Atomically apply $inc/$set once per (txHash, field).
 * Handles String-typed numeric fields by using aggregation pipeline.
 * Returns true when delta is applied, false when txHash+field was already processed.
 */
export async function applyIdempotentDeltaByTxHash(
  eventId,
  txHash,
  field,
  { inc = {}, set = {} } = {},
  models = {}
) {
  const Event = models.Event || DefaultEvent;
  const normalizedTxHash = txHash.toLowerCase();

  const hasInc = inc && Object.keys(inc).length > 0;
  const hasSet = set && Object.keys(set).length > 0;

  if (!hasInc && !hasSet) return false;

  // Use aggregation pipeline for atomic updates on String-typed numeric fields
  const pipeline = [];

  // Add processedTxHashes entry (idempotency guard)
  pipeline.push({
    $set: {
      processedTxHashes: {
        $cond: {
          if: {
            $gt: [{
              $size: {
                $filter: {
                  input: { $ifNull: ['$processedTxHashes', []] },
                  cond: {
                    $and: [
                      { $eq: ['$$this.txHash', normalizedTxHash] },
                      { $eq: ['$$this.field', field] },
                    ],
                  },
                },
              },
            }, 0],
          },
          then: '$processedTxHashes',
          else: {
            $concatArrays: [
              { $ifNull: ['$processedTxHashes', []] },
              [{ txHash: normalizedTxHash, field }],
            ],
          },
        },
      },
    },
  });

  // Handle increment operations (convert String → Number → add → back to String)
  // Works with both Number and String inc values (handlers use toNumberSafe or toAmountString)
  if (hasInc) {
    for (const [key, value] of Object.entries(inc)) {
      pipeline.push({
        $set: {
          [key]: {
            $toString: {
              $add: [
                { $toLong: { $ifNull: [`$${key}`, '0'] } },
                { $toLong: value },
              ],
            },
          },
        },
      });
    }
  }

  // Handle set operations
  if (hasSet) {
    pipeline.push({ $set: set });
  }

  const result = await Event.updateOne(
    {
      _id: eventId,
      processedTxHashes: {
        $not: { $elemMatch: { txHash: normalizedTxHash, field } },
      },
    },
    pipeline,
    { updatePipeline: true }
  );

  return result.modifiedCount > 0;
}

/**
 * Clear processedTxHashes entries cho cac txHash bi reorg
 * Cho phep processor re-process lai cac tx do
 */
export async function clearProcessedTxHashes(txHashes, models = {}) {
  const Event = models.Event || DefaultEvent;
  return await Event.updateMany(
    {},
    { $pull: { processedTxHashes: { txHash: { $in: txHashes } } } }
  );
}

export default {
  createEvent,
  findById,
  findEvents,
  updateById,
  deleteById,
  updateFundingStatus,
  incrementTicketCounters,
  countEvents,
  getRevenueStats,
  upsertByContractEventId,
  findByContractEventId,
  findByOnChainIdentity,
  findDueFundingFinalizationEvents,
  findDueTicketingStartEvents,
  findDueTicketingResolutionEvents,
  findDueEventSettlementEvents,
  findMatchingDraftForOnChainEvent,
  isTxHashProcessed,
  markTxHashProcessed,
  applyIdempotentDeltaByTxHash,
  updateByContractEventId,
  clearProcessedTxHashes,
};
