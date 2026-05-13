import Joi from "joi";

// Schema for PATCH /users/profile
// Note: avatarUrl is NOT allowed here - it must be uploaded via multipart/form-data
// and processed by the backend to prevent XSS attacks and malicious URLs
const usernamePattern = /^[\p{L}\p{M}\p{N}_' \-]+$/u;

const updateProfileSchema = Joi.object({
  username: Joi.string()
    .trim()
    .min(3)
    .max(50)
    .pattern(usernamePattern)
    .message(
      "username must contain only letters, numbers, spaces, underscores, apostrophes, and hyphens",
    )
    .optional(),
  email: Joi.string().email().optional(),
  bio: Joi.string().trim().max(1000).allow("").optional(),
  location: Joi.string().trim().max(120).allow("").optional(),
}).min(0); // Allow empty body for avatar-only uploads
// Allow unknown fields to be stripped by middleware's stripUnknown: true

// Schema for GET /users/:walletAddress params
const walletAddressParamsSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/i) // Case-insensitive flag
    .message(
      "walletAddress must be a valid Ethereum address (0x followed by 40 hex characters)",
    )
    .required(),
});

export const userSchemas = {
  updateProfile: updateProfileSchema,
  walletAddressParams: walletAddressParamsSchema,
};
