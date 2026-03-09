import { Listing as DefaultListing } from '../models/index.js';

/**
 * Create a new listing
 * @param {Object} listingData - Listing data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created listing as plain object
 */
export async function createListing(listingData, models = {}) {
  const Listing = models.Listing || DefaultListing;
  const listing = new Listing(listingData);
  await listing.save();
  return listing.toObject();
}

/**
 * Find listing by ID
 * @param {string} listingId - Listing ID
 * @param {Object} options - Query options (populate, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Listing as plain object or null
 */
export async function findById(listingId, options = {}, models = {}) {
  const Listing = models.Listing || DefaultListing;

  let query = Listing.findById(listingId);

  // Handle population
  if (options.populate) {
    if (Array.isArray(options.populate)) {
      options.populate.forEach(field => {
        query = query.populate(field);
      });
    } else {
      query = query.populate(options.populate);
    }
  }

  // Handle lean query
  if (options.lean !== false) {
    query = query.lean();
  }

  const listing = await query;

  // If not using lean, convert to plain object
  if (listing && !options.lean && options.lean !== false) {
    return listing;
  }

  return listing && typeof listing.toObject === 'function' ? listing.toObject() : listing;
}

/**
 * Find listings with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean, populate)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findListings(query, options, models = {}) {
  const Listing = models.Listing || DefaultListing;

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

  return await Listing.paginate(query, paginationOptions);
}

/**
 * Find listings by seller address
 * @param {string} sellerAddress - Seller wallet address
 * @param {Object} options - Query options (page, limit, sort)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results
 */
export async function findBySeller(sellerAddress, options = {}, models = {}) {
  const Listing = models.Listing || DefaultListing;

  // Normalize wallet address to lowercase
  const normalizedAddress = sellerAddress.toLowerCase();

  const query = { seller: normalizedAddress };

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

  return await Listing.paginate(query, paginationOptions);
}

/**
 * Update listing status
 * @param {string} listingId - Listing ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional fields to update
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated listing as plain object or null
 */
export async function updateStatus(listingId, status, additionalData = {}, models = {}) {
  const Listing = models.Listing || DefaultListing;

  const updates = {
    status,
    ...additionalData,
  };

  const listing = await Listing.findByIdAndUpdate(
    listingId,
    updates,
    { new: true, runValidators: true }
  );

  return listing ? listing.toObject() : null;
}

/**
 * Delete listing by ID
 * @param {string} listingId - Listing ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteById(listingId, models = {}) {
  const Listing = models.Listing || DefaultListing;
  const result = await Listing.findByIdAndDelete(listingId);
  return result !== null;
}

/**
 * Aggregate marketplace statistics
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Marketplace statistics
 */
export async function getMarketplaceStats(models = {}) {
  const Listing = models.Listing || DefaultListing;

  // Đếm số lượng theo status
  const stats = await Listing.aggregate([
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
    active: 0,
    sold: 0,
    cancelled: 0,
    expired: 0,
    totalVolume: "0" // String để lưu BigInt
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  // Tính totalVolume bằng BigInt để tránh overflow
  // Fetch tất cả listings đã sold và tính tổng bằng BigInt
  const soldListings = await Listing.find({ status: 'sold' }).select('price').lean();

  let totalVolumeBigInt = BigInt(0);
  soldListings.forEach(listing => {
    if (listing.price) {
      // Chuyển price sang BigInt (price có thể là string hoặc number)
      const priceBigInt = typeof listing.price === 'string'
        ? BigInt(listing.price)
        : BigInt(listing.price);
      totalVolumeBigInt += priceBigInt;
    }
  });

  // Lưu kết quả dưới dạng string
  result.totalVolume = totalVolumeBigInt.toString();

  return result;
}

/**
 * Count listings by query
 * @param {Object} query - Query filters
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<number>} Count
 */
export async function countListings(query = {}, models = {}) {
  const Listing = models.Listing || DefaultListing;
  return await Listing.countDocuments(query);
}

/**
 * Get listing statistics (total, active, sold)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Listing stats with total, active, sold counts
 */
export async function getListingStats(models = {}) {
  const Listing = models.Listing || DefaultListing;

  const [total, active, sold] = await Promise.all([
    Listing.countDocuments(),
    Listing.countDocuments({ status: 'active' }),
    Listing.countDocuments({ status: 'sold' })
  ]);

  return {
    total,
    active,
    sold
  };
}
