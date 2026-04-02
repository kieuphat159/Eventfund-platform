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
  name: Joi.string().trim().optional(),
  address: Joi.string().trim().required()
});

const ticketTierSchema = Joi.object({
  name: Joi.string().trim().min(1).required()
    .messages({
      'string.empty': 'Ticket tier name is required',
      'any.required': 'Ticket tier name is required'
    }),
  price: Joi.number().min(0).required()
    .messages({
      'number.base': 'Ticket tier price must be a number',
      'number.min': 'Ticket tier price must be at least 0',
      'any.required': 'Ticket tier price is required'
    }),
  totalSupply: Joi.number().integer().min(1).required()
    .messages({
      'number.base': 'Ticket tier supply must be a number',
      'number.integer': 'Ticket tier supply must be an integer',
      'number.min': 'Ticket tier supply must be at least 1',
      'any.required': 'Ticket tier supply is required'
    }),
  benefits: Joi.array().items(Joi.string().trim()).optional()
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
  title: Joi.string().min(3).max(200).required()
    .messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 3 characters long',
      'string.max': 'Title must not exceed 200 characters',
      'any.required': 'Title is required'
    }),
  description: Joi.string().min(1).required()
    .messages({
      'string.empty': 'Description is required',
      'any.required': 'Description is required'
    }),
  category: Joi.string().optional(),
  organizerStake: bigIntString.optional(),
  fundingGoal: bigIntString.required()
    .messages({
      'string.empty': 'Funding goal is required',
      'any.required': 'Funding goal is required'
    }),
  minStakeRequired: bigIntString.optional(),
  fundingDeadline: Joi.date().iso().required()
    .messages({
      'date.base': 'Funding deadline must be a valid date',
      'any.required': 'Funding deadline is required'
    }),
  startDate: Joi.date().iso().required()
    .messages({
      'date.base': 'Start date must be a valid date',
      'any.required': 'Start date is required'
    }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.greater': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
  venue: venueSchema.required()
    .messages({
      'any.required': 'Venue is required'
    }),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).required()
    .messages({
      'number.base': 'Total tickets must be a number',
      'number.integer': 'Total tickets must be an integer',
      'number.min': 'Total tickets must be greater than 0',
      'any.required': 'Total tickets is required'
    }),
  ticketTiers: Joi.array().items(ticketTierSchema).min(1).optional()
    .messages({
      'array.base': 'Ticket tiers must be an array',
      'array.min': 'At least one ticket tier is required'
    }),
  ticketUsageThreshold: Joi.number().integer().min(0).max(100).optional()
    .messages({
      'number.min': 'Ticket usage threshold must be at least 0',
      'number.max': 'Ticket usage threshold must not exceed 100'
    })
});

// Schema for PATCH /events/:id
const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional()
    .messages({
      'string.min': 'Title must be at least 3 characters long',
      'string.max': 'Title must not exceed 200 characters'
    }),
  description: Joi.string().min(1).optional(),
  category: Joi.string().optional(),
  startDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.greater': 'End date must be after start date'
    }),
  fundingGoal: bigIntString.optional()
    .messages({
      'string.empty': 'Funding goal must be a valid positive integer string'
    }),
  minStakeRequired: bigIntString.optional()
    .messages({
      'string.empty': 'Minimum stake must be a valid positive integer string'
    }),
  fundingDeadline: Joi.date().iso().optional()
    .messages({
      'date.base': 'Funding deadline must be a valid date'
    }),
  status: Joi.string().valid(...eventStatusEnum).optional()
    .messages({
      'any.only': `Status must be one of: ${eventStatusEnum.join(', ')}`
    }),
  venue: venueSchema.optional(),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).optional()
    .messages({
      'number.base': 'Total tickets must be a number',
      'number.integer': 'Total tickets must be an integer',
      'number.min': 'Total tickets must be greater than 0'
    }),
  ticketTiers: Joi.array().items(ticketTierSchema).min(1).optional()
    .messages({
      'array.base': 'Ticket tiers must be an array',
      'array.min': 'At least one ticket tier is required'
    }),
  ticketUsageThreshold: Joi.number().integer().min(0).max(100).optional()
    .messages({
      'number.min': 'Ticket usage threshold must be at least 0',
      'number.max': 'Ticket usage threshold must not exceed 100'
    })
}).min(1)
  .messages({
    'object.min': 'At least one field must be provided for update'
  });

// Schema for GET /events query parameters
const queryEventsSchema = Joi.object({
  status: Joi.string().valid(...eventStatusEnum).optional()
    .messages({
      'any.only': `Status must be one of: ${eventStatusEnum.join(', ')}`
    }),
  category: Joi.string().optional(),
  organizer: ethereumAddress.optional(),
  page: Joi.number().integer().min(1).optional()
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number().integer().min(1).max(100).optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 100 (maximum allowed)'
    }),
  sort: Joi.string().valid('createdAt', 'startDate', 'fundingDeadline', 'title').optional()
    .messages({
      'any.only': 'Sort must be one of: createdAt, startDate, fundingDeadline, title'
    }),
  order: Joi.string().valid('asc', 'desc').optional()
    .messages({
      'any.only': 'Order must be either asc or desc'
    })
});

export const eventSchemas = {
  createEvent: createEventSchema,
  updateEvent: updateEventSchema,
  queryEvents: queryEventsSchema
};
