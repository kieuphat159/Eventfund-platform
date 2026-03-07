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

  // Normalize wallet address to lowercase
  const normalizedAddress = holderAddress.toLowerCase();

  const share = await Share.findOne({
    eventId,
    holder: normalizedAddress
  });

  return share ? share.toObject() : null;
}

/**
 * Update share rewards
 * @param {string} shareId - Share ID
 * @param {Object} rewardData - Reward data (claimedReward, pendingReward)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated share as plain object or null
 */
export async function updateRewards(shareId, rewardData, models = {}) {
  const Share = models.Share || DefaultShare;

  const share = await Share.findByIdAndUpdate(
    shareId,
    rewardData,
    { new: true, runValidators: true }
  );

  return share ? share.toObject() : null;
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
