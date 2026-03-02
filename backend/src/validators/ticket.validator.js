import Joi from 'joi';

// Custom validator for Ethereum address
const ethereumAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .message('must be a valid Ethereum address');

// Custom validator for MongoDB ObjectId
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('must be a valid MongoDB ObjectId');

// Ticket status enum
const ticketStatusEnum = ['minted', 'sold', 'used', 'expired'];

// Schema for POST /tickets/verify
const verifyTicketSchema = Joi.object({
  tokenId: Joi.string().min(1).required(),
  eventId: objectId.required(),
  walletAddress: ethereumAddress.optional()
});

// Schema for POST /tickets/:tokenId/use
const useTicketSchema = Joi.object({
  tokenId: Joi.string().min(1).required(),
  eventId: objectId.optional()
});

// Schema for GET /tickets query parameters
const queryTicketsSchema = Joi.object({
  eventId: objectId.optional(),
  owner: ethereumAddress.optional(),
  status: Joi.string().valid(...ticketStatusEnum).optional(),
  isListed: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional()
});

export const ticketSchemas = {
  verifyTicket: verifyTicketSchema,
  useTicket: useTicketSchema,
  queryTickets: queryTicketsSchema
};
