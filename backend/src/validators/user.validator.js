import Joi from 'joi';

// Schema for PATCH /users/profile
const updateProfileSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .message('username must contain only alphanumeric characters and underscores')
    .optional(),
  email: Joi.string()
    .email()
    .optional(),
  avatarUrl: Joi.string()
    .uri()
    .optional()
}).min(1); // At least one field must be provided

export const userSchemas = {
  updateProfile: updateProfileSchema
};
