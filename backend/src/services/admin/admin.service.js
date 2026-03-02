import * as userRepo from '../repositories/user.repo.js';
import * as eventRepo from '../repositories/event.repo.js';
import * as ticketRepo from '../repositories/ticket.repo.js';
import * as listingRepo from '../repositories/listing.repo.js';
import { Event as DefaultEvent } from '../models/index.js';
import mongoose from 'mongoose';

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

  // For aggregation, we need to use the Event model directly
  const Event = repos.Event || DefaultEvent;

  // User stats
  const totalUsers = await userRepository.countUsers();
  const organizers = await userRepository.countUsers({ role: 'organizer' });
  const verifiers = await userRepository.countUsers({ role: 'verifier' });
  const admins = await userRepository.countUsers({ role: 'admin' });

  // Event stats - using countDocuments through model for now
  // (repositories don't have a countEvents method)
  const totalEvents = await Event.countDocuments();
  const draftEvents = await Event.countDocuments({ status: 'draft' });
  const fundingEvents = await Event.countDocuments({ status: 'funding' });
  const activeEvents = await Event.countDocuments({ status: 'ongoing' });
  const completedEvents = await Event.countDocuments({ status: 'completed' });
  const cancelledEvents = await Event.countDocuments({ status: 'cancelled' });

  // Ticket stats - using countDocuments through model for now
  // (repositories don't have a countTickets method)
  const Ticket = repos.Ticket || (await import('../models/index.js')).Ticket;
  const totalTickets = await Ticket.countDocuments();
  const soldTickets = await Ticket.countDocuments({ status: 'sold' });
  const usedTickets = await Ticket.countDocuments({ status: 'used' });

  // Listing stats - using countDocuments through model for now
  // (repositories don't have a countListings method)
  const Listing = repos.Listing || (await import('../models/index.js')).Listing;
  const totalListings = await Listing.countDocuments();
  const activeListings = await Listing.countDocuments({ status: 'active' });
  const soldListings = await Listing.countDocuments({ status: 'sold' });

  // Revenue stats - using aggregation through model
  const revenueStats = await Event.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalRevenue' },
        totalFunding: { $sum: '$currentFunding' }
      }
    }
  ]);

  const revenue = revenueStats.length > 0 ? revenueStats[0] : {
    totalRevenue: 0n,
    totalFunding: 0n
  };

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
    tickets: {
      total: totalTickets,
      sold: soldTickets,
      used: usedTickets,
      available: totalTickets - soldTickets
    },
    listings: {
      total: totalListings,
      active: activeListings,
      sold: soldListings
    },
    revenue: {
      total: revenue.totalRevenue,
      funding: revenue.totalFunding
    }
  };
}

/**
 * Get all users with filters
 * @param {Object} filters - Query filters
 * @param {Object} pagination - Pagination options
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated users
 */
export async function getUsers(filters = {}, pagination = {}, repos = {}) {
  const userRepository = repos.userRepo || userRepo;

  const query = {};

  // Apply filters
  if (filters.role) {
    query.role = filters.role;
  }
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  // Pagination options
  const options = {
    page: pagination.page || 1,
    limit: Math.min(pagination.limit || 20, 100),
    sort: pagination.sort || '-createdAt',
    lean: true
  };

  return await userRepository.findUsers(query, options);
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

  // Validate role
  const validRoles = ['user', 'organizer', 'verifier', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new Error('Invalid role. Must be one of: ' + validRoles.join(', '));
  }

  const user = await userRepository.findByWalletAddress(walletAddress);

  if (!user) {
    throw new Error('User not found');
  }

  return await userRepository.updateRole(walletAddress, newRole);
}

/**
 * Get all events (admin view)
 * @param {Object} filters - Query filters
 * @param {Object} pagination - Pagination options
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated events
 */
export async function getEvents(filters = {}, pagination = {}, repos = {}) {
  const eventRepository = repos.eventRepo || eventRepo;

  const query = {};

  // Apply filters
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.organizer) {
    query.organizer = filters.organizer.toLowerCase();
  }

  // Pagination options
  const options = {
    page: pagination.page || 1,
    limit: Math.min(pagination.limit || 20, 100),
    sort: pagination.sort || '-createdAt',
    lean: true
  };

  return await eventRepository.findEvents(query, options);
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
    throw new Error('Event not found');
  }

  return await eventRepository.updateById(eventId, { status: newStatus });
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
