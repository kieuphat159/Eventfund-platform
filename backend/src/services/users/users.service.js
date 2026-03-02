import * as userRepo from '../../repositories/user.repo.js';
import {
  Ticket as DefaultTicket,
  Share as DefaultShare,
  RewardClaim as DefaultRewardClaim
} from '../../models/index.js';

/**
 * Get user profile by wallet address
 * @param {string} walletAddress - Wallet address
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getProfile(walletAddress, repos = {}) {
  const repository = repos.userRepo || userRepo;

  return await repository.findByWalletAddress(walletAddress);
}

/**
 * Update user profile
 * @param {string} walletAddress - Wallet address
 * @param {Object} updates - Profile updates
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated user
 */
export async function updateProfile(walletAddress, updates, repos = {}) {
  const repository = repos.userRepo || userRepo;

  const user = await repository.findByWalletAddress(walletAddress);

  if (!user) {
    throw new Error('User not found');
  }

  // Prevent changing wallet address
  if (updates.walletAddress) {
    delete updates.walletAddress;
  }

  // Prevent changing role (admin only)
  if (updates.role) {
    delete updates.role;
  }

  // Build update object with only allowed fields
  const allowedFields = ['username', 'email', 'avatarUrl'];
  const filteredUpdates = {};
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  return await repository.updateProfile(walletAddress, filteredUpdates);
}

/**
 * Get user portfolio (tickets, shares, rewards)
 * @param {string} walletAddress - Wallet address
 * @param {Object} models - Injected models (for testing)
 * @returns {Promise<Object>} User portfolio
 */
export async function getUserPortfolio(walletAddress, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;
  const Share = models.Share || DefaultShare;
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  const normalizedAddress = walletAddress.toLowerCase();

  // Get tickets
  const tickets = await Ticket.find({
    currentOwner: normalizedAddress
  }).populate('eventId');

  // Get shares
  const shares = await Share.find({
    holder: normalizedAddress
  }).populate('eventId');

  // Get rewards
  const rewards = await RewardClaim.find({
    claimer: normalizedAddress
  }).populate('eventId');

  return {
    tickets,
    shares,
    rewards
  };
}

/**
 * Get user shares across all events
 * @param {string} walletAddress - Wallet address
 * @param {Object} models - Injected models (for testing)
 * @returns {Promise<Array>} User shares
 */
export async function getUserShares(walletAddress, models = {}) {
  const Share = models.Share || DefaultShare;

  return await Share.find({
    holder: walletAddress.toLowerCase()
  }).populate('eventId');
}

/**
 * Get user rewards (claimed and pending)
 * @param {string} walletAddress - Wallet address
 * @param {Object} models - Injected models (for testing)
 * @returns {Promise<Object>} User rewards
 */
export async function getUserRewards(walletAddress, models = {}) {
  const RewardClaim = models.RewardClaim || DefaultRewardClaim;

  const rewards = await RewardClaim.find({
    claimer: walletAddress.toLowerCase()
  }).populate('eventId distributionId');

  const claimed = rewards.filter(r => r.status === 'confirmed');
  const pending = rewards.filter(r => r.status === 'pending');

  const totalClaimed = claimed.reduce(
    (sum, r) => sum + r.rewardAmount,
    0n
  );

  const totalPending = pending.reduce(
    (sum, r) => sum + r.rewardAmount,
    0n
  );

  return {
    claimed,
    pending,
    totalClaimed,
    totalPending
  };
}
