import Joi from "joi";

// Custom validator for Ethereum address
const ethereumAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .message("must be a valid Ethereum address");

// Custom validator for MongoDB ObjectId
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("must be a valid MongoDB ObjectId");

// Custom validator for positive BigInt string
const positiveBigIntString = Joi.string()
  .pattern(/^[1-9][0-9]*$/)
  .message("must be a valid positive integer string");

// Listing status enum
const listingStatusEnum = ["active", "sold", "cancelled", "expired"];

// Schema for POST /marketplace/listings
const createListingSchema = Joi.object({
  ticketId: objectId.required(),
  price: positiveBigIntString.required(),
  maxPrice: positiveBigIntString.optional(),
  expiresAt: Joi.date().iso().required(),
});

const createListingIntentSchema = Joi.object({
  ticketId: objectId.required(),
  price: positiveBigIntString.required(),
});

const txHashSchema = Joi.string()
  .pattern(/^0x([A-Fa-f0-9]{64})$/)
  .message("must be a valid transaction hash");

const confirmSoldTransactionSchema = Joi.object({
  txHash: txHashSchema.required(),
  listingId: objectId.optional(),
  buyerWallet: ethereumAddress.optional(),
});

// Schema for GET /marketplace/listings query parameters
const queryListingsSchema = Joi.object({
  eventId: objectId.optional(),
  seller: ethereumAddress.optional(),
  status: Joi.string()
    .valid(...listingStatusEnum)
    .optional(),
  minPrice: positiveBigIntString.optional(),
  maxPrice: positiveBigIntString.optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().valid("price", "listedAt", "expiresAt").optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});

// Schema for GET /marketplace/history query parameters
const queryHistorySchema = Joi.object({
  eventId: objectId.optional(),
  seller: ethereumAddress.optional(),
  buyer: ethereumAddress.optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().valid("soldAt", "price", "listedAt").optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});

export const marketplaceSchemas = {
  createListing: createListingSchema,
  createListingIntent: createListingIntentSchema,
  confirmSoldTransaction: confirmSoldTransactionSchema,
  queryListings: queryListingsSchema,
  queryHistory: queryHistorySchema,
};
