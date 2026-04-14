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
  reason: Joi.string().min(1).optional(),
  syncOnChain: Joi.boolean().optional(),
  ticketType: Joi.number().integer().min(0).max(255).optional(),
  quantity: Joi.number().integer().min(1).optional()
});

export const adminSchemas = {
  updateUserRole: updateUserRoleSchema,
  updateEventStatus: updateEventStatusSchema
};
