import * as userRepo from '../../repositories/user.repo.js';
import * as eventRepo from '../../repositories/event.repo.js';
import * as ticketRepo from '../../repositories/ticket.repo.js';
import * as listingRepo from '../../repositories/listing.repo.js';
import mongoose from 'mongoose';
import { ethers } from 'ethers';
import UploadService from '../upload/upload.service.js';
import { NotFoundError, BadRequestError } from '../../utils/customErrors.js';
import { getFund, provider } from '../blockchain/index.js';
import { persistLogsFromReceipt } from '../blockchain/core/receiptChainLog.js';

// Default upload service instance (lazy initialization for future use)
let defaultUploadService = null;
function getDefaultUploadService() {
  if (!defaultUploadService) {
    defaultUploadService = new UploadService();
  }
  return defaultUploadService;
}

function getBackendSigner() {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new BadRequestError('Missing BACKEND_SIGNER_PRIVATE_KEY for on-chain execution');
  }

  return new ethers.Wallet(privateKey, provider);
}

function mapFundStatusToAppStatus(statusCode) {
  const map = {
    0: 'draft',
    1: 'funding',
    2: 'funded',
    3: 'ticketing',
    4: 'completed',
    5: 'cancelled'
  };

  return map[Number(statusCode)] || 'failed';
}

async function parseFundEventsFromReceipt(receipt) {
  const fund = getFund();
  const fundAddress = (await fund.getAddress()).toLowerCase();
  const parsedEvents = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== fundAddress) continue;

    try {
      const parsed = fund.interface.parseLog(log);
      parsedEvents.push(parsed);
    } catch {
      // Ignore unrelated logs.
    }
  }

  return parsedEvents;
}

/**
 * Get platform-wide statistics
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Platform stats
 */
export async function getPlatformStats(repos = {}) {
  const userRepository = repos.userRepo || userRepo;
  const eventRepository = repos.eventRepo || eventRepo;
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const listingRepository = repos.listingRepo || listingRepo;

  // Nhóm các Promise theo domain
  const userStatsPromise = Promise.all([
    userRepository.countUsers(),
    userRepository.countUsers({ role: 'organizer' }),
    userRepository.countUsers({ role: 'verifier' }),
    userRepository.countUsers({ role: 'admin' })
  ]);

  const eventStatsPromise = Promise.all([
    eventRepository.countEvents(),
    eventRepository.countEvents({ status: 'draft' }),
    eventRepository.countEvents({ status: 'funding' }),
    eventRepository.countEvents({ status: 'ongoing' }),
    eventRepository.countEvents({ status: 'completed' }),
    eventRepository.countEvents({ status: 'cancelled' })
  ]);

  // Chạy các nhóm song song
  const [userResults, eventResults, ticketStats, listingStats, revenueStats] = await Promise.all([
    userStatsPromise,
    eventStatsPromise,
    ticketRepository.getTicketStats(),
    listingRepository.getListingStats(),
    eventRepository.getRevenueStats()
  ]);

  // Destructuring
  const [totalUsers, organizers, verifiers, admins] = userResults;
  const [totalEvents, draftEvents, fundingEvents, activeEvents, completedEvents, cancelledEvents] = eventResults;

  return {
    users: {
      total: totalUsers,
      organizers,
      verifiers,
      admins
    },
    events: {
      total: totalEvents,
      draft: draftEvents,
      funding: fundingEvents,
      active: activeEvents,
      completed: completedEvents,
      cancelled: cancelledEvents
    },
    tickets: ticketStats,
    listings: listingStats,
    revenue: {
      total: revenueStats.totalRevenue,
      funding: revenueStats.totalFunding
    }
  };
}

/**
 * Get all users with filters
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated users
 */
export async function getUsers(query = {}, repos = {}) {
  const userRepository = repos.userRepo || userRepo;

  // Destructure with defaults
  const { role, isActive, page = 1, limit = 20, sort = '-createdAt' } = query;

  // Build query using short-circuit evaluation
  const dbQuery = {
    ...(role && { role }),
    ...(isActive !== undefined && { isActive: isActive === 'true' })
  };

  // Setup pagination options
  const options = {
    page: parseInt(page, 10),
    limit: Math.min(parseInt(limit, 10), 100),
    sort,
    lean: true
  };

  return await userRepository.findUsers(dbQuery, options);
}

/**
 * Update user role
 * @param {string} walletAddress - Wallet address
 * @param {string} newRole - New role
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated user
 */
export async function updateUserRole(walletAddress, newRole, repos = {}) {
  const userRepository = repos.userRepo || userRepo;

  const user = await userRepository.findByWalletAddress(walletAddress);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return await userRepository.updateRole(walletAddress, newRole);
}

/**
 * Get all events (admin view)
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated events
 */
export async function getEvents(query = {}, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;

  // Destructure with defaults
  const { status, organizer, page = 1, limit = 20, sort = '-createdAt' } = query;

  // Build query using short-circuit evaluation
  const dbQuery = {
    ...(status && { status }),
    ...(organizer && { organizer: organizer.toLowerCase() })
  };

  // Setup pagination options
  const options = {
    page: parseInt(page, 10),
    limit: Math.min(parseInt(limit, 10), 100),
    sort,
    lean: true
  };

  return await eventRepository.findEvents(dbQuery, options);
}

/**
 * Force update event status
 * @param {string} eventId - Event ID
 * @param {string} newStatus - New status
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEventStatus(eventId, newStatus, options = {}, repos = {}) {
  // Backward compatibility: old signature was (eventId, newStatus, repos)
  if (
    options &&
    typeof options === 'object' &&
    (options.eventRepo || options.userRepo || options.ticketRepo || options.listingRepo) &&
    Object.keys(repos || {}).length === 0
  ) {
    repos = options;
    options = {};
  }

  const eventRepository = repos.eventRepo || eventRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.status === 'completed') {
    throw new BadRequestError('Cannot change status of a completed event');
  }

  if (!event.contractEventId) {
    throw new BadRequestError('Event does not have contractEventId for on-chain transition');
  }

  const signer = getBackendSigner();
  const fundWithSigner = getFund().connect(signer);
  const chainEventId = BigInt(event.contractEventId);

  let tx;
  let resolvedStatus = newStatus;

  if (newStatus === 'funded' || newStatus === 'cancelled') {
    tx = await fundWithSigner.finalizeFunding(chainEventId);
  } else if (newStatus === 'ticketing') {
    const ticketType = Number(options.ticketType ?? 0);
    const quantity = Number(options.quantity ?? 0);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestError('quantity is required and must be a positive integer for ticketing transition');
    }

    tx = await fundWithSigner.startTicketing(
      chainEventId,
      ticketType,
      BigInt(quantity)
    );
  } else if (newStatus === 'completed') {
    tx = await fundWithSigner.setCompletedIfThresholdMet(chainEventId);
  } else {
    throw new BadRequestError(
      `Status ${newStatus} has no direct on-chain transition in Fund contract`
    );
  }

  const receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new BadRequestError('On-chain status transition failed');
  }

  await persistLogsFromReceipt({
    receipt,
    contract: getFund(),
    contractName: 'Fund',
    contractAddress: await getFund().getAddress(),
  });

  if (newStatus === 'funded' || newStatus === 'cancelled') {
    const parsedEvents = await parseFundEventsFromReceipt(receipt);
    const finalized = parsedEvents.find((evt) => evt?.name === 'FundingFinalized');
    if (!finalized) {
      throw new BadRequestError('FundingFinalized event not found in transaction receipt');
    }
    resolvedStatus = mapFundStatusToAppStatus(finalized.args?.statusAfterFinalize);
  }

  return await eventRepository.updateById(eventId, { status: resolvedStatus });
}

/**
 * Get system health status
 * @param {Object} options - Options (for testing)
 * @returns {Promise<Object>} System health
 */
export async function getSystemHealth(options = {}) {
  const connection = options.connection || mongoose.connection;

  // Check database connection
  const dbState = connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    database: {
      status: dbStatus[dbState] || 'unknown',
      connected: dbState === 1
    },
    services: {
      api: 'operational'
    },
    timestamp: new Date()
  };
}

/**
 * Delete user by wallet address
 * Cascades to delete user's avatar from Cloudinary
 * @param {string} walletAddress - Wallet address
 * @param {Object} repos - Injected repositories (for testing)
 * @param {Object} uploadSvc - Injected upload service (for testing)
 * @returns {Promise<Object>} Deleted user
 */
export async function deleteUser(walletAddress, repos = {}, uploadSvc = null) {
  const userRepository = repos.userRepo || userRepo;
  const uploadServiceInstance = uploadSvc || getDefaultUploadService();

  const user = await userRepository.findByWalletAddress(walletAddress);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Delete avatar from Cloudinary if exists
  if (user.avatarUrl) {
    try {
      await uploadServiceInstance.deleteImage(user.avatarUrl);
    } catch (error) {
      // Log but don't fail if avatar deletion fails
      console.warn('Failed to delete user avatar from Cloudinary', {
        walletAddress,
        avatarUrl: user.avatarUrl,
        error: error.message
      });
    }
  }

  const deletedUser = await userRepository.deleteByWalletAddress(walletAddress);

  return deletedUser;
}
