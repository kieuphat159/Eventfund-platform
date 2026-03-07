import Joi from 'joi';

// Schema for PATCH /users/profile
// Note: avatarUrl is NOT allowed here - it must be uploaded via multipart/form-data
// and processed by the backend to prevent XSS attacks and malicious URLs
const updateProfileSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .message('username must contain only alphanumeric characters and underscores')
    .optional(),
  email: Joi.string()
    .email()
    .optional()
})
  .min(1); // Require at least one field
  // Allow unknown fields to be stripped by middleware's stripUnknown: true

// Schema for GET /users/:walletAddress params
const walletAddressParamsSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/i) // Case-insensitive flag
    .message('walletAddress must be a valid Ethereum address (0x followed by 40 hex characters)')
    .required()
});

export const userSchemas = {
  updateProfile: updateProfileSchema,
  walletAddressParams: walletAddressParamsSchema
};
