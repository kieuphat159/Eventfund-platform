import Joi from 'joi';

// User role enum
const userRoleEnum = ['user', 'organizer', 'verifier', 'admin'];

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

// Schema for PATCH /admin/users/:walletAddress/role
const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid(...userRoleEnum).required()
});

// Schema for PATCH /admin/events/:id/status
const updateEventStatusSchema = Joi.object({
  status: Joi.string().valid(...eventStatusEnum).required(),
  reason: Joi.string().min(1).optional()
});

const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().min(1).optional(),
  category: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  fundingGoal: Joi.string().pattern(/^[0-9]+$/).optional(),
  minStakeRequired: Joi.string().pattern(/^[0-9]+$/).optional(),
  fundingDeadline: Joi.date().iso().optional(),
  status: Joi.string().valid(...eventStatusEnum).optional(),
  venue: Joi.object({
    name: Joi.string().trim().optional(),
    address: Joi.string().trim().required(),
  }).optional(),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).optional(),
  ticketTiers: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().min(1).required(),
      price: Joi.number().min(0).required(),
      totalSupply: Joi.number().integer().min(1).required(),
      benefits: Joi.array().items(Joi.string().trim()).optional(),
    }),
  ).min(1).optional(),
  ticketUsageThreshold: Joi.number().integer().min(0).max(100).optional(),
}).min(1);

const eventInvestmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string()
    .valid('createdAt', '-createdAt', 'contributionAmount', '-contributionAmount')
    .optional(),
});

export const adminSchemas = {
  updateUserRole: updateUserRoleSchema,
  updateEventStatus: updateEventStatusSchema,
  updateEvent: updateEventSchema,
  eventInvestmentsQuery: eventInvestmentsQuerySchema
};
