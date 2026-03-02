/**
 * Validation middleware using Joi
 * Validates request body, params, and query against schemas
 */

/**
 * Validate request data against Joi schemas
 * Validates req.body, req.params, and req.query
 * Attaches validated data to req.validated
 *
 * @param {Object} schema - Validation schema object
 * @param {Object} schema.body - Joi schema for request body
 * @param {Object} schema.params - Joi schema for request params
 * @param {Object} schema.query - Joi schema for request query
 * @returns {Function} Express middleware function
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const validated = {};

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          errors.push({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          });
        });
      } else {
        validated.body = value;
      }
    }

    // Validate params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          errors.push({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          });
        });
      } else {
        validated.params = value;
      }
    }

    // Validate query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          errors.push({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          });
        });
      } else {
        validated.query = value;
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors,
        },
      });
    }

    // Attach validated data to request
    req.validated = validated;

    next();
  };
}
