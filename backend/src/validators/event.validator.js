import Joi from "joi";

// Custom validator for Ethereum address
const ethereumAddress = Joi.string()
  .pattern(/^0x[a-fA-F0-9]{40}$/)
  .message("must be a valid Ethereum address");

// Custom validator for BigInt string
const bigIntString = Joi.string()
  .pattern(/^[0-9]+$/)
  .message("must be a valid positive integer string");

const txHashSchema = Joi.string()
  .pattern(/^0x([A-Fa-f0-9]{64})$/)
  .message("must be a valid transaction hash");

// Venue schema
const venueSchema = Joi.object({
  address: Joi.string().trim().required(),
});

const ticketTierSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Ticket tier name is required",
    "any.required": "Ticket tier name is required",
  }),
  price: Joi.number().min(0).required().messages({
    "number.base": "Ticket tier price must be a number",
    "number.min": "Ticket tier price must be at least 0",
    "any.required": "Ticket tier price is required",
  }),
  totalSupply: Joi.number().integer().min(1).required().messages({
    "number.base": "Ticket tier supply must be a number",
    "number.integer": "Ticket tier supply must be an integer",
    "number.min": "Ticket tier supply must be at least 1",
    "any.required": "Ticket tier supply is required",
  }),
  benefits: Joi.array().items(Joi.string().trim()).optional(),
});

// Event status enum
const eventStatusEnum = [
  "draft",
  "funding",
  "funded",
  "ticketing",
  "ongoing",
  "completed",
  "cancelled",
  "failed",
];

// Schema for POST /events
const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    "string.empty": "Title is required",
    "string.min": "Title must be at least 3 characters long",
    "string.max": "Title must not exceed 200 characters",
    "any.required": "Title is required",
  }),
  description: Joi.string().min(1).required().messages({
    "string.empty": "Description is required",
    "any.required": "Description is required",
  }),
  category: Joi.string().optional(),
  investmentEnabled: Joi.boolean().optional(),
  organizerAddress: ethereumAddress.optional(),
  organizerStake: bigIntString.optional(),
  fundingGoal: bigIntString.optional(),
  minStakeRequired: bigIntString.optional(),
  minInvestmentAmount: bigIntString.optional(),
  fundingDeadline: Joi.date().iso().optional().messages({
    "date.base": "Funding deadline must be a valid date",
  }),
  startDate: Joi.date().iso().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),
  ticketingStartAt: Joi.date().iso().optional().messages({
    "date.base": "Ticketing start must be a valid date",
  }),
  ticketingEndAt: Joi.date().iso().optional().messages({
    "date.base": "Ticketing end must be a valid date",
  }),
  venue: venueSchema.required().messages({
    "any.required": "Venue is required",
  }),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).required().messages({
    "number.base": "Total tickets must be a number",
    "number.integer": "Total tickets must be an integer",
    "number.min": "Total tickets must be greater than 0",
    "any.required": "Total tickets is required",
  }),
  ticketTiers: Joi.array().items(ticketTierSchema).min(1).optional().messages({
    "array.base": "Ticket tiers must be an array",
    "array.min": "At least one ticket tier is required",
  }),
  ticketUsageThreshold: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .optional()
    .messages({
      "number.min": "Ticket usage threshold must be at least 0",
      "number.max": "Ticket usage threshold must not exceed 100",
    }),
  // Optional on-chain execution mode for Fund.createEvent
  syncOnChain: Joi.boolean().optional(),
  organizerShareBps: Joi.number().integer().min(0).max(10000).optional(),
  ticketPrice: bigIntString.optional(),
  usedThreshold: Joi.number().integer().min(1).optional(),
})
  .custom((value, helpers) => {
    if (value.investmentEnabled === true) {
      const fundingGoal =
        value.fundingGoal === undefined ? undefined : BigInt(value.fundingGoal);
      const minInvestmentAmount =
        value.minInvestmentAmount === undefined
          ? undefined
          : BigInt(value.minInvestmentAmount);

      if (fundingGoal === undefined || fundingGoal <= 0n) {
        return helpers.error("any.custom", {
          message:
            "Funding goal is required and must be a positive integer string when investment is enabled",
        });
      }

      if (minInvestmentAmount === undefined || minInvestmentAmount <= 0n) {
        return helpers.error("any.custom", {
          message:
            "Minimum investment amount is required and must be a positive integer string when investment is enabled",
        });
      }

      if (!value.fundingDeadline) {
        return helpers.error("any.custom", {
          message: "Funding deadline is required when investment is enabled",
        });
      }
    }

    const fundingGoal =
      value.fundingGoal === undefined ? undefined : BigInt(value.fundingGoal);

    if (
      fundingGoal !== undefined &&
      fundingGoal > 0n &&
      !value.fundingDeadline
    ) {
      return helpers.error("any.custom", {
        message:
          "Funding deadline is required when funding goal is greater than 0",
      });
    }

    if (value.ticketingEndAt && !value.ticketingStartAt) {
      return helpers.error("any.custom", {
        message: "ticketingStartAt is required when ticketingEndAt is provided",
      });
    }

    if (
      value.investmentEnabled !== false &&
      value.ticketingStartAt &&
      value.fundingDeadline &&
      new Date(value.ticketingStartAt) <= new Date(value.fundingDeadline)
    ) {
      return helpers.error("any.custom", {
        message: "ticketingStartAt must be after fundingDeadline",
      });
    }

    if (
      value.ticketingStartAt &&
      value.ticketingEndAt &&
      new Date(value.ticketingEndAt) <= new Date(value.ticketingStartAt)
    ) {
      return helpers.error("any.custom", {
        message: "ticketingEndAt must be after ticketingStartAt",
      });
    }

    if (
      value.ticketingEndAt &&
      value.startDate &&
      new Date(value.ticketingEndAt) >= new Date(value.startDate)
    ) {
      return helpers.error("any.custom", {
        message: "ticketingEndAt must be before event startDate",
      });
    }

    return value;
  }, "conditional funding validation")
  .messages({
    "any.custom": "{{#message}}",
  });

const createEventIntentSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    "string.empty": "Title is required",
    "string.min": "Title must be at least 3 characters long",
    "string.max": "Title must not exceed 200 characters",
    "any.required": "Title is required",
  }),
  description: Joi.string().min(1).required().messages({
    "string.empty": "Description is required",
    "any.required": "Description is required",
  }),
  category: Joi.string().optional(),
  investmentEnabled: Joi.boolean().optional(),
  organizerAddress: ethereumAddress.optional(),
  organizerStake: bigIntString.optional(),
  fundingGoal: bigIntString.optional(),
  minStakeRequired: bigIntString.optional(),
  minInvestmentAmount: bigIntString.optional(),
  fundingDeadline: Joi.date().iso().optional().messages({
    "date.base": "Funding deadline must be a valid date",
  }),
  startDate: Joi.date().iso().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),
  ticketingStartAt: Joi.date().iso().optional().messages({
    "date.base": "Ticketing start must be a valid date",
  }),
  ticketingEndAt: Joi.date().iso().optional().messages({
    "date.base": "Ticketing end must be a valid date",
  }),
  venue: venueSchema.required().messages({
    "any.required": "Venue is required",
  }),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).required().messages({
    "number.base": "Total tickets must be a number",
    "number.integer": "Total tickets must be an integer",
    "number.min": "Total tickets must be greater than 0",
    "any.required": "Total tickets is required",
  }),
  ticketTiers: Joi.array().items(ticketTierSchema).min(1).optional().messages({
    "array.base": "Ticket tiers must be an array",
    "array.min": "At least one ticket tier is required",
  }),
  ticketUsageThreshold: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .optional()
    .messages({
      "number.min": "Ticket usage threshold must be at least 0",
      "number.max": "Ticket usage threshold must not exceed 100",
    }),
  syncOnChain: Joi.boolean().optional(),
  organizerShareBps: Joi.number().integer().min(0).max(10000).optional(),
  ticketPrice: bigIntString.optional(),
  usedThreshold: Joi.number().integer().min(1).optional(),
})
  .custom((value, helpers) => {
    if (value.investmentEnabled === true) {
      const fundingGoal =
        value.fundingGoal === undefined ? undefined : BigInt(value.fundingGoal);
      const minInvestmentAmount =
        value.minInvestmentAmount === undefined
          ? undefined
          : BigInt(value.minInvestmentAmount);

      if (fundingGoal === undefined || fundingGoal <= 0n) {
        return helpers.error("any.custom", {
          message:
            "Funding goal is required and must be a positive integer string when investment is enabled",
        });
      }

      if (minInvestmentAmount === undefined || minInvestmentAmount <= 0n) {
        return helpers.error("any.custom", {
          message:
            "Minimum investment amount is required and must be a positive integer string when investment is enabled",
        });
      }

      if (!value.fundingDeadline) {
        return helpers.error("any.custom", {
          message: "Funding deadline is required when investment is enabled",
        });
      }
    }

    const fundingGoal =
      value.fundingGoal === undefined ? undefined : BigInt(value.fundingGoal);

    if (
      fundingGoal !== undefined &&
      fundingGoal > 0n &&
      !value.fundingDeadline
    ) {
      return helpers.error("any.custom", {
        message:
          "Funding deadline is required when funding goal is greater than 0",
      });
    }

    if (value.ticketingEndAt && !value.ticketingStartAt) {
      return helpers.error("any.custom", {
        message: "ticketingStartAt is required when ticketingEndAt is provided",
      });
    }

    if (
      value.investmentEnabled !== false &&
      value.ticketingStartAt &&
      value.fundingDeadline &&
      new Date(value.ticketingStartAt) <= new Date(value.fundingDeadline)
    ) {
      return helpers.error("any.custom", {
        message: "ticketingStartAt must be after fundingDeadline",
      });
    }

    if (
      value.ticketingStartAt &&
      value.ticketingEndAt &&
      new Date(value.ticketingEndAt) <= new Date(value.ticketingStartAt)
    ) {
      return helpers.error("any.custom", {
        message: "ticketingEndAt must be after ticketingStartAt",
      });
    }

    if (
      value.ticketingEndAt &&
      value.startDate &&
      new Date(value.ticketingEndAt) >= new Date(value.startDate)
    ) {
      return helpers.error("any.custom", {
        message: "ticketingEndAt must be before event startDate",
      });
    }

    return value;
  }, "conditional funding validation")
  .messages({
    "any.custom": "{{#message}}",
  });

// Schema for PATCH /events/:id
const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional().messages({
    "string.min": "Title must be at least 3 characters long",
    "string.max": "Title must not exceed 200 characters",
  }),
  description: Joi.string().min(1).optional(),
  category: Joi.string().optional(),
  startDate: Joi.date().iso().optional().messages({
    "date.base": "Start date must be a valid date",
  }),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).optional().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
  }),
  ticketingStartAt: Joi.date().iso().optional().messages({
    "date.base": "Ticketing start must be a valid date",
  }),
  ticketingEndAt: Joi.date().iso().optional().messages({
    "date.base": "Ticketing end must be a valid date",
  }),
  fundingGoal: bigIntString.optional().messages({
    "string.empty": "Funding goal must be a valid positive integer string",
  }),
  minStakeRequired: bigIntString.optional().messages({
    "string.empty": "Minimum stake must be a valid positive integer string",
  }),
  fundingDeadline: Joi.date().iso().optional().messages({
    "date.base": "Funding deadline must be a valid date",
  }),
  status: Joi.string()
    .valid(...eventStatusEnum)
    .optional()
    .messages({
      "any.only": `Status must be one of: ${eventStatusEnum.join(", ")}`,
    }),
  venue: venueSchema.optional(),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  metadataUri: Joi.string().optional(),
  totalTickets: Joi.number().integer().min(1).optional().messages({
    "number.base": "Total tickets must be a number",
    "number.integer": "Total tickets must be an integer",
    "number.min": "Total tickets must be greater than 0",
  }),
  ticketTiers: Joi.array().items(ticketTierSchema).min(1).optional().messages({
    "array.base": "Ticket tiers must be an array",
    "array.min": "At least one ticket tier is required",
  }),
  ticketUsageThreshold: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .optional()
    .messages({
      "number.min": "Ticket usage threshold must be at least 0",
      "number.max": "Ticket usage threshold must not exceed 100",
    }),
  reason: Joi.string().trim().min(1).optional(),
  txHash: txHashSchema.optional(),
  releaseTxHash: txHashSchema.optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Schema for GET /events query parameters
const queryEventsSchema = Joi.object({
  status: Joi.string()
    .valid(...eventStatusEnum)
    .optional()
    .messages({
      "any.only": `Status must be one of: ${eventStatusEnum.join(", ")}`,
    }),
  category: Joi.string().optional(),
  organizer: ethereumAddress.optional(),
  page: Joi.number().integer().min(1).optional().messages({
    "number.base": "Page must be a number",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    "number.base": "Limit must be a number",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100 (maximum allowed)",
  }),
  sort: Joi.string()
    .valid("createdAt", "startDate", "fundingDeadline", "title")
    .optional()
    .messages({
      "any.only":
        "Sort must be one of: createdAt, startDate, fundingDeadline, title",
    }),
  order: Joi.string().valid("asc", "desc").optional().messages({
    "any.only": "Order must be either asc or desc",
  }),
});

const investEventSchema = Joi.object({
  amount: bigIntString.required().messages({
    "string.empty": "Investment amount is required",
    "any.required": "Investment amount is required",
  }),
});

const confirmCreateEventSchema = Joi.object({
  txHash: txHashSchema.required(),
  draftEventId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "draftEventId must be a valid MongoDB ObjectId",
    }),
  organizerWallet: ethereumAddress.optional(),
});

const confirmInvestEventSchema = Joi.object({
  txHash: txHashSchema.required(),
  investorWallet: ethereumAddress.optional(),
});

const confirmContributionRefundSchema = Joi.object({
  txHash: txHashSchema.required(),
  investorWallet: ethereumAddress.optional(),
});

const markEventCompletedSchema = Joi.object({
  txHash: txHashSchema.optional(),
  releaseTxHash: txHashSchema.optional(),
});

export const eventSchemas = {
  createEvent: createEventSchema,
  createEventIntent: createEventIntentSchema,
  confirmCreateEvent: confirmCreateEventSchema,
  confirmInvestEvent: confirmInvestEventSchema,
  confirmContributionRefund: confirmContributionRefundSchema,
  updateEvent: updateEventSchema,
  queryEvents: queryEventsSchema,
  investEvent: investEventSchema,
  markEventCompleted: markEventCompletedSchema,
};
