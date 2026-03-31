import { isValidObjectId } from 'mongoose';
import * as eventRepo from '../../repositories/event.repo.js';
import { compareBigInt, toBigInt } from '../../utils/bigint.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/customErrors.js';
import UploadService from '../upload/upload.service.js';

// Default upload service instance (lazy initialization for future use)
let defaultUploadService = null;
function getDefaultUploadService() {
  if (!defaultUploadService) {
    defaultUploadService = new UploadService();
  }
  return defaultUploadService;
}

/**
 * Create a new event in draft status
 * @param {Object} eventData - Event data
 * @param {Object} user - User object with walletAddress and role
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Created event
 */
export async function createEvent(eventData, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  // Create event with draft status
  const event = await repository.createEvent({
    ...eventData,
    organizer: user.walletAddress.toLowerCase(),
    status: 'draft',
    currentFunding: "0",
    ticketsSold: 0,
    totalTicketsUsed: 0
  });

  return event;
}

/**
 * Get events with filters, pagination, and sorting
 * @param {Object} query - Query parameters from request
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated events
 */
export async function getEvents(query = {}, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  const { status, category, organizer, page, limit, sort } = query;

  // Build query with short-circuiting
  const dbQuery = {
    ...(status && { status }),
    ...(category && { category }),
    ...(organizer && { organizer: organizer.toLowerCase() })
  };

  // Pagination options with defaults
  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: Math.min(limit ? parseInt(limit, 10) : 20, 100),
    sort: sort || '-createdAt',
    lean: true
  };

  return await repository.findEvents(dbQuery, options);
}

/**
 * Get event by ID with stats
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object|null>} Event with stats or null
 */
export async function getEventById(eventId, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  if (!isValidObjectId(eventId)) {
    throw new BadRequestError('Invalid event id');
  }

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  return event;
}

/**
 * Update event
 * @param {string} eventId - Event ID
 * @param {Object} updates - Updates to apply
 * @param {Object} user - User object with walletAddress
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEvent(eventId, updates, user, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new ForbiddenError('Not authorized to update this event');
  }

  // Allowlist: only allow specific fields to be updated
  const allowedFields = [
    'title',
    'description',
    'category',
    'startDate',
    'endDate',
    'fundingGoal',
    'minStakeRequired',
    'fundingDeadline',
    'status',
    'venue',
    'imageUrls',
    'metadataUri',
    'totalTickets',
    'ticketTiers',
    'ticketUsageThreshold'
  ];

  const sanitizedUpdates = {};
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  });

  // Prevent changing funding goal after funding starts
  if (updates.fundingGoal && event.status !== 'draft') {
    throw new BadRequestError('Cannot change funding goal after funding starts');
  }

  // Apply updates
  const updatedEvent = await repository.updateById(eventId, sanitizedUpdates);
  return updatedEvent;
}

/**
 * Delete event (only draft events)
 * @param {string} eventId - Event ID
 * @param {Object} user - User object with walletAddress
 * @param {Object} repos - Injected repositories (for testing)
 * @param {Object} uploadSvc - Upload service for deleting images (for testing)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteEvent(eventId, user, repos = {}, uploadSvc = null) {
  const repository = repos.eventRepo || eventRepo;
  const uploader = uploadSvc || getDefaultUploadService();

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new ForbiddenError('Not authorized to delete this event');
  }

  // Only allow deleting draft events
  if (event.status !== 'draft') {
    throw new BadRequestError('Only draft events can be deleted');
  }

  // Delete all event images from Cloudinary before deleting the event
  if (event.imageUrls && event.imageUrls.length > 0) {
    try {
      await uploader.deleteMultipleImages(event.imageUrls);
    } catch (error) {
      // Log error but don't fail event deletion
      console.error('Failed to delete event images from Cloudinary:', error);
    }
  }

  return await repository.deleteById(eventId);
}

/**
 * Get event statistics
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object|null>} Event stats or null
 */
export async function getEventStats(eventId, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Calculate funding progress
  const fundingProgress = toBigInt(event.fundingGoal) > toBigInt("0")
    ? Number((toBigInt(event.currentFunding) * toBigInt("100")) / toBigInt(event.fundingGoal))
    : 0;

  // Calculate ticket availability
  const ticketsAvailable = event.totalTickets - event.ticketsSold;

  // Calculate ticket usage rate
  const ticketUsageRate = event.ticketsSold > 0
    ? (event.totalTicketsUsed / event.ticketsSold) * 100
    : 0;

  return {
    eventId: event._id,
    fundingProgress,
    currentFunding: event.currentFunding,
    fundingGoal: event.fundingGoal,
    ticketsSold: event.ticketsSold,
    ticketsAvailable,
    totalTickets: event.totalTickets,
    totalTicketsUsed: event.totalTicketsUsed,
    ticketUsageRate: Math.round(ticketUsageRate * 100) / 100
  };
}

/**
 * Update funding status
 * @param {string} eventId - Event ID
 * @param {Object} fundingData - Funding data
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateFundingStatus(eventId, fundingData, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const event = await repository.findById(eventId);

  if (!event) {
    throw new Error('Event not found');
  }

  // Prepare updates
  const updates = {};

  // Update current funding
  if (fundingData.currentFunding !== undefined) {
    updates.currentFunding = fundingData.currentFunding;
  }

  // Check if funding goal reached
  const newFunding = fundingData.currentFunding !== undefined
    ? fundingData.currentFunding
    : event.currentFunding;

  if (compareBigInt(newFunding, event.fundingGoal) >= 0 && event.status === 'funding') {
    updates.status = 'funded';
  }

  return await repository.updateFundingStatus(eventId, updates);
}

/**
 * Delete a specific image from an event
 * @param {string} eventId - Event ID
 * @param {string} imageUrl - Image URL to delete
 * @param {Object} user - User object with walletAddress
 * @param {Object} repos - Injected repositories (for testing)
 * @param {Object} uploadSvc - Upload service for deleting images (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function deleteEventImage(eventId, imageUrl, user, repos = {}, uploadSvc = null) {
  const repository = repos.eventRepo || eventRepo;
  const uploader = uploadSvc || getDefaultUploadService();

  const event = await repository.findById(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== user.walletAddress.toLowerCase()) {
    throw new ForbiddenError('Not authorized to modify this event');
  }

  // Check if image exists in event
  if (!event.imageUrls || !event.imageUrls.includes(imageUrl)) {
    throw new NotFoundError('Image not found in event');
  }

  // Delete image from Cloudinary
  try {
    await uploader.deleteImage(imageUrl);
  } catch (error) {
    console.error('Failed to delete image from Cloudinary:', error);
    // Continue with database update even if Cloudinary deletion fails
  }

  // Remove image URL from event
  const updatedImageUrls = event.imageUrls.filter(url => url !== imageUrl);
  const updatedEvent = await repository.updateById(eventId, { imageUrls: updatedImageUrls });

  return updatedEvent;
}
