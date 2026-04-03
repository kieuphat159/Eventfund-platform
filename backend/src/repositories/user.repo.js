import { User as DefaultUser } from '../models/index.js';

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created user as plain object
 */
export async function createUser(userData, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedData = {
    ...userData,
    walletAddress: userData.walletAddress?.toLowerCase()
  };

  const user = await User.create(normalizedData);
  return user.toObject();
}

/**
 * Find user by wallet address
 * @param {string} walletAddress - Wallet address
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} User as plain object or null
 */
export async function findByWalletAddress(walletAddress, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedAddress = walletAddress?.toLowerCase();

  // Thay thế .toObject() rườm rà bằng .lean()
  return await User.findOne({ walletAddress: normalizedAddress }).lean();
}

/**
 * Find user by ID
 * @param {string} userId - User ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} User as plain object or null
 */
export async function findById(userId, models = {}) {
  const User = models.User || DefaultUser;
  return await User.findById(userId).lean();
}

/**
 * Find users with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findUsers(query, options, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedQuery = { ...query };
  if (normalizedQuery.walletAddress) {
    normalizedQuery.walletAddress = normalizedQuery.walletAddress.toLowerCase();
  }

  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false
  };

  return await User.paginate(normalizedQuery, paginationOptions);
}

/**
 * Update user profile
 * @param {string} walletAddress - Wallet address
 * @param {Object} updates - Update data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated user as plain object or null
 */
export async function updateProfile(walletAddress, updates, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedAddress = walletAddress?.toLowerCase();

  return await User.findOneAndUpdate(
    { walletAddress: normalizedAddress },
    updates,
    { new: true, runValidators: true, lean: true } // Đưa lean vào tận đây
  );
}

/**
 * Update user role
 * @param {string} walletAddress - Wallet address
 * @param {string} role - New role
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated user as plain object or null
 */
export async function updateRole(walletAddress, role, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedAddress = walletAddress?.toLowerCase();

  return await User.findOneAndUpdate(
    { walletAddress: normalizedAddress },
    { role },
    { new: true, runValidators: true, lean: true }
  );
}

/**
 * Count users by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countUsers(query = {}, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedQuery = { ...query };
  if (normalizedQuery.walletAddress) {
    normalizedQuery.walletAddress = normalizedQuery.walletAddress.toLowerCase();
  }

  return await User.countDocuments(normalizedQuery);
}

/**
 * Delete user by wallet address
 * @param {string} walletAddress - Wallet address
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Deleted user as plain object or null
 */
export async function deleteByWalletAddress(walletAddress, models = {}) {
  const User = models.User || DefaultUser;

  const normalizedAddress = walletAddress?.toLowerCase();

  // Dùng .lean() thay cho .toObject()
  return await User.findOneAndDelete({ walletAddress: normalizedAddress }).lean();
}

/**
 * Update user by ID
 * @param {string} userId - User ID
 * @param {Object} updates - Update data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated user as plain object or null
 */
export async function updateById(userId, updates, models = {}) {
  const User = models.User || DefaultUser;
  return await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true, lean: true });
}
