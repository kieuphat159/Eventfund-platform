import * as ListingRepo from '../../repositories/listing.repo.js';
import * as TicketRepo from '../../repositories/ticket.repo.js';
import { multiplyBigInt, divideBigInt, toBigInt } from '../../utils/bigint.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/customErrors.js';

/**
 * Get marketplace listings with filters and pagination
 * @param {Object} query - Query parameters from request
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated listings
 */
export async function getListings(query = {}, repositories = {}) {
  const listingRepo = repositories.listing || ListingRepo;

  const { eventId, status, minPrice, maxPrice, page, limit, sort } = query;

  const dbQuery = {
    ...(eventId && { eventId }),
    ...(status ? { status } : { status: 'active' }),
    ...(minPrice || maxPrice) && {
      price: {
        ...(minPrice && { $gte: minPrice }),
        ...(maxPrice && { $lte: maxPrice })
      }
    }
  };

  const options = {
    page: page || 1,
    limit: Math.min(limit || 20, 100),
    sort: sort || '-listedAt',
    lean: true,
    populate: 'ticketId eventId'
  };

  return await listingRepo.findListings(dbQuery, options, repositories.models);
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

  if (!listing) throw new NotFoundError('Listing not found');

  return listing;
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

  const { ticketId, price, expiresAt } = listingData;

  const ticket = await ticketRepo.findById(ticketId, { lean: false }, repositories.models);
  if (!ticket) throw new NotFoundError('Ticket not found');

  if (ticket.currentOwner.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new ForbiddenError('Not authorized to list this ticket');
  }

  if (ticket.status !== 'sold') {
    throw new BadRequestError('Ticket must be in sold status to be listed');
  }

  if (ticket.isListed) {
    throw new BadRequestError('Ticket is already listed');
  }

  const maxPrice = divideBigInt(multiplyBigInt(ticket.originalPrice, "15"), "10");

  if (toBigInt(price) > toBigInt(maxPrice)) {
    throw new BadRequestError(`Price exceeds maximum allowed (${maxPrice})`);
  }

  const listing = await listingRepo.createListing({
    ticketId: ticket._id,
    tokenId: ticket.tokenId,
    eventId: ticket.eventId,
    seller: sellerWallet.toLowerCase(),
    price,
    maxPrice,
    status: 'active',
    listedAt: new Date(),
    expiresAt: new Date(expiresAt)
  }, repositories.models);

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
  if (!listing) throw new NotFoundError('Listing not found');

  if (listing.seller.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new ForbiddenError('Not authorized to cancel this listing');
  }

  if (listing.status !== 'active') {
    throw new BadRequestError('Listing is not active');
  }

  const updatedListing = await listingRepo.updateStatus(
    listingId,
    'cancelled',
    {},
    repositories.models
  );

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
  if (!listing) throw new NotFoundError('Listing not found');

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
    totalVolume: stats.totalVolume || "0",
    averagePrice: stats.active > 0 && stats.totalVolume
      ? divideBigInt(stats.totalVolume, String(stats.active))
      : "0"
  };
}
