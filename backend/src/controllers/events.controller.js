import asyncHandler from "../utils/asyncHandler.js";
import * as eventsService from "../services/events/events.service.js";

/**
 * EventsController - Handles event management endpoints
 *
 * Endpoints:
 * - POST /events - Create new draft event (authenticated user required)
 * - GET /events - List events with filters and pagination (public)
 * - GET /events/:id - Get single event (public)
 * - PATCH /events/:id - Update event content (ownership required)
 * - DELETE /events/:id - Delete draft event (ownership required)
 * - GET /events/:id/stats - Get event statistics (public)
 */
class EventsController {
  constructor(service = eventsService) {
    this.eventsService = service;
  }

  /**
   * POST /events
   * Create a new event in draft status
   */
  createEvent = asyncHandler(async (req, res) => {
    const eventData = req.validated?.body || req.body;
    const event = await this.eventsService.createEvent(eventData, req.user);

    res.status(201).json({
      success: true,
      data: event,
    });
  });

  /**
   * POST /events/create-intent
   * Build create-event on-chain tx intent for user wallet signing
   */
  createEventIntent = asyncHandler(async (req, res) => {
    const eventData = req.validated?.body || req.body;
    const intent = await this.eventsService.createCreateEventIntent(
      eventData,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: intent,
    });
  });

  /**
   * POST /events/create/confirm
   * Confirm user create-event transaction and sync DB
   */
  confirmCreateEventTransaction = asyncHandler(async (req, res) => {
    const payload = req.validated?.body || req.body;
    const result = await this.eventsService.confirmCreateEventTransaction(
      payload,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /events/blockchain-config
   * Get Fund contract address and chain id for FE transaction building
   */
  getBlockchainConfig = asyncHandler(async (_req, res) => {
    const config = await this.eventsService.getEventBlockchainConfig();

    res.status(200).json({
      success: true,
      data: config,
    });
  });

  /**
   * GET /events
   * List events with filters, pagination, and sorting
   */
  getEvents = asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;
    const result = await this.eventsService.getEvents(query);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /events/:id
   * Get single event by ID
   */
  getEventById = asyncHandler(async (req, res) => {
    const event = await this.eventsService.getEventById(req.params.id);

    res.status(200).json({
      success: true,
      data: event,
    });
  });

  /**
   * PATCH /events/:id
   * Update event (requires ownership)
   */
  updateEvent = asyncHandler(async (req, res) => {
    const updates = req.validated?.body || req.body;
    const event = await this.eventsService.updateEvent(
      req.params.id,
      updates,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: event,
    });
  });

  /**
   * DELETE /events/:id
   * Delete draft event (requires ownership)
   */
  deleteEvent = asyncHandler(async (req, res) => {
    await this.eventsService.deleteEvent(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  });

  /**
   * POST /events/:id/invest
   * Invest in an event by contributing funding
   */
  investInEvent = asyncHandler(async (req, res) => {
    const amount = req.validated?.body?.amount ?? req.body.amount;
    const share = await this.eventsService.investInEvent(
      req.params.id,
      amount,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: share,
    });
  });

  /**
   * POST /events/:id/invest-intent
   * Build contribute() transaction intent for wallet signing
   */
  createInvestmentIntent = asyncHandler(async (req, res) => {
    const amount = req.validated?.body?.amount ?? req.body.amount;
    const intent = await this.eventsService.createInvestmentIntent(
      req.params.id,
      amount,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: intent,
    });
  });

  /**
   * POST /events/:id/invest/confirm
   * Confirm contribute() transaction and sync investment state
   */
  confirmInvestmentTransaction = asyncHandler(async (req, res) => {
    const payload = req.validated?.body || req.body;
    const result = await this.eventsService.confirmInvestmentTransaction(
      req.params.id,
      payload,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  createContributionRefundIntent = asyncHandler(async (req, res) => {
    const intent = await this.eventsService.createContributionRefundIntent(
      req.params.id,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: intent,
    });
  });

  confirmContributionRefundTransaction = asyncHandler(async (req, res) => {
    const payload = req.validated?.body || req.body;
    const result = await this.eventsService.confirmContributionRefundTransaction(
      req.params.id,
      payload,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /events/:id/stats
   * Get event statistics
   */
  getEventStats = asyncHandler(async (req, res) => {
    const stats = await this.eventsService.getEventStats(req.params.id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  });

  /**
   * DELETE /events/:id/images/:imageUrl
   * Delete a specific image from an event
   */
  deleteEventImage = asyncHandler(async (req, res) => {
    const { id, imageUrl } = req.params;
    const decodedImageUrl = decodeURIComponent(imageUrl);

    const event = await this.eventsService.deleteEventImage(
      id,
      decodedImageUrl,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: event,
    });
  });

  // 🔥 NEW: assign verifier
  assignVerifier = asyncHandler(async (req, res) => {
    const { verifier } = req.body;

    const event = await this.eventsService.assignVerifier(
      req.params.id,
      verifier,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: event,
    });
  });

  /**
   * POST /events/:id/mark-completed
   * Mark event as completed when ticket usage threshold is met
   */
  markEventAsCompleted = asyncHandler(async (req, res) => {
    const payload = req.validated?.body || req.body;

    const event = await this.eventsService.markEventAsCompleted(
      req.params.id,
      payload,
      req.user,
    );

    res.status(200).json({
      success: true,
      data: event,
    });
  });
}

export default EventsController;
