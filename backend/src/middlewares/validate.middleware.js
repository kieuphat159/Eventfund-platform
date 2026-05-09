import { BadRequestError } from '../utils/customErrors.js';

function normalizeMultipartValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMultipartValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        normalizeMultipartValue(entryValue),
      ])
    );
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const looksLikeJson =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'));

    if (looksLikeJson) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }

  return value;
}

/**
 * Validate request data against Joi schemas
 * Validates req.body, req.params, and req.query dynamically
 * Attaches validated data to req.validated
 */
export function validate(schema) {
  return (req, _res, next) => {
    const errors = [];
    const validated = {};

    // 1. Kỹ thuật DRY: Dùng vòng lặp thay vì viết lại 3 lần
    const validationTargets = ['body', 'params', 'query'];

    validationTargets.forEach((target) => {
      if (schema[target]) {
        const rawValue = target === 'body' ? normalizeMultipartValue(req[target]) : req[target];
        const { error: normalizedError, value: normalizedValue } = schema[target].validate(rawValue, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (normalizedError) {
          // Gom mảng lỗi
          normalizedError.details.forEach((detail) => {
            errors.push({
              field: detail.path.join('.'),
              message: detail.message.replace(/"/g, ''), // Gọt bỏ dấu ngoặc kép Joi tự sinh ra cho đẹp
              type: detail.type,
            });
          });
        } else {
          // Lưu dữ liệu đã được làm sạch
          validated[target] = normalizedValue;
        }
      }
    });

    // 2. Chuyển giao nhiệm vụ cho Global Error Handler
    if (errors.length > 0) {
      // Use first error message if only one error, otherwise generic message
      const mainMessage = errors.length === 1 ? errors[0].message : 'Validation failed';
      const validationError = new BadRequestError(mainMessage);
      validationError.code = 'VALIDATION_ERROR';
      validationError.details = errors; // error.middleware.js sẽ tự động nhặt cái details này!
      return next(validationError);
    }

    // 3. Đính kèm data an toàn vào request
    req.validated = validated;

    next();
  };
}
