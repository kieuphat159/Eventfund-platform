import * as ListingRepo from '../repositories/listing.repo.js';
import * as TicketRepo from '../repositories/ticket.repo.js';

/**
 * Get marketplace listings with filters and pagination
 * @param {Object} filters - Query filters
 * @param {Object} pagination - Pagination options
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated listings
 */
export async function getListings(filters = {}, pagination = {}, repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;
  const query = {};

  // Apply filters
  if (filters.eventId) {
    query.eventId = filters.eventId;
  }
  if (filters.status) {
    query.status = filters.status;
  } else {
    // Default to active listings only
    query.status = 'active';
  }

  // Price range filter
  if (filters.minPrice || filters.maxPrice) {
    query.price = {};
    if (filters.minPrice) {
      query.price.$gte = filters.minPrice;
    }
    if (filters.maxPrice) {
      query.price.$lte = filters.maxPrice;
    }
  }

  // Pagination options
  const options = {
    page: pagination.page || 1,
    limit: Math.min(pagination.limit || 20, 100),
    sort: pagination.sort || '-listedAt',
    lean: true,
    populate: 'ticketId eventId'
  };

  return await listingRepo.findListings(query, options, repositories.models);
}

/**
 * Get listing by ID
 * @param {string} listingId - Listing ID
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object|null>} Listing or null
 */
export async function getListingById(listingId, repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;
  const listing = await listingRepo.findById(
    listingId,
    { populate: ['ticketId', 'eventId'], lean: false },
    repositories.models
  );

  if (!listing) {
    return null;
  }

  // Convert to JSON to handle BigInt serialization
  const listingJson = typeof listing.toJSON === 'function' ? listing.toJSON() : listing;

  // Also convert populated ticket's BigInt fields
  if (listingJson.ticketId && typeof listingJson.ticketId === 'object') {
    if (listingJson.ticketId.originalPrice) {
      listingJson.ticketId.originalPrice = listingJson.ticketId.originalPrice.toString();
    }
    if (listingJson.ticketId.transferHistory) {
      listingJson.ticketId.transferHistory = listingJson.ticketId.transferHistory.map(transfer => {
        if (transfer.price) {
          transfer.price = transfer.price.toString();
        }
        return transfer;
      });
    }
  }

  // Convert populated event's BigInt fields
  if (listingJson.eventId && typeof listingJson.eventId === 'object') {
    const bigIntFields = ['organizerStake', 'minStakeRequired', 'fundingGoal', 'currentFunding', 'totalRevenue'];
    bigIntFields.forEach(field => {
      if (listingJson.eventId[field] !== undefined && listingJson.eventId[field] !== null) {
        listingJson.eventId[field] = listingJson.eventId[field].toString();
      }
    });
  }

  return listingJson;
}

/**
 * Create a new listing
 * @param {Object} listingData - Listing data
 * @param {string} sellerWallet - Seller wallet address
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Created listing
 */
export async function createListing(listingData, sellerWallet, repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;
  const ticketRepo = repositories.ticket || TicketRepo;

  // Get ticket using repository - find by _id
  const ticket = await ticketRepo.findById(listingData.ticketId, { lean: false }, repositories.models);

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Validate ownership
  if (ticket.currentOwner.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new Error('Not authorized to list this ticket');
  }

  // Validate ticket status
  if (ticket.status !== 'sold') {
    throw new Error('Ticket must be in sold status to be listed');
  }

  // Check if already listed
  if (ticket.isListed) {
    throw new Error('Ticket is already listed');
  }

  // Calculate max price (1.5x original price - anti-speculation)
  const maxPrice = (ticket.originalPrice * 15n) / 10n;

  // Validate price cap
  if (listingData.price > maxPrice) {
    throw new Error(`Price exceeds maximum allowed (${maxPrice.toString()})`);
  }

  // Create listing using repository
  const listing = await listingRepo.createListing({
    ticketId: ticket._id,
    tokenId: ticket.tokenId,
    eventId: ticket.eventId,
    seller: sellerWallet.toLowerCase(),
    price: listingData.price,
    maxPrice,
    status: 'active',
    listedAt: new Date(),
    expiresAt: listingData.expiresAt
  }, repositories.models);

  // Update ticket using repository
  await ticketRepo.updateListingStatus(ticket._id, true, repositories.models);

  return listing;
}

/**
 * Cancel a listing
 * @param {string} listingId - Listing ID
 * @param {string} sellerWallet - Seller wallet address
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated listing
 */
export async function cancelListing(listingId, sellerWallet, repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;
  const ticketRepo = repositories.ticket || TicketRepo;

  const listing = await listingRepo.findById(listingId, { lean: false }, repositories.models);

  if (!listing) {
    throw new Error('Listing not found');
  }

  // Validate seller
  if (listing.seller.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new Error('Not authorized to cancel this listing');
  }

  // Validate status
  if (listing.status !== 'active') {
    throw new Error('Listing is not active');
  }

  // Update listing using repository
  const updatedListing = await listingRepo.updateStatus(
    listingId,
    'cancelled',
    {},
    repositories.models
  );

  // Update ticket using repository
  await ticketRepo.updateListingStatus(listing.ticketId, false, repositories.models);

  return updatedListing;
}

/**
 * Update listing status
 * @param {string} listingId - Listing ID
 * @param {string} status - New status
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated listing
 */
export async function updateListingStatus(listingId, status, repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;

  const listing = await listingRepo.findById(listingId, { lean: false }, repositories.models);

  if (!listing) {
    throw new Error('Listing not found');
  }

  return await listingRepo.updateStatus(listingId, status, {}, repositories.models);
}

/**
 * Get marketplace statistics
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Marketplace stats
 */
export async function getMarketplaceStats(repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;

  const stats = await listingRepo.getMarketplaceStats(repositories.models);

  // Transform repository stats to match expected format
  return {
    totalListings: stats.total || 0,
    activeListings: stats.active || 0,
    soldListings: stats.sold || 0,
    cancelledListings: stats.cancelled || 0,
    totalVolume: stats.totalVolume || 0n,
    averagePrice: stats.active > 0 && stats.totalVolume
      ? stats.totalVolume / BigInt(stats.active)
      : 0n
  };
}
