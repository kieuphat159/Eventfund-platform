import mongoose from 'mongoose';
import { Share as DefaultShare } from '../models/index.js';

/**
 * Create a new share
 * @param {Object} shareData - Share data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created share as plain object
 */
export async function createShare(shareData, models = {}) {
  const Share = models.Share || DefaultShare;
  const share = new Share(shareData);
  await share.save();
  return share.toObject();
}

/**
 * Find share by ID
 * @param {string} shareId - Share ID
 * @param {Object} options - Query options (populate, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Share as plain object or null
 */
export async function findById(shareId, options = {}, models = {}) {
  const Share = models.Share || DefaultShare;

  let query = Share.findById(shareId);

  // Handle population
  if (options.populate) {
    if (Array.isArray(options.populate)) {
      options.populate.forEach(field => {
        query = query.populate(field);
      });
    } else {
      query = query.populate(options.populate);
    }
  }

  // Handle lean query
  if (options.lean !== false) {
    query = query.lean();
  }

  const share = await query;

  // If not using lean, convert to plain object
  if (share && !options.lean && options.lean !== false) {
    return share;
  }

  return share && typeof share.toObject === 'function' ? share.toObject() : share;
}

/**
 * Find shares with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findShares(query, options, models = {}) {
  const Share = models.Share || DefaultShare;

  // Default options
  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false, // Default to true
  };

  // Handle population
  if (options.populate) {
    paginationOptions.populate = options.populate;
  }

  return await Share.paginate(query, paginationOptions);
}

/**
 * Find shares by holder address
 * @param {string} holderAddress - Holder wallet address
 * @param {Object} options - Query options (page, limit, sort, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findByHolder(holderAddress, options = {}, models = {}) {
  const Share = models.Share || DefaultShare;

  // Normalize wallet address to lowercase
  const normalizedAddress = holderAddress.toLowerCase();

  const query = { holder: normalizedAddress };

  // Default options
  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false, // Default to true
  };

  // Handle population
  if (options.populate) {
    paginationOptions.populate = options.populate;
  }

  return await Share.paginate(query, paginationOptions);
}

/**
 * Find shares by event ID
 * @param {string} eventId - Event ID
 * @param {Object} options - Query options (page, limit, sort, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findByEvent(eventId, options = {}, models = {}) {
  const Share = models.Share || DefaultShare;

  const query = { eventId };

  // Default options
  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false, // Default to true
  };

  // Handle population
  if (options.populate) {
    paginationOptions.populate = options.populate;
  }

  return await Share.paginate(query, paginationOptions);
}

/**
 * Find share by event and holder
 * @param {string} eventId - Event ID
 * @param {string} holderAddress - Holder wallet address
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Share as plain object or null
 */
export async function findByEventAndHolder(eventId, holderAddress, models = {}) {
  const Share = models.Share || DefaultShare;

  const normalizedAddress = holderAddress.toLowerCase();

  const share = await Share.findOne({
    eventId,
    holder: normalizedAddress,
  }).lean();

  return share ?? null;
}

/**
 * Tăng claimedReward cho một Share (theo eventId + holder) — idempotent theo txHash
 */
export async function incrementClaimedReward(eventId, holder, amount, txHash, models = {}) {
  const Share = models.Share || DefaultShare;

  const normalizedTxHash = txHash?.toLowerCase();

  // Check xem txHash nay da duoc xu ly chua
  const existing = await Share.findOne({
    eventId,
    holder: holder.toLowerCase(),
    processedRewardTxHashes: normalizedTxHash,
  }).lean();

  if (existing) return; // da xu ly, skip

  await Share.updateOne(
    { eventId, holder: holder.toLowerCase() },
    {
      $inc: { claimedReward: amount },
      $addToSet: { processedRewardTxHashes: normalizedTxHash },
    },
    { upsert: true }
  );
}

/**
 * Update general rewards (nếu sau này cần update nhiều field)
 * Giữ lại để tương thích cũ
 */
export async function updateRewards(eventId, holder, updateData, models = {}) {
  const Share = models.Share || DefaultShare;

  return await Share.updateOne(
    {
      eventId,
      holder: holder.toLowerCase(),
    },
    updateData,
    { upsert: true, new: true, runValidators: true }
  );
}

/**
 * Count shares by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countShares(query = {}, models = {}) {
  const Share = models.Share || DefaultShare;
  return await Share.countDocuments(query);
}

/**
 * Get total contribution by event
 * @param {string} eventId - Event ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<string>} Total contribution as string
 */
export async function getTotalContributionByEvent(eventId, models = {}) {
  const Share = models.Share || DefaultShare;

  // Fetch shares và tính tổng bằng BigInt để tránh overflow
  const shares = await Share.find({
    eventId: mongoose.Types.ObjectId(eventId)
  }).select('contributionAmount').lean();

  let totalBigInt = BigInt(0);
  shares.forEach(share => {
    if (share.contributionAmount) {
      // Chuyển contributionAmount sang BigInt (có thể là string hoặc number)
      const amountBigInt = typeof share.contributionAmount === 'string'
        ? BigInt(share.contributionAmount)
        : BigInt(share.contributionAmount);
      totalBigInt += amountBigInt;
    }
  });

  // Trả về dưới dạng string
  return totalBigInt.toString();
}

/**
 * Delete share by ID
 * @param {string} shareId - Share ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteById(shareId, models = {}) {
  const Share = models.Share || DefaultShare;
  const result = await Share.findByIdAndDelete(shareId);
  return result !== null;
}

/**
 * Upsert Shares Issued (idempotent)
 * Dùng khi xử lý event SharesIssued
 * sharesMinted is recorded for reference but Share percentage is rebuilt via rebuildFundState
 */
export async function upsertSharesIssued(eventId, holder, sharesMinted, models = {}) {
  const Share = models.Share || DefaultShare;

  await Share.updateOne(
    { eventId, holder: holder.toLowerCase() },
    {
      // mintedShares removed: not in Share schema; rebuildFundState is source of truth
      $setOnInsert: {
        claimedReward: 0,
        contributionAmount: 0,
        sharePercentage: 0,
      },
    },
    { upsert: true }
  );
}

/**
 * Clear processedRewardTxHashes entries cho cac txHash bi reorg
 */
export async function clearProcessedRewardTxHashes(txHashes, models = {}) {
  const Share = models.Share || DefaultShare;
  return await Share.updateMany(
    {},
    { $pullAll: { processedRewardTxHashes: txHashes } }
  );
}

/**
 * Xoa tat ca Share cua 1 event (dung khi full rebuild sau reorg)
 */
export async function deleteByEventId(eventId, models = {}) {
  const Share = models.Share || DefaultShare;
  return await Share.deleteMany({ eventId });
}

export default { createShare, findById, findShares, findByHolder, findByEvent, findByEventAndHolder, incrementClaimedReward, updateRewards, countShares, getTotalContributionByEvent, deleteById, upsertSharesIssued, clearProcessedRewardTxHashes, deleteByEventId };
