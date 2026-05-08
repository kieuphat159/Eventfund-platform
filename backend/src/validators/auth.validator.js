import Joi from 'joi';

// Custom validator for Ethereum address
const ethereumAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .messages({
    'string.pattern.base': 'must be a valid Ethereum address (0x followed by 40 hexadecimal characters)'
  });

// Custom validator for Ethereum signature
const ethereumSignature = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{130}$/)
  .message('must be a valid Ethereum signature (0x followed by 130 hexadecimal characters)');

// Schema for POST /auth/nonce
const nonceSchema = Joi.object({
  walletAddress: ethereumAddress.required()
});

// Schema for POST /auth/message
const messageSchema = Joi.object({
  walletAddress: ethereumAddress.required(),
  chainId: Joi.number().integer().positive().optional()
});

// Schema for POST /auth/verify
const verifySchema = Joi.object({
  message: Joi.string().min(1).required(),
  signature: ethereumSignature.required(),
  smartAccountAddress: ethereumAddress.optional()
});

export const authSchemas = {
  nonce: nonceSchema,
  message: messageSchema,
  verify: verifySchema
};
