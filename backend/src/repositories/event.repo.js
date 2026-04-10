import { Event as DefaultEvent } from '../models/index.js';

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
  return await Event.findById(eventId).lean();
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
  return await Event.findByIdAndUpdate(
    eventId,
    updates,
    { new: true, runValidators: true, lean: true }
  );
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
  return await Event.findByIdAndUpdate(
    eventId,
    fundingData,
    { new: true, runValidators: true, lean: true }
  );
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

  return await Event.findByIdAndUpdate(
    eventId,
    updateOperation,
    { new: true, runValidators: true, lean: true }
  );
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

  // Build $set explicitly — no spread to avoid injecting stale/unknown fields
  const setFields = {
    contractEventId,
    organizer: data.organizer,
    fundingGoal: data.fundingGoal,
    fundingDeadline: data.fundingDeadline,
    minStakeRequired: data.minStakeRequired,
    organizerShareBps: data.organizerShareBps,
    ticketPrice: data.ticketPrice,
    maxTickets: data.maxTickets,
    usedThreshold: data.usedThreshold,
    organizerStake: data.organizerStake, // was organizerStakeLocked — corrected
    status: data.status,
    escrowStatus: data.escrowStatus,
    // createdByTxHash and createdBlockNumber omitted: traceable via ChainLog
  };

  // Strip undefined values so Mongoose doesn't overwrite existing fields with undefined
  Object.keys(setFields).forEach((k) => setFields[k] === undefined && delete setFields[k]);

  const result = await Event.findOneAndUpdate(
    { contractEventId },
    {
      $set: setFields,
      $setOnInsert: {
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
 * Find event by contractEventId (dùng trong processor)
 */
export async function findByContractEventId(contractEventId, models = {}) {
  const Event = models.Event || DefaultEvent;
  return await Event.findOne({ contractEventId }).lean();
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

export default { createEvent, findById, findEvents, updateById, deleteById, updateFundingStatus, incrementTicketCounters, countEvents, getRevenueStats, upsertByContractEventId, findByContractEventId, isTxHashProcessed, markTxHashProcessed };
