import Joi from 'joi';

// Custom validator for Ethereum address
const ethereumAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .message('must be a valid Ethereum address');

// Custom validator for BigInt string
const bigIntString = Joi.string()
  .pattern(/^[0-9]+$/)
  .message('must be a valid positive integer string');

// Venue schema
const venueSchema = Joi.object({
  name: Joi.string().required(),
  address: Joi.string().required(),
  city: Joi.string().required(),
  country: Joi.string().required(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180)
  }).optional()
});

// Event status enum
const eventStatusEnum = [
  'draft',
  'funding',
  'funded',
  'ticketing',
  'ongoing',
  'completed',
  'cancelled',
  'failed'
];

// Schema for POST /events
const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().min(1).required(),
  category: Joi.string().optional(),
  organizerStake: bigIntString.optional(),
  fundingGoal: bigIntString.required(),
  minStakeRequired: bigIntString.optional(),
  fundingDeadline: Joi.date().iso().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  venue: venueSchema.required(),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).required(),
  ticketUsageThreshold: Joi.number().integer().min(0).max(100).optional()
});

// Schema for PATCH /events/:id
const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().min(1).optional(),
  category: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  venue: venueSchema.optional(),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).optional(),
  ticketUsageThreshold: Joi.number().integer().min(0).max(100).optional()
}).min(1); // At least one field must be provided

// Schema for GET /events query parameters
const queryEventsSchema = Joi.object({
  status: Joi.string().valid(...eventStatusEnum).optional(),
  category: Joi.string().optional(),
  organizer: ethereumAddress.optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().valid('createdAt', 'startDate', 'fundingDeadline', 'title').optional(),
  order: Joi.string().valid('asc', 'desc').optional()
});

export const eventSchemas = {
  createEvent: createEventSchema,
  updateEvent: updateEventSchema,
  queryEvents: queryEventsSchema
};
