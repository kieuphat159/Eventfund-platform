import Joi from 'joi';

// Custom validator for Ethereum address
const ethereumAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/i)
  .message('must be a valid Ethereum address');

// Custom validator for MongoDB ObjectId
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('must be a valid MongoDB ObjectId');

// Ticket status enum
const ticketStatusEnum = ['minted', 'sold', 'used', 'expired', 'refunded'];

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

const txHashSchema = Joi.string()
  .pattern(/^0x([A-Fa-f0-9]{64})$/)
  .message('must be a valid transaction hash');

const purchaseIntentSchema = Joi.object({
  eventId: objectId.optional(),
  tokenId: Joi.string().min(1).optional()
}).or('eventId', 'tokenId');

const confirmPurchaseSchema = Joi.object({
  txHash: txHashSchema.required(),
  tokenId: Joi.string().min(1).optional(),
  buyerWallet: ethereumAddress.optional()
});

const confirmRefundSchema = Joi.object({
  txHash: txHashSchema.required(),
  tokenId: Joi.string().min(1).optional(),
  buyerWallet: ethereumAddress.optional()
});

const confirmUseTicketSchema = Joi.object({
  txHash: txHashSchema.required(),
  tokenId: Joi.string().min(1).optional(),
  verifierWallet: ethereumAddress.optional()
});

// Schema for GET /tickets query parameters
const queryTicketsSchema = Joi.object({
  eventId: objectId.optional(),
  owner: ethereumAddress.optional(),
  status: Joi.string().valid(...ticketStatusEnum).optional(),
  isListed: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional()
});

// Schema for GET /tickets/:tokenId params
const tokenIdParamsSchema = Joi.object({
  tokenId: Joi.string().min(1).required()
});

// Schema for GET /tickets/user/:walletAddress params
const walletAddressParamsSchema = Joi.object({
  walletAddress: ethereumAddress.required()
});

// Schema for GET /tickets/event/:eventId/stats params
const eventIdParamsSchema = Joi.object({
  eventId: objectId.required()
});

// Schema for GET /tickets/user/:walletAddress query
const userTicketsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  includeRefunded: Joi.boolean().truthy("true").falsy("false").optional(),
});

export const ticketSchemas = {
  verifyTicket: verifyTicketSchema,
  useTicket: useTicketSchema,
  purchaseIntent: purchaseIntentSchema,
  confirmPurchase: confirmPurchaseSchema,
  confirmRefund: confirmRefundSchema,
  confirmUseTicket: confirmUseTicketSchema,
  queryTickets: queryTicketsSchema,
  tokenIdParams: tokenIdParamsSchema,
  walletAddressParams: walletAddressParamsSchema,
  eventIdParams: eventIdParamsSchema,
  userTicketsQuery: userTicketsQuerySchema
};
