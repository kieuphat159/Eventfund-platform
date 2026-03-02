import { Event as DefaultEvent } from '../models/index.js';

/**
 * Create a new event
 * @param {Object} eventData - Event data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Created event as plain object
 */
export async function createEvent(eventData, models = {}) {
  const Event = models.Event || DefaultEvent;
  const event = new Event(eventData);
  await event.save();
  return event.toObject();
}

/**
 * Find event by ID
 * @param {string} eventId - Event ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Event as plain object or null
 */
export async function findById(eventId, models = {}) {
  const Event = models.Event || DefaultEvent;
  const event = await Event.findById(eventId);
  return event ? event.toObject() : null;
}

/**
 * Find events with filters and pagination
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options (page, limit, sort, lean)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object>} Paginated results with docs, totalDocs, limit, page, etc.
 */
export async function findEvents(query, options, models = {}) {
  const Event = models.Event || DefaultEvent;

  // Default options
  const paginationOptions = {
    page: options.page || 1,
    limit: options.limit || 20,
    sort: options.sort || '-createdAt',
    lean: options.lean !== false // Default to true
  };

  return await Event.paginate(query, paginationOptions);
}

/**
 * Update event by ID
 * @param {string} eventId - Event ID
 * @param {Object} updates - Update data
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated event as plain object or null
 */
export async function updateById(eventId, updates, models = {}) {
  const Event = models.Event || DefaultEvent;
  const event = await Event.findByIdAndUpdate(
    eventId,
    updates,
    { new: true, runValidators: true }
  );
  return event ? event.toObject() : null;
}

/**
 * Delete event by ID
 * @param {string} eventId - Event ID
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteById(eventId, models = {}) {
  const Event = models.Event || DefaultEvent;
  const result = await Event.findByIdAndDelete(eventId);
  return result !== null;
}

/**
 * Update funding status
 * @param {string} eventId - Event ID
 * @param {Object} fundingData - Funding data (currentFunding, status)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated event as plain object or null
 */
export async function updateFundingStatus(eventId, fundingData, models = {}) {
  const Event = models.Event || DefaultEvent;
  const event = await Event.findByIdAndUpdate(
    eventId,
    fundingData,
    { new: true, runValidators: true }
  );
  return event ? event.toObject() : null;
}

/**
 * Increment ticket counters
 * @param {string} eventId - Event ID
 * @param {Object} increments - Counter increments (ticketsSold, totalTicketsUsed)
 * @param {Object} models - Injected models (optional)
 * @returns {Promise<Object|null>} Updated event as plain object or null
 */
export async function incrementTicketCounters(eventId, increments, models = {}) {
  const Event = models.Event || DefaultEvent;

  const updateOperation = {};
  if (increments.ticketsSold !== undefined) {
    updateOperation.$inc = updateOperation.$inc || {};
    updateOperation.$inc.ticketsSold = increments.ticketsSold;
  }
  if (increments.totalTicketsUsed !== undefined) {
    updateOperation.$inc = updateOperation.$inc || {};
    updateOperation.$inc.totalTicketsUsed = increments.totalTicketsUsed;
  }

  const event = await Event.findByIdAndUpdate(
    eventId,
    updateOperation,
    { new: true, runValidators: true }
  );
  return event ? event.toObject() : null;
}
