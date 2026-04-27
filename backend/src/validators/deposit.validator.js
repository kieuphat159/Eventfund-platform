import Joi from "joi";
import config from "../config/env.js";

export const depositSchemas = {
  createDeposit: Joi.object({
    vndAmount: Joi.number()
      .integer()
      .min(config.deposits.minVND)
      .max(config.deposits.maxVND)
      .required()
      .messages({
        "number.base": "vndAmount must be a number",
        "number.integer": "vndAmount must be an integer",
        "number.min": `vndAmount must be at least ${config.deposits.minVND.toLocaleString()} VND`,
        "number.max": `vndAmount must not exceed ${config.deposits.maxVND.toLocaleString()} VND`,
        "any.required": "vndAmount is required",
      }),
  }),
};
