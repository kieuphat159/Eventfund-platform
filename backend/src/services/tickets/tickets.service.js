import mongoose from 'mongoose';
import * as ticketRepo from '../../repositories/ticket.repo.js';
import * as eventRepo from '../../repositories/event.repo.js';

/**
 * Get tickets with filters and pagination
 * @param {Object} filters - Query filters
 * @param {Object} pagination - Pagination options
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Paginated tickets
 */
export async function getTickets(filters = {}, pagination = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const query = {};

  // Apply filters
  if (filters.eventId) {
    query.eventId = filters.eventId;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.currentOwner) {
    query.currentOwner = filters.currentOwner.toLowerCase();
  }

  // Pagination options
  const options = {
    page: pagination.page || 1,
    limit: Math.min(pagination.limit || 20, 100),
    sort: pagination.sort || '-createdAt',
    lean: true
  };

  return await ticketRepository.findTickets(query, options);
}

/**
 * Get ticket by token ID with transfer history
 * @param {string} tokenId - Token ID
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object|null>} Ticket or null
 */
export async function getTicketById(tokenId, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    return null;
  }

  // Convert to JSON to apply toJSON transformation (BigInt to string)
  return typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
}

/**
 * Get all tickets for a wallet address
 * @param {string} walletAddress - Wallet address
 * @param {Object} pagination - Pagination options
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Paginated tickets
 */
export async function getUserTickets(walletAddress, pagination = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const options = {
    page: pagination.page || 1,
    limit: Math.min(pagination.limit || 20, 100),
    sort: pagination.sort || '-createdAt',
    lean: true,
    populate: 'eventId'
  };

  return await ticketRepository.findByOwner(walletAddress, options);
}

/**
 * Verify ticket ownership
 * @param {string} tokenId - Token ID
 * @param {string} walletAddress - Wallet address to verify
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<boolean>} True if owner matches
 */
export async function verifyTicketOwnership(tokenId, walletAddress, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId);

  if (!ticket) {
    return false;
  }

  return ticket.currentOwner.toLowerCase() === walletAddress.toLowerCase();
}

/**
 * Mark ticket as used during event check-in
 * @param {string} tokenId - Token ID
 * @param {string} verifierWallet - Verifier wallet address
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Updated ticket
 */
export async function markTicketAsUsed(tokenId, verifierWallet, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;
  const eventRepository = repos.eventRepo || eventRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Check if already used (idempotent)
  if (ticket.status === 'used') {
    return typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
  }

  // Validate ticket status
  if (ticket.status !== 'sold') {
    throw new Error('Ticket must be in sold status to be marked as used');
  }

  // Get event and validate
  const event = await eventRepository.findById(ticket.eventId);

  if (!event) {
    throw new Error('Event not found');
  }

  // Validate event status
  if (event.status !== 'ongoing') {
    throw new Error('Event must be in ongoing status');
  }

  // Validate current time is within event dates
  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new Error('Current time must be within event dates');
  }

  // Update ticket using repository
  const usageData = {
    usedAt: now,
    verifiedBy: verifierWallet.toLowerCase()
  };

  const updatedTicket = await ticketRepository.markAsUsed(tokenId, usageData);

  // Update event counter using repository
  await eventRepository.incrementTicketCounters(ticket.eventId, {
    totalTicketsUsed: 1
  });

  // Return ticket with toJSON transformation
  return typeof updatedTicket.toJSON === 'function' ? updatedTicket.toJSON() : updatedTicket;
}

/**
 * Get ticket statistics for an event
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Ticket stats
 */
export async function getTicketStats(eventId, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  // Convert eventId to ObjectId for aggregation
  const eventObjectId = new mongoose.Types.ObjectId(eventId);

  const stats = await ticketRepository.getTicketStatsByEvent(eventObjectId);

  // Transform repository stats to match expected format
  return {
    totalTickets: stats.total || 0,
    soldTickets: stats.sold || 0,
    usedTickets: stats.used || 0,
    mintedTickets: stats.minted || 0,
    availableTickets: stats.minted || 0
  };
}
