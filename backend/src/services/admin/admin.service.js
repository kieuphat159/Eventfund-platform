import * as userRepo from '../../repositories/user.repo.js';
import * as eventRepo from '../../repositories/event.repo.js';
import * as ticketRepo from '../../repositories/ticket.repo.js';
import * as listingRepo from '../../repositories/listing.repo.js';
import * as shareRepo from '../../repositories/share.repo.js';
import mongoose from 'mongoose';
import UploadService from '../upload/upload.service.js';
import { NotFoundError, BadRequestError } from '../../utils/customErrors.js';
import Contribution from '../../models/Contribution.model.js';
import { addBigInt, compareBigInt, toBigInt } from '../../utils/bigint.js';

// Default upload service instance (lazy initialization for future use)
let defaultUploadService = null;
function getDefaultUploadService() {
  if (!defaultUploadService) {
    defaultUploadService = new UploadService();
  }
  return defaultUploadService;
}

function calculateAverage(total, count) {
  if (!count) return '0';
  return (toBigInt(total) / BigInt(count)).toString();
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
 * Get a single event with admin-facing investment summary
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Event with lightweight admin summary
 */
export async function getEventById(eventId, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const investorCount = await shareRepository.countShares({ eventId });

  return {
    ...event,
    adminSummary: {
      investorCount,
    },
  };
}

/**
 * Update an event as admin
 * @param {string} eventId - Event ID
 * @param {Object} updates - Event update payload
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEvent(eventId, updates, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const allowedFields = [
    'title',
    'description',
    'category',
    'startDate',
    'endDate',
    'fundingGoal',
    'minStakeRequired',
    'fundingDeadline',
    'status',
    'venue',
    'imageUrls',
    'metadataUri',
    'totalTickets',
    'ticketTiers',
    'ticketUsageThreshold',
  ];

  const sanitizedUpdates = {};
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  });

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new BadRequestError('No valid event fields were provided');
  }

  return await eventRepository.updateById(eventId, sanitizedUpdates);
}

/**
 * Force update event status
 * @param {string} eventId - Event ID
 * @param {string} newStatus - New status
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEventStatus(eventId, newStatus, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.status === 'completed') {
    throw new BadRequestError('Cannot change status of a completed event');
  }

  return await eventRepository.updateById(eventId, { status: newStatus });
}

/**
 * Get investments for a single event
 * @param {string} eventId - Event ID
 * @param {Object} query - Pagination query
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated investments with summary
 */
export async function getEventInvestments(eventId, query = {}, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;
  const shareRepository = repos.shareRepo || shareRepo;

  const event = await eventRepository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const {
    page = 1,
    limit = 20,
    sort = '-contributionAmount',
  } = query;

  const investments = await shareRepository.findByEvent(
    eventId,
    {
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      sort,
      lean: true,
    },
  );

  const confirmedContributions = await Contribution.find({
    eventId,
    status: 'confirmed',
    type: 'donator_contribution',
  })
    .select('amount')
    .lean();

  const totalInvested = confirmedContributions.reduce(
    (sum, contribution) => addBigInt(sum, contribution.amount || '0'),
    '0',
  );

  const docs = Array.isArray(investments.docs) ? investments.docs : [];
  const largestInvestment = docs.reduce(
    (max, share) =>
      compareBigInt(share.contributionAmount || '0', max) > 0
        ? share.contributionAmount || '0'
        : max,
    '0',
  );

  return {
    ...investments,
    event: {
      _id: event._id,
      title: event.title,
      status: event.status,
      fundingGoal: event.fundingGoal,
      currentFunding: event.currentFunding,
    },
    summary: {
      totalInvestors: investments.totalDocs || docs.length,
      totalInvested,
      averageInvestment: calculateAverage(totalInvested, docs.length),
      largestInvestment,
      contributionCount: confirmedContributions.length,
    },
  };
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
