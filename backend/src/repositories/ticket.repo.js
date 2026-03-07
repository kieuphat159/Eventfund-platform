import mongoose from 'mongoose';
import { Ticket as DefaultTicket } from '../models/index.js';

/**
 * Helper function to apply query options (populate, lean)
 * @param {Object} query - Mongoose query
 * @param {Object} options - Query options
 * @returns {Object} Modified query
 */
function applyQueryOptions(query, options) {
  // Handle population - Mongoose accepts array directly
  if (options.populate) {
    query = query.populate(options.populate);
  }

  // Handle lean query
  if (options.lean !== false) {
    query = query.lean();
  }

  return query;
}

/**
 * Find ticket by token ID
 * @param {string} tokenId - Token ID
 * @param {Object} options - Query options (populate, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Ticket as plain object or null
 */
export async function findByTokenId(tokenId, options = {}, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  let query = Ticket.findOne({ tokenId });
  query = applyQueryOptions(query, options);

  const ticket = await query;

  // If not using lean, convert to plain object
  if (ticket && !options.lean && options.lean !== false) {
    return ticket;
  }

  return ticket && typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;
}

/**
 * Find ticket by ID
 * @param {string} ticketId - Ticket ID
 * @param {Object} options - Query options (populate, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Ticket as plain object or null
 */
export async function findById(ticketId, options = {}, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  let query = Ticket.findById(ticketId);
  query = applyQueryOptions(query, options);

  const ticket = await query;

  // If not using lean, convert to plain object
  if (ticket && !options.lean && options.lean !== false) {
    return ticket;
  }

  return ticket && typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;
}

/**
 * Find tickets with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findTickets(query, options, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

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

  return await Ticket.paginate(query, paginationOptions);
}

/**
 * Find tickets by current owner
 * @param {string} ownerAddress - Owner wallet address
 * @param {Object} options - Query options (page, limit, sort, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findByOwner(ownerAddress, options = {}, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  // Normalize wallet address to lowercase
  const normalizedAddress = ownerAddress.toLowerCase();

  const query = { currentOwner: normalizedAddress };

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

  return await Ticket.paginate(query, paginationOptions);
}

/**
 * Update ticket status
 * @param {string} tokenId - Token ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional fields to update
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated ticket as plain object or null
 */
export async function updateStatus(tokenId, status, additionalData = {}, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  const updates = {
    status,
    ...additionalData,
  };

  const ticket = await Ticket.findOneAndUpdate(
    { tokenId },
    updates,
    { new: true, runValidators: true }
  );

  return ticket ? ticket.toObject() : null;
}

/**
 * Mark ticket as used
 * @param {string} tokenId - Token ID
 * @param {Object} usageData - Usage data (usedAt, verifiedBy, usedTxHash)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated ticket as plain object or null
 */
export async function markAsUsed(tokenId, usageData, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  const updates = {
    status: 'used',
    usedAt: usageData.usedAt || new Date(),
    ...usageData,
  };

  const ticket = await Ticket.findOneAndUpdate(
    { tokenId },
    updates,
    { new: true, runValidators: true }
  );

  return ticket ? ticket.toObject() : null;
}

/**
 * Update ticket listing status
 * @param {string} ticketId - Ticket ID
 * @param {boolean} isListed - Listing status
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated ticket as plain object or null
 */
export async function updateListingStatus(ticketId, isListed, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { isListed },
    { new: true, runValidators: true }
  );

  return ticket ? ticket.toObject() : null;
}

/**
 * Aggregate ticket statistics by event ID
 * @param {string} eventId - Event ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Ticket statistics
 */
export async function getTicketStatsByEvent(eventId, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  // Cast eventId to ObjectId for aggregation
  const objectId = new mongoose.Types.ObjectId(eventId);

  const stats = await Ticket.aggregate([
    {
      $match: { eventId: objectId }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Transform aggregation results into a more usable format
  const result = {
    total: 0,
    minted: 0,
    sold: 0,
    used: 0,
    expired: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
}

/**
 * Count tickets by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countTickets(query = {}, models = {}) {
  const Ticket = models.Ticket || DefaultTicket;
  return await Ticket.countDocuments(query);
}

/**
 * Get ticket statistics (total, sold, used)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Ticket stats with total, sold, used counts
 */
export async function getTicketStats(models = {}) {
  const Ticket = models.Ticket || DefaultTicket;

  const [total, sold, used] = await Promise.all([
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: 'sold' }),
    Ticket.countDocuments({ status: 'used' })
  ]);

  return {
    total,
    sold,
    used,
    available: total - sold
  };
}
