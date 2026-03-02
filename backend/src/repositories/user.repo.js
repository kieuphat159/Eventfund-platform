import { User as DefaultUser } from '../models/index.js';

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created user as plain object
 */
export async function createUser(userData, models = {}) {
  const User = models.User || DefaultUser;

  // Normalize wallet address to lowercase
  const normalizedData = {
    ...userData,
    walletAddress: userData.walletAddress?.toLowerCase()
  };

  const user = new User(normalizedData);
  await user.save();
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

  // Normalize wallet address to lowercase for consistent querying
  const normalizedAddress = walletAddress?.toLowerCase();

  const user = await User.findOne({ walletAddress: normalizedAddress });
  return user ? user.toObject() : null;
}

/**
 * Find user by ID
 * @param {string} userId - User ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} User as plain object or null
 */
export async function findById(userId, models = {}) {
  const User = models.User || DefaultUser;
  const user = await User.findById(userId);
  return user ? user.toObject() : null;
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

  // Normalize wallet address in query if present
  const normalizedQuery = { ...query };
  if (normalizedQuery.walletAddress) {
    normalizedQuery.walletAddress = normalizedQuery.walletAddress.toLowerCase();
  }

  // Default options
  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false // Default to true
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

  // Normalize wallet address to lowercase for consistent querying
  const normalizedAddress = walletAddress?.toLowerCase();

  const user = await User.findOneAndUpdate(
    { walletAddress: normalizedAddress },
    updates,
    { new: true, runValidators: true }
  );
  return user ? user.toObject() : null;
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

  // Normalize wallet address to lowercase for consistent querying
  const normalizedAddress = walletAddress?.toLowerCase();

  const user = await User.findOneAndUpdate(
    { walletAddress: normalizedAddress },
    { role },
    { new: true, runValidators: true }
  );
  return user ? user.toObject() : null;
}

/**
 * Count users by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countUsers(query = {}, models = {}) {
  const User = models.User || DefaultUser;

  // Normalize wallet address in query if present
  const normalizedQuery = { ...query };
  if (normalizedQuery.walletAddress) {
    normalizedQuery.walletAddress = normalizedQuery.walletAddress.toLowerCase();
  }

  return await User.countDocuments(normalizedQuery);
}
