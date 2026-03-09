import { RewardClaim as DefaultRewardClaim } from '../models/index.js';

/**
 * Create a new reward claim
 * @param {Object} claimData - Reward claim data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created reward claim as plain object
 */
export async function createClaim(claimData, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;
  const claim = new RewardClaim(claimData);
  await claim.save();
  return claim.toObject();
}

/**
 * Find reward claim by ID
 * @param {string} claimId - Claim ID
 * @param {Object} options - Query options (populate, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Reward claim as plain object or null
 */
export async function findById(claimId, options = {}, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  let query = RewardClaim.findById(claimId);

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

  const claim = await query;

  // If not using lean, convert to plain object
  if (claim && !options.lean && options.lean !== false) {
    return claim;
  }

  return claim && typeof claim.toObject === 'function' ? claim.toObject() : claim;
}

/**
 * Find reward claims with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findClaims(query, options, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

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

  return await RewardClaim.paginate(query, paginationOptions);
}

/**
 * Find reward claims by claimer address
 * @param {string} claimerAddress - Claimer wallet address
 * @param {Object} options - Query options (page, limit, sort, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findByClaimer(claimerAddress, options = {}, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  // Normalize wallet address to lowercase
  const normalizedAddress = claimerAddress.toLowerCase();

  const query = { claimer: normalizedAddress };

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

  return await RewardClaim.paginate(query, paginationOptions);
}

/**
 * Find reward claims by event ID
 * @param {string} eventId - Event ID
 * @param {Object} options - Query options (page, limit, sort, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findByEvent(eventId, options = {}, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

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

  return await RewardClaim.paginate(query, paginationOptions);
}

/**
 * Find reward claims by distribution ID
 * @param {string} distributionId - Distribution ID
 * @param {Object} options - Query options (page, limit, sort, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findByDistribution(distributionId, options = {}, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  const query = { distributionId };

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

  return await RewardClaim.paginate(query, paginationOptions);
}

/**
 * Update claim status
 * @param {string} claimId - Claim ID
 * @param {string} status - New status (pending, confirmed, failed)
 * @param {Object} additionalData - Additional fields to update (txHash, claimedAt)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated claim as plain object or null
 */
export async function updateStatus(claimId, status, additionalData = {}, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  const updates = {
    status,
    ...additionalData,
  };

  // Set claimedAt if status is confirmed and not provided
  if (status === 'confirmed' && !additionalData.claimedAt) {
    updates.claimedAt = new Date();
  }

  const claim = await RewardClaim.findByIdAndUpdate(
    claimId,
    updates,
    { new: true, runValidators: true }
  );

  return claim ? claim.toObject() : null;
}

/**
 * Count claims by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countClaims(query = {}, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;
  return await RewardClaim.countDocuments(query);
}

/**
 * Get total rewards by claimer and status
 * @param {string} claimerAddress - Claimer wallet address
 * @param {string} status - Status filter (optional)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<string>} Total rewards as string
 */
export async function getTotalRewardsByClaimer(claimerAddress, status = null, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  // Normalize wallet address to lowercase
  const normalizedAddress = claimerAddress.toLowerCase();

  const matchQuery = { claimer: normalizedAddress };
  if (status) {
    matchQuery.status = status;
  }

  // Fetch claims và tính tổng bằng BigInt để tránh overflow
  const claims = await RewardClaim.find(matchQuery).select('rewardAmount').lean();

  let totalBigInt = BigInt(0);
  claims.forEach(claim => {
    if (claim.rewardAmount) {
      // Chuyển rewardAmount sang BigInt (có thể là string hoặc number)
      const amountBigInt = typeof claim.rewardAmount === 'string'
        ? BigInt(claim.rewardAmount)
        : BigInt(claim.rewardAmount);
      totalBigInt += amountBigInt;
    }
  });

  // Trả về dưới dạng string
  return totalBigInt.toString();
}

/**
 * Delete claim by ID
 * @param {string} claimId - Claim ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteById(claimId, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;
  const result = await RewardClaim.findByIdAndDelete(claimId);
  return result !== null;
}
