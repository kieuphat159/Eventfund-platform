import asyncHandler from '../utils/asyncHandler.js';
import * as ticketsService from '../services/tickets/tickets.service.js';

/**
 * TicketsController - Handles ticket management endpoints
 */
class TicketsController {
  constructor(service = ticketsService) {
    this.ticketsService = service;
  }

  getTickets = asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;

    const result = await this.ticketsService.getTickets(query);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getTicketById = asyncHandler(async (req, res) => {
    const { tokenId } = req.params;

    const ticket = await this.ticketsService.getTicketById(tokenId);

    res.status(200).json({
      success: true,
      data: ticket
    });
  });

  createPurchaseIntent = asyncHandler(async (req, res) => {
    const body = req.validated?.body || req.body;

    const intent = await this.ticketsService.createPurchaseIntent(
      body,
      req.user.walletAddress
    );

    res.status(200).json({
      success: true,
      data: intent
    });
  });

  confirmPurchaseTransaction = asyncHandler(async (req, res) => {
    const body = req.validated?.body || req.body;

    const result = await this.ticketsService.confirmPurchaseTransaction(body);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getUserTickets = asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const query = req.query;

    const result = await this.ticketsService.getUserTickets(walletAddress, query);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  verifyTicket = asyncHandler(async (req, res) => {
    const { tokenId, walletAddress } = req.validated?.body || req.body;

    const result = await this.ticketsService.verifyTicket(tokenId, walletAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  markTicketAsUsed = asyncHandler(async (req, res) => {
    const { tokenId } = req.params;
    const verifierAddress = req.user.walletAddress;

    const ticket = await this.ticketsService.markTicketAsUsed(tokenId, verifierAddress);

    res.status(200).json({
      success: true,
      data: ticket
    });
  });

  createUseTicketIntent = asyncHandler(async (req, res) => {
    const { tokenId } = req.params;

    const intent = await this.ticketsService.createUseTicketIntent(
      tokenId,
      req.user.walletAddress
    );

    res.status(200).json({
      success: true,
      data: intent
    });
  });

  confirmUseTicketTransaction = asyncHandler(async (req, res) => {
    const body = req.validated?.body || req.body;

    const result = await this.ticketsService.confirmUseTicketTransaction(body);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getTicketStats = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const stats = await this.ticketsService.getTicketStats(eventId);

    res.status(200).json({
      success: true,
      data: stats
    });
  });
}

export default TicketsController;
