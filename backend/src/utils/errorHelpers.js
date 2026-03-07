/**
 * Error Response Helpers
 * Provides consistent error response formatting for the API
 */

/**
 * Create a validation error response (400)
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Array<string>} details - Optional error details
 * @returns {Object} Error response object
 */
export function createValidationError(message, code, details = []) {
  return {
    success: false,
    error: {
      message,
      code,
      ...(details.length > 0 && { details })
    }
  };
}

/**
 * Create a server error response (500)
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Array<string>} details - Optional error details
 * @returns {Object} Error response object
 */
export function createServerError(message, code, details = []) {
  return {
    success: false,
    error: {
      message,
      code,
      ...(details.length > 0 && { details })
    }
  };
}

/**
 * Create a service unavailable error response (503)
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Array<string>} details - Optional error details
 * @returns {Object} Error response object
 */
export function createServiceUnavailableError(message, code, details = []) {
  return {
    success: false,
    error: {
      message,
      code,
      ...(details.length > 0 && { details })
    }
  };
}

/**
 * Common error responses for image upload
 */
export const ImageUploadErrors = {
  INVALID_FORMAT: () => createValidationError(
    'Invalid image format',
    'INVALID_IMAGE_FORMAT'
  ),

  FILE_SIZE_EXCEEDED: (maxSize = 5) => createValidationError(
    `File size exceeds ${maxSize}MB limit`,
    'FILE_SIZE_EXCEEDED'
  ),

  TOO_MANY_FILES: (maxFiles = 10) => createValidationError(
    'Too many files',
    'TOO_MANY_FILES',
    [`Maximum ${maxFiles} images allowed`]
  ),

  MAGIC_BYTES_MISMATCH: (filename) => createValidationError(
    'File content does not match declared type',
    'MAGIC_BYTES_MISMATCH',
    [`File '${filename}' has invalid magic bytes`]
  ),

  CLOUDINARY_CONFIG_ERROR: (missingVars) => createServerError(
    'Image upload service misconfigured',
    'CLOUDINARY_CONFIG_ERROR',
    [`Missing environment variables: ${missingVars.join(', ')}`]
  ),

  CLOUDINARY_UPLOAD_ERROR: (details) => createServerError(
    'Failed to upload image to Cloudinary',
    'CLOUDINARY_UPLOAD_ERROR',
    Array.isArray(details) ? details : [details]
  ),

  SERVICE_UNAVAILABLE: (retries = 3) => createServiceUnavailableError(
    'Image upload service temporarily unavailable',
    'SERVICE_UNAVAILABLE',
    [`Failed after ${retries} retry attempts`]
  )
};
