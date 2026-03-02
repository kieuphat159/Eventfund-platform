import asyncHandler from '../utils/asyncHandler.js';
import * as ticketsService from '../services/tickets/tickets.service.js';
import { convertBigIntToString } from '../utils/bigint.js';

/**
 * TicketsController - Handles ticket management endpoints
 */
class TicketsController {
  constructor(service = ticketsService) {
    this.ticketsService = service;
  }

  getTickets = asyncHandler(async (req, res) => {
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
    if (query.currentOwner) {
      filters.currentOwner = query.currentOwner;
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

    // Get tickets
    const result = await this.ticketsService.getTickets(filters, pagination);

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

  getTicketById = asyncHandler(async (req, res, next) => {
    const ticket = await this.ticketsService.getTicketById(req.params.tokenId);

    if (!ticket) {
      const error = new Error('Ticket not found');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: convertBigIntToString(ticket)
    });
  });

  getUserTickets = asyncHandler(async (req, res) => {
    const pagination = {};

    // Extract pagination
    if (req.query.page) {
      pagination.page = parseInt(req.query.page, 10);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit, 10);
    }
    if (req.query.sort) {
      pagination.sort = req.query.sort;
    }

    // Get user tickets
    const result = await this.ticketsService.getUserTickets(req.params.walletAddress, pagination);

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

  verifyTicket = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (verifier or admin role)
    if (req.user.role !== 'verifier' && req.user.role !== 'admin') {
      const error = new Error('Verifier role required');
      error.statusCode = 403;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;
    const { tokenId, walletAddress } = validatedData;

    if (!tokenId || !walletAddress) {
      const error = new Error('Missing required fields: tokenId and walletAddress');
      error.statusCode = 400;
      return next(error);
    }

    // Get ticket first to check if it exists
    const ticket = await this.ticketsService.getTicketById(tokenId);

    if (!ticket) {
      const error = new Error('Ticket not found');
      error.statusCode = 404;
      return next(error);
    }

    // Verify ownership
    const isOwner = await this.ticketsService.verifyTicketOwnership(tokenId, walletAddress);

    res.status(200).json({
      success: true,
      data: {
        isOwner,
        ticket: convertBigIntToString(ticket)
      }
    });
  });

  markTicketAsUsed = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (verifier or admin role)
    if (req.user.role !== 'verifier' && req.user.role !== 'admin') {
      const error = new Error('Verifier role required');
      error.statusCode = 403;
      return next(error);
    }

    // Mark ticket as used
    try {
      const ticket = await this.ticketsService.markTicketAsUsed(req.params.tokenId, req.user.walletAddress);

      res.status(200).json({
        success: true,
        data: convertBigIntToString(ticket)
      });
    } catch (error) {
      if (error.message === 'Ticket not found') {
        error.statusCode = 404;
      } else {
        error.statusCode = 400;
      }
      return next(error);
    }
  });

  getTicketStats = asyncHandler(async (req, res) => {
    const stats = await this.ticketsService.getTicketStats(req.params.eventId);

    res.status(200).json({
      success: true,
      data: convertBigIntToString(stats)
    });
  });
}

export default TicketsController;
