import * as ListingRepo from "../../repositories/listing.repo.js";
import * as TicketRepo from "../../repositories/ticket.repo.js";
import { ethers } from "ethers";
import { multiplyBigInt, divideBigInt, toBigInt } from "../../utils/bigint.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../utils/customErrors.js";
import { getMarketplace, provider } from "../blockchain/index.js";

function normalizeTxHash(txHash) {
  return txHash?.toLowerCase();
}

function validateTransactionHash(txHash) {
  if (!txHash || !ethers.isHexString(txHash, 32)) {
    throw new BadRequestError("Invalid transaction hash");
  }
}

async function parseMarketplaceEventsFromReceipt(receipt) {
  const marketplace = getMarketplace();
  const marketplaceAddress = (await marketplace.getAddress()).toLowerCase();
  const parsedEvents = [];

  for (const log of receipt.logs || []) {
    if (!log?.address || log.address.toLowerCase() !== marketplaceAddress) {
      continue;
    }

    try {
      const parsed = marketplace.interface.parseLog(log);
      parsedEvents.push(parsed);
    } catch {
      // Ignore decode errors from non-marketplace logs.
    }
  }

  return parsedEvents;
}

/**
 * Build create-listing intent for wallet signing
 * @param {Object} payload - Listing payload
 * @param {string} sellerWallet - Seller wallet
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Encoded on-chain tx payload
 */
export async function createListingIntent(
  payload,
  sellerWallet,
  repositories = {},
) {
  const ticketRepo = repositories.ticket || TicketRepo;

  const { ticketId, price } = payload;
  const ticket = await ticketRepo.findById(
    ticketId,
    { lean: true },
    repositories.models,
  );
  if (!ticket) throw new NotFoundError("Ticket not found");

  if (ticket.currentOwner.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new ForbiddenError("Not authorized to list this ticket");
  }

  if (ticket.status !== "sold") {
    throw new BadRequestError("Ticket must be in sold status to be listed");
  }

  if (ticket.isListed) {
    throw new BadRequestError("Ticket is already listed");
  }

  const maxPrice = divideBigInt(
    multiplyBigInt(ticket.originalPrice, "15"),
    "10",
  );
  if (toBigInt(price) > toBigInt(maxPrice)) {
    throw new BadRequestError(`Price exceeds maximum allowed (${maxPrice})`);
  }

  const marketplace = getMarketplace();
  const [to, network] = await Promise.all([
    marketplace.getAddress(),
    provider.getNetwork(),
  ]);

  const data = marketplace.interface.encodeFunctionData("createListing", [
    BigInt(ticket.tokenId),
    BigInt(price),
  ]);

  return {
    ticketId: String(ticket._id),
    tokenId: String(ticket.tokenId),
    seller: sellerWallet.toLowerCase(),
    transaction: {
      to,
      data,
      value: "0",
      chainId: network.chainId.toString(),
      functionName: "createListing",
    },
  };
}

/**
 * Build buy-listing intent for wallet signing
 * @param {string} listingId - Database listing id
 * @param {string} buyerWallet - Buyer wallet
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Encoded on-chain tx payload
 */
export async function createBuyListingIntent(
  listingId,
  buyerWallet,
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;

  const listing = await listingRepo.findById(
    listingId,
    { lean: true },
    repositories.models,
  );
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.status !== "active")
    throw new BadRequestError("Listing is not active");

  if (listing.seller.toLowerCase() === buyerWallet.toLowerCase()) {
    throw new BadRequestError("Seller cannot buy own listing");
  }

  const marketplace = getMarketplace();

  const [contractListingId, to, network] = await Promise.all([
    marketplace.getActiveListingByTokenId(BigInt(listing.tokenId)),
    marketplace.getAddress(),
    provider.getNetwork(),
  ]);

  if (contractListingId === 0n) {
    throw new BadRequestError(
      "No active on-chain listing found for this ticket",
    );
  }

  const data = marketplace.interface.encodeFunctionData("buyListing", [
    contractListingId,
  ]);

  return {
    listingId: String(listing._id),
    contractListingId: contractListingId.toString(),
    tokenId: String(listing.tokenId),
    buyer: buyerWallet.toLowerCase(),
    transaction: {
      to,
      data,
      value: String(listing.price),
      chainId: network.chainId.toString(),
      functionName: "buyListing",
    },
  };
}

/**
 * Build cancel-listing intent for wallet signing
 * @param {string} listingId - Database listing id
 * @param {string} sellerWallet - Seller wallet
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Encoded on-chain tx payload
 */
export async function createCancelListingIntent(
  listingId,
  sellerWallet,
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;

  const listing = await listingRepo.findById(
    listingId,
    { lean: true },
    repositories.models,
  );
  if (!listing) throw new NotFoundError("Listing not found");

  if (listing.seller.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new ForbiddenError("Not authorized to cancel this listing");
  }

  if (listing.status !== "active") {
    throw new BadRequestError("Listing is not active");
  }

  const marketplace = getMarketplace();

  const [contractListingId, to, network] = await Promise.all([
    marketplace.getActiveListingByTokenId(BigInt(listing.tokenId)),
    marketplace.getAddress(),
    provider.getNetwork(),
  ]);

  if (contractListingId === 0n) {
    throw new BadRequestError(
      "No active on-chain listing found for this ticket",
    );
  }

  const data = marketplace.interface.encodeFunctionData("cancelListing", [
    contractListingId,
  ]);

  return {
    listingId: String(listing._id),
    contractListingId: contractListingId.toString(),
    tokenId: String(listing.tokenId),
    seller: sellerWallet.toLowerCase(),
    transaction: {
      to,
      data,
      value: "0",
      chainId: network.chainId.toString(),
      functionName: "cancelListing",
    },
  };
}

/**
 * Confirm a sold listing transaction and sync DB state
 * @param {Object} payload - Confirmation payload
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Synced listing and ticket
 */
export async function confirmListingSoldTransaction(
  payload,
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;
  const ticketRepo = repositories.ticket || TicketRepo;

  const { txHash, listingId, buyerWallet } = payload;

  validateTransactionHash(txHash);

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError("Transaction not mined yet");
  }
  if (Number(receipt.status) !== 1) {
    throw new BadRequestError("Transaction failed on-chain");
  }

  const parsedEvents = await parseMarketplaceEventsFromReceipt(receipt);
  const soldEvents = parsedEvents.filter(
    (event) => event?.name === "ListingSold",
  );
  const soldEvent = soldEvents[0];

  if (!soldEvent) {
    throw new BadRequestError(
      "ListingSold event not found in transaction receipt",
    );
  }

  const tokenId = String(soldEvent.args?.tokenId ?? "");
  const buyer = String(soldEvent.args?.buyer ?? "").toLowerCase();

  if (buyerWallet && buyer !== buyerWallet.toLowerCase()) {
    throw new BadRequestError("Buyer wallet does not match on-chain event");
  }

  const listing = listingId
    ? await listingRepo.findById(listingId, { lean: true }, repositories.models)
    : await listingRepo
        .findListings(
          { tokenId, status: "active" },
          { page: 1, limit: 1, sort: "-listedAt", lean: true },
          repositories.models,
        )
        .then((result) => result?.docs?.[0] || null);

  if (!listing) {
    throw new NotFoundError("Listing not found in database");
  }

  if (listing.status === "sold") {
    return {
      synced: false,
      alreadySynced: true,
      txHash: normalizeTxHash(txHash),
      listing,
    };
  }

  const block = receipt.blockNumber
    ? await provider.getBlock(receipt.blockNumber)
    : null;
  const soldAt = block ? new Date(Number(block.timestamp) * 1000) : new Date();

  const updatedListing = await listingRepo.updateStatus(
    listing._id,
    "sold",
    {
      soldTo: buyer,
      soldAt,
      soldTxHash: normalizeTxHash(txHash),
    },
    repositories.models,
  );

  const updatedTicket = await ticketRepo.updateStatus(
    tokenId,
    "sold",
    {
      currentOwner: buyer,
      soldAt,
      isListed: false,
    },
    repositories.models,
  );

  return {
    synced: true,
    alreadySynced: false,
    txHash: normalizeTxHash(txHash),
    listing: updatedListing,
    ticket: updatedTicket,
  };
}

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
    ...(status ? { status } : { status: "active" }),
    ...((minPrice || maxPrice) && {
      price: {
        ...(minPrice && { $gte: minPrice }),
        ...(maxPrice && { $lte: maxPrice }),
      },
    }),
  };

  const options = {
    page: page || 1,
    limit: Math.min(limit || 20, 100),
    sort: sort || "-listedAt",
    lean: true,
    populate: "ticketId eventId",
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
    { populate: ["ticketId", "eventId"], lean: false },
    repositories.models,
  );

  if (!listing) throw new NotFoundError("Listing not found");

  return listing;
}

/**
 * Create a new listing
 * @param {Object} listingData - Listing data
 * @param {string} sellerWallet - Seller wallet address
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Created listing
 */
export async function createListing(
  listingData,
  sellerWallet,
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;
  const ticketRepo = repositories.ticket || TicketRepo;

  const { ticketId, price, expiresAt } = listingData;

  const ticket = await ticketRepo.findById(
    ticketId,
    { lean: false },
    repositories.models,
  );
  if (!ticket) throw new NotFoundError("Ticket not found");

  if (ticket.currentOwner.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new ForbiddenError("Not authorized to list this ticket");
  }

  if (ticket.status !== "sold") {
    throw new BadRequestError("Ticket must be in sold status to be listed");
  }

  if (ticket.isListed) {
    throw new BadRequestError("Ticket is already listed");
  }

  const maxPrice = divideBigInt(
    multiplyBigInt(ticket.originalPrice, "15"),
    "10",
  );

  if (toBigInt(price) > toBigInt(maxPrice)) {
    throw new BadRequestError(`Price exceeds maximum allowed (${maxPrice})`);
  }

  const listing = await listingRepo.createListing(
    {
      ticketId: ticket._id,
      tokenId: ticket.tokenId,
      eventId: ticket.eventId,
      seller: sellerWallet.toLowerCase(),
      price,
      maxPrice,
      status: "active",
      listedAt: new Date(),
      expiresAt: new Date(expiresAt),
    },
    repositories.models,
  );

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
export async function cancelListing(
  listingId,
  sellerWallet,
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;
  const ticketRepo = repositories.ticket || TicketRepo;

  const listing = await listingRepo.findById(
    listingId,
    { lean: false },
    repositories.models,
  );
  if (!listing) throw new NotFoundError("Listing not found");

  if (listing.seller.toLowerCase() !== sellerWallet.toLowerCase()) {
    throw new ForbiddenError("Not authorized to cancel this listing");
  }

  if (listing.status !== "active") {
    throw new BadRequestError("Listing is not active");
  }

  const updatedListing = await listingRepo.updateStatus(
    listingId,
    "cancelled",
    {},
    repositories.models,
  );

  await ticketRepo.updateListingStatus(
    listing.ticketId,
    false,
    repositories.models,
  );

  return updatedListing;
}

/**
 * Update listing status
 * @param {string} listingId - Listing ID
 * @param {string} status - New status
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated listing
 */
export async function updateListingStatus(
  listingId,
  status,
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;

  const listing = await listingRepo.findById(
    listingId,
    { lean: false },
    repositories.models,
  );
  if (!listing) throw new NotFoundError("Listing not found");

  return await listingRepo.updateStatus(
    listingId,
    status,
    {},
    repositories.models,
  );
}

/**
 * Get marketplace transaction history in Event | Tier | Price | Buyer | Seller | Time shape
 * @param {Object} query - Query filters and pagination
 * @param {Object} repositories - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated transaction history
 */
export async function getMarketplaceTransactionHistory(
  query = {},
  repositories = {},
) {
  const listingRepo = repositories.listing || ListingRepo;

  const {
    eventId,
    seller,
    buyer,
    page = 1,
    limit = 20,
    sort = "soldAt",
    order = "desc",
  } = query;

  const dbQuery = {
    status: "sold",
    ...(eventId && { eventId }),
    ...(seller && { seller: String(seller).toLowerCase() }),
    ...(buyer && { soldTo: String(buyer).toLowerCase() }),
  };

  const safeSortField = ["soldAt", "price", "listedAt"].includes(sort)
    ? sort
    : "soldAt";
  const safeOrder = order === "asc" ? "" : "-";

  const result = await listingRepo.findListings(
    dbQuery,
    {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      sort: `${safeOrder}${safeSortField}`,
      lean: true,
      populate: [
        { path: "eventId", select: "title" },
        { path: "ticketId", select: "ticketType tokenId" },
      ],
    },
    repositories.models,
  );

  const docs = (result.docs || []).map((listing) => ({
    listingId: String(listing._id),
    eventId: listing.eventId?._id
      ? String(listing.eventId._id)
      : String(listing.eventId || ""),
    event: listing.eventId?.title || null,
    tier: listing.ticketId?.ticketType || null,
    price: String(listing.price || "0"),
    buyer: listing.soldTo || null,
    seller: listing.seller || null,
    time: listing.soldAt || null,
    tokenId: listing.ticketId?.tokenId || String(listing.tokenId || ""),
  }));

  return {
    ...result,
    docs,
  };
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
    averagePrice:
      stats.active > 0 && stats.totalVolume
        ? divideBigInt(stats.totalVolume, String(stats.active))
        : "0",
  };
}
