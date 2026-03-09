import mongoose from 'mongoose';
import * as ticketRepo from '../../repositories/ticket.repo.js';
import * as eventRepo from '../../repositories/event.repo.js';
import { NotFoundError, BadRequestError } from '../../utils/customErrors.js';

/**
 * Get tickets with filters and pagination
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Paginated tickets
 */
export async function getTickets(query = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const { eventId, status, owner, page, limit, sort } = query;

  const dbQuery = {
    ...(eventId && { eventId }),
    ...(status && { status }),
    ...(owner && { currentOwner: owner.toLowerCase() })
  };

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
    lean: true
  };

  return await ticketRepository.findTickets(dbQuery, options);
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
    throw new NotFoundError('Ticket not found');
  }

  return ticket;
}

/**
 * Get all tickets for a wallet address
 * @param {string} walletAddress - Wallet address
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Paginated tickets
 */
export async function getUserTickets(walletAddress, query = {}, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const { page, limit, sort } = query;

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
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
    throw new NotFoundError('Ticket not found');
  }

  // Check if already used (idempotent)
  if (ticket.status === 'used') {
    return ticket;
  }

  // Validate ticket status
  if (ticket.status !== 'sold') {
    throw new BadRequestError('Ticket must be in sold status to be marked as used');
  }

  // Get event and validate
  const event = await eventRepository.findById(ticket.eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Validate event status
  if (event.status !== 'ongoing') {
    throw new BadRequestError('Event must be in ongoing status');
  }

  // Validate current time is within event dates
  const now = new Date();
  if (now < event.startDate || now > event.endDate) {
    throw new BadRequestError('Current time must be within event dates');
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

  return updatedTicket;
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

/**
 * Verify ticket ownership and return ticket details
 * @param {string} tokenId - Token ID
 * @param {string} walletAddress - Wallet address to verify
 * @param {Object} repos - Injected repositories (optional)
 * @returns {Promise<Object>} Verification result with ticket details
 */
export async function verifyTicket(tokenId, walletAddress, repos = {}) {
  const ticketRepository = repos.ticketRepo || ticketRepo;

  const ticket = await ticketRepository.findByTokenId(tokenId, { lean: false });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const isOwner = ticket.currentOwner.toLowerCase() === walletAddress.toLowerCase();

  return {
    isOwner,
    ticket
  };
}
