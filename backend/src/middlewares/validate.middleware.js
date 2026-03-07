import { BadRequestError } from '../utils/customErrors.js';

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
        const { error, value } = schema[target].validate(req[target], {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          // Gom mảng lỗi
          error.details.forEach((detail) => {
            errors.push({
              field: detail.path.join('.'),
              message: detail.message.replace(/"/g, ''), // Gọt bỏ dấu ngoặc kép Joi tự sinh ra cho đẹp
              type: detail.type,
            });
          });
        } else {
          // Lưu dữ liệu đã được làm sạch
          validated[target] = value;
        }
      }
    });

    // 2. Chuyển giao nhiệm vụ cho Global Error Handler
    if (errors.length > 0) {
      // Always use generic message for consistency
      const mainMessage = 'Validation failed';
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
