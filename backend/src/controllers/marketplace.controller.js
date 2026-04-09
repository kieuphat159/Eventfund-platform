import asyncHandler from '../utils/asyncHandler.js';
import * as marketplaceService from '../services/marketplace/marketplace.service.js';
import { NotFoundError } from '../utils/customErrors.js';

/**
 * MarketplaceController - Handles marketplace endpoints
 */
class MarketplaceController {
  constructor(service = marketplaceService) {
    this.marketplaceService = service;
  }

  getListings = asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;

    // Pass entire query to service (service handles filters and pagination together)
    const result = await this.marketplaceService.getListings(query);

    res.status(200).json({ success: true, data: result });
  });

  getListingById = asyncHandler(async (req, res) => {
    const listing = await this.marketplaceService.getListingById(req.params.id);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    res.status(200).json({ success: true, data: listing });
  });

  createListing = asyncHandler(async (req, res) => {
    // Không cần check Auth hay Validate thiếu trường nữa!
    const { ticketId, price, expiresAt } = req.validated?.body || req.body;

    const listingData = {
      ticketId,
      price,
      expiresAt: new Date(expiresAt)
    };

    // Gọi thẳng Service. Mọi lỗi (400, 403, 404) cứ để Service throw CustomError,
    // asyncHandler sẽ tự động bắt và ném ra Global Error Handler!
    const listing = await this.marketplaceService.createListing(listingData, req.user.walletAddress);

    res.status(201).json({ success: true, data: listing });
  });

  createListingIntent = asyncHandler(async (req, res) => {
    const body = req.validated?.body || req.body;

    const intent = await this.marketplaceService.createListingIntent(
      body,
      req.user.walletAddress
    );

    res.status(200).json({ success: true, data: intent });
  });

  createBuyListingIntent = asyncHandler(async (req, res) => {
    const intent = await this.marketplaceService.createBuyListingIntent(
      req.params.id,
      req.user.walletAddress
    );

    res.status(200).json({ success: true, data: intent });
  });

  createCancelListingIntent = asyncHandler(async (req, res) => {
    const intent = await this.marketplaceService.createCancelListingIntent(
      req.params.id,
      req.user.walletAddress
    );

    res.status(200).json({ success: true, data: intent });
  });

  confirmSoldTransaction = asyncHandler(async (req, res) => {
    const body = req.validated?.body || req.body;

    const result = await this.marketplaceService.confirmListingSoldTransaction(body);

    res.status(200).json({ success: true, data: result });
  });

  cancelListing = asyncHandler(async (req, res) => {
    // Giao hết việc ném lỗi 403, 404 cho Service. Controller chỉ việc nhận kết quả.
    const listing = await this.marketplaceService.cancelListing(req.params.id, req.user.walletAddress);

    res.status(200).json({ success: true, data: listing });
  });

  getMarketplaceStats = asyncHandler(async (req, res) => {
    const stats = await this.marketplaceService.getMarketplaceStats();

    res.status(200).json({ success: true, data: stats });
  });
}

export default MarketplaceController;