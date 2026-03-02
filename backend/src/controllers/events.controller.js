import asyncHandler from '../utils/asyncHandler.js';
import * as eventsService from '../services/events/events.service.js';
import { convertBigIntToString } from '../utils/bigint.js';

/**
 * EventsController - Handles event management endpoints
 *
 * Endpoints:
 * - POST /events - Create new event (organizer role required)
 * - GET /events - List events with filters and pagination (public)
 * - GET /events/:id - Get single event (public)
 * - PATCH /events/:id - Update event (organizer role, ownership required)
 * - DELETE /events/:id - Delete draft event (organizer role, ownership required)
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
  createEvent = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (organizer or admin role)
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      const error = new Error('Organizer role required');
      error.statusCode = 403;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;

    // Validate required fields
    const { title, description, fundingGoal, startDate, endDate, fundingDeadline, totalTickets, venue } = validatedData;

    if (!title || !description || !fundingGoal || !startDate || !endDate || !fundingDeadline || !totalTickets || !venue) {
      const error = new Error('Missing required fields');
      error.statusCode = 400;
      return next(error);
    }

    // Convert BigInt fields
    const eventData = {
      ...validatedData,
      fundingGoal: BigInt(fundingGoal)
    };

    // Convert minStakeRequired if present
    if (validatedData.minStakeRequired) {
      eventData.minStakeRequired = BigInt(validatedData.minStakeRequired);
    }

    // Create event
    const event = await this.eventsService.createEvent(eventData, req.user.walletAddress);

    // Convert BigInt fields to strings for JSON serialization
    const eventResponse = convertBigIntToString(event);

    res.status(201).json({
      success: true,
      data: eventResponse
    });
  });

  /**
   * GET /events
   * List events with filters, pagination, and sorting
   */
  getEvents = asyncHandler(async (req, res) => {
    const filters = {};
    const pagination = {};

    // Get query data (validated or raw)
    const query = req.validated?.query || req.query;

    // Extract filters
    if (query.status) {
      filters.status = query.status;
    }
    if (query.category) {
      filters.category = query.category;
    }
    if (query.organizer) {
      filters.organizer = query.organizer;
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

    // Get events
    const result = await this.eventsService.getEvents(filters, pagination);

    // Convert BigInt fields in all events
    const convertedResult = {
      ...result,
      docs: convertBigIntToString(result.docs)
    };

    res.status(200).json({
      success: true,
      data: convertedResult
    });
  });

  /**
   * GET /events/:id
   * Get single event by ID
   */
  getEventById = asyncHandler(async (req, res, next) => {
    const event = await this.eventsService.getEventById(req.params.id);

    if (!event) {
      const error = new Error('Event not found');
      error.statusCode = 404;
      return next(error);
    }

    // Convert BigInt fields to strings
    const eventResponse = convertBigIntToString(event);

    res.status(200).json({
      success: true,
      data: eventResponse
    });
  });

  /**
   * PATCH /events/:id
   * Update event (requires ownership)
   */
  updateEvent = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;

    // Convert fundingGoal to BigInt if present
    const updates = { ...validatedData };
    if (updates.fundingGoal) {
      updates.fundingGoal = BigInt(updates.fundingGoal);
    }
    if (updates.minStakeRequired) {
      updates.minStakeRequired = BigInt(updates.minStakeRequired);
    }

    // Update event
    const event = await this.eventsService.updateEvent(req.params.id, updates, req.user.walletAddress);

    // Convert BigInt fields to strings
    const eventResponse = convertBigIntToString(event);

    res.status(200).json({
      success: true,
      data: eventResponse
    });
  });

  /**
   * DELETE /events/:id
   * Delete draft event (requires ownership)
   */
  deleteEvent = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Delete event
    await this.eventsService.deleteEvent(req.params.id, req.user.walletAddress);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  });

  /**
   * GET /events/:id/stats
   * Get event statistics
   */
  getEventStats = asyncHandler(async (req, res, next) => {
    const stats = await this.eventsService.getEventStats(req.params.id);

    if (!stats) {
      const error = new Error('Event not found');
      error.statusCode = 404;
      return next(error);
    }

    // Convert BigInt fields to strings
    const statsResponse = convertBigIntToString(stats);

    res.status(200).json({
      success: true,
      data: statsResponse
    });
  });
}

export default EventsController;
