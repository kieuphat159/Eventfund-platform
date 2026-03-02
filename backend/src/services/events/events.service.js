import * as eventRepo from '../repositories/event.repo.js';

/**
 * Create a new event in draft status
 * @param {Object} eventData - Event data
 * @param {string} organizerWallet - Organizer wallet address
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Created event
 */
export async function createEvent(eventData, organizerWallet, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  console.log('[createEvent service] Starting...');
  console.log('[createEvent service] Organizer:', organizerWallet);
  console.log('[createEvent service] Event data:', eventData);

  // Validate organizer wallet format
  if (!organizerWallet || !/^0x[a-fA-F0-9]{40}$/.test(organizerWallet)) {
    throw new Error('Invalid organizer wallet address');
  }

  // Validate funding goal is positive
  if (eventData.fundingGoal && eventData.fundingGoal <= 0n) {
    throw new Error('Funding goal must be positive');
  }

  // Create event with draft status
  const event = await repository.createEvent({
    ...eventData,
    organizer: organizerWallet.toLowerCase(),
    status: 'draft',
    currentFunding: 0n,
    ticketsSold: 0,
    totalTicketsUsed: 0
  });

  console.log('[createEvent service] Event saved:', event);

  return event;
}

/**
 * Get events with filters, pagination, and sorting
 * @param {Object} filters - Query filters
 * @param {Object} pagination - Pagination options
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Paginated events
 */
export async function getEvents(filters = {}, pagination = {}, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const query = {};

  // Apply filters
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.category) {
    query.category = filters.category;
  }
  if (filters.organizer) {
    query.organizer = filters.organizer.toLowerCase();
  }

  // Pagination options
  const options = {
    page: pagination.page || 1,
    limit: Math.min(pagination.limit || 20, 100),
    sort: pagination.sort || '-createdAt',
    lean: true
  };

  return await repository.findEvents(query, options);
}

/**
 * Get event by ID with stats
 * @param {string} eventId - Event ID
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object|null>} Event with stats or null
 */
export async function getEventById(eventId, repos = {}) {
  const repository = repos.eventRepo || eventRepo;

  // Repository already returns plain object or null
  return await repository.findById(eventId);
}

/**
 * Update event
 * @param {string} eventId - Event ID
 * @param {Object} updates - Updates to apply
 * @param {string} userWallet - User wallet address
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<Object>} Updated event
 */
export async function updateEvent(eventId, updates, userWallet, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const event = await repository.findById(eventId);

  if (!event) {
    throw new Error('Event not found');
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== userWallet.toLowerCase()) {
    throw new Error('Not authorized to update this event');
  }

  // Prevent changing organizer
  if (updates.organizer) {
    delete updates.organizer;
  }

  // Prevent changing funding goal after funding starts
  if (updates.fundingGoal && event.status !== 'draft') {
    throw new Error('Cannot change funding goal after funding starts');
  }

  // Apply updates
  const updatedEvent = await repository.updateById(eventId, updates);
  return updatedEvent;
}

/**
 * Delete event (only draft events)
 * @param {string} eventId - Event ID
 * @param {string} userWallet - User wallet address
 * @param {Object} repos - Injected repositories (for testing)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteEvent(eventId, userWallet, repos = {}) {
  const repository = repos.eventRepo || eventRepo;
  const event = await repository.findById(eventId);

  if (!event) {
    throw new Error('Event not found');
  }

  // Check authorization
  if (event.organizer.toLowerCase() !== userWallet.toLowerCase()) {
    throw new Error('Not authorized to delete this event');
  }

  // Only allow deleting draft events
  if (event.status !== 'draft') {
    throw new Error('Only draft events can be deleted');
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
    return null;
  }

  // Calculate funding progress
  const fundingProgress = event.fundingGoal > 0n
    ? Number((event.currentFunding * 100n) / event.fundingGoal)
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

  if (newFunding >= event.fundingGoal && event.status === 'funding') {
    updates.status = 'funded';
  }

  return await repository.updateFundingStatus(eventId, updates);
}
