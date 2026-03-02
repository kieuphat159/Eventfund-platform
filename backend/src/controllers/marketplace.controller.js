import asyncHandler from '../utils/asyncHandler.js';
import * as marketplaceService from '../services/marketplace.service.js';
import { convertBigIntToString } from '../utils/bigint.js';

/**
 * MarketplaceController - Handles marketplace endpoints
 */
class MarketplaceController {
  constructor(service = marketplaceService) {
    this.marketplaceService = service;
  }

  getListings = asyncHandler(async (req, res) => {
    const filters = {};
    const pagination = {};

    // Get query data (validated or raw)
    const query = req.validated?.query || req.query;

    // Extract filters
    if (query.eventId) {
      filters.eventId = query.eventId;
    }
    if (query.status) {
      filters.status = query.status;
    }
    if (query.minPrice) {
      filters.minPrice = BigInt(query.minPrice);
    }
    if (query.maxPrice) {
      filters.maxPrice = BigInt(query.maxPrice);
    }

    // Extract pagination
    if (query.page) {
      pagination.page = parseInt(query.page, 10);
    }
    if (query.limit) {
      pagination.limit = parseInt(query.limit, 10);
    }
    if (query.sort) {
      pagination.sort = query.sort;
    }

    // Get listings
    const result = await this.marketplaceService.getListings(filters, pagination);

    // Convert BigInt fields
    const convertedResult = {
      ...result,
      docs: convertBigIntToString(result.docs)
    };

    res.status(200).json({
      success: true,
      data: convertedResult
    });
  });

  getListingById = asyncHandler(async (req, res, next) => {
    const listing = await this.marketplaceService.getListingById(req.params.id);

    if (!listing) {
      const error = new Error('Listing not found');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: convertBigIntToString(listing)
    });
  });

  createListing = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;
    const { ticketId, price, expiresAt } = validatedData;

    if (!ticketId || !price || !expiresAt) {
      const error = new Error('Missing required fields: ticketId, price, and expiresAt');
      error.statusCode = 400;
      return next(error);
    }

    // Convert price to BigInt
    const listingData = {
      ticketId,
      price: BigInt(price),
      expiresAt: new Date(expiresAt)
    };

    // Create listing
    try {
      const listing = await this.marketplaceService.createListing(listingData, req.user.walletAddress);

      res.status(201).json({
        success: true,
        data: convertBigIntToString(listing)
      });
    } catch (error) {
      if (error.message === 'Ticket not found') {
        error.statusCode = 404;
      } else if (error.message === 'Not authorized to list this ticket') {
        error.statusCode = 403;
      } else {
        error.statusCode = 400;
      }
      return next(error);
    }
  });

  cancelListing = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Cancel listing
    try {
      const listing = await this.marketplaceService.cancelListing(req.params.id, req.user.walletAddress);

      res.status(200).json({
        success: true,
        data: convertBigIntToString(listing)
      });
    } catch (error) {
      if (error.message === 'Listing not found') {
        error.statusCode = 404;
      } else if (error.message === 'Not authorized to cancel this listing') {
        error.statusCode = 403;
      } else {
        error.statusCode = 400;
      }
      return next(error);
    }
  });

  getMarketplaceStats = asyncHandler(async (req, res) => {
    const stats = await this.marketplaceService.getMarketplaceStats();

    res.status(200).json({
      success: true,
      data: convertBigIntToString(stats)
    });
  });
}

export default MarketplaceController;
