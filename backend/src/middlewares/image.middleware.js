import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import logger from '../config/logger.js';
import { BadRequestError } from '../utils/customErrors.js';

/**
 * Image Validation Middleware
 * Handles multipart/form-data uploads with validation for image files
 * Validates MIME types using file-type library for robust magic bytes detection
 */

// Valid image MIME types
const VALID_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Configuration from environment variables
const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10);
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_EVENT_IMAGES = parseInt(process.env.MAX_EVENT_IMAGES || '10', 10);

/**
 * Validate file type using file-type library
 * More robust than manual magic bytes checking
 * @param {Buffer} buffer - File buffer
 * @param {string} declaredMimeType - Declared MIME type from multer
 * @returns {Promise<boolean>} True if file type matches declared MIME type
 */
async function validateFileType(buffer, declaredMimeType) {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  try {
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType) {
      return false;
    }

    return detectedType.mime === declaredMimeType;
  } catch (error) {
    logger.error('File type detection error', { error: error.message });
    return false;
  }
}

/**
 * File filter function for multer
 * Validates MIME type and file extension
 * @param {Object} req - Express request
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback function
 */
function imageFileFilter(req, file, cb) {
  // Validate MIME type
  if (!VALID_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('Invalid image format');
    error.code = 'INVALID_IMAGE_FORMAT';
    error.details = [`File '${file.originalname}' is not a valid image`];
    return cb(error, false);
  }

  // Validate file extension matches MIME type
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  const expectedExtensions = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp']
  };

  const validExtensions = expectedExtensions[file.mimetype] || [];
  if (!validExtensions.includes(extension)) {
    const error = new Error('File content does not match declared type');
    error.code = 'FILE_TYPE_MISMATCH';
    error.details = [`File '${file.originalname}' extension does not match MIME type ${file.mimetype}`];
    return cb(error, false);
  }

  cb(null, true);
}

/**
 * Multer configuration for avatar upload (single file)
 */
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES
  },
  fileFilter: imageFileFilter
}).single('avatar');

/**
 * Multer configuration for event images upload (multiple files)
 */
const uploadEventImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_EVENT_IMAGES
  },
  fileFilter: imageFileFilter
}).array('images', MAX_EVENT_IMAGES);

/**
 * Middleware to validate single image after multer processing
 * Performs file type validation using file-type library
 * @param {Object} req - Express request
 * @param {Object} _res - Express response (unused)
 * @param {Function} next - Next middleware
 */
async function validateSingleImage(req, _res, next) {
  // If no file uploaded, skip validation
  if (!req.file) {
    return next();
  }

  const { file } = req;

  // Validate file type
  const isValid = await validateFileType(file.buffer, file.mimetype);

  if (!isValid) {
    logger.warn('File type validation failed', {
      filename: file.originalname,
      declaredMimetype: file.mimetype,
      size: file.size
    });

    const error = new BadRequestError(`File '${file.originalname}' content does not match declared type`);
    error.code = 'FILE_TYPE_MISMATCH';
    return next(error);
  }

  next();
}

/**
 * Middleware to validate multiple images after multer processing
 * Performs file type validation on all files using file-type library
 * @param {Object} req - Express request
 * @param {Object} _res - Express response (unused)
 * @param {Function} next - Next middleware
 */
async function validateMultipleImages(req, _res, next) {
  // If no files uploaded, skip validation
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const { files } = req;
  const invalidFiles = [];

  // Validate file type for each file
  for (const file of files) {
    const isValid = await validateFileType(file.buffer, file.mimetype);
    if (!isValid) {
      invalidFiles.push(file.originalname);
    }
  }

  if (invalidFiles.length > 0) {
    logger.warn('File type validation failed for multiple files', {
      invalidFiles,
      totalFiles: files.length
    });

    const error = new BadRequestError('File content does not match declared type');
    error.code = 'FILE_TYPE_MISMATCH';
    error.details = invalidFiles.map(name => `File '${name}' content does not match declared type`);
    return next(error);
  }

  next();
}

/**
 * Error handler for multer errors
 * Converts multer errors to consistent error format
 * @param {Error} err - Error object
 * @param {Object} _req - Express request (unused)
 * @param {Object} _res - Express response (unused)
 * @param {Function} next - Next middleware
 */
export function handleMulterError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    logger.warn('Multer error', {
      code: err.code,
      field: err.field,
      message: err.message
    });

    // Handle specific multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      const error = new BadRequestError(`File size exceeds ${MAX_IMAGE_SIZE_MB}MB limit`);
      error.code = 'FILE_SIZE_EXCEEDED';
      return next(error);
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      const error = new BadRequestError('Too many files');
      error.code = 'TOO_MANY_FILES';
      error.details = [`Maximum ${MAX_EVENT_IMAGES} images allowed`];
      return next(error);
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const error = new BadRequestError('Unexpected field');
      error.code = 'UNEXPECTED_FIELD';
      error.details = [`Unexpected file field: ${err.field}`];
      return next(error);
    }

    // Generic multer error
    const error = new BadRequestError('File upload error');
    error.code = 'UPLOAD_ERROR';
    error.details = [err.message];
    return next(error);
  }

  // Handle custom validation errors
  if (err.code === 'INVALID_IMAGE_FORMAT' || err.code === 'FILE_TYPE_MISMATCH') {
    const error = new BadRequestError(err.message);
    error.code = err.code;
    error.details = err.details || [err.message];
    return next(error);
  }

  // Pass other errors to next error handler
  next(err);
}

export {
  uploadAvatar,
  uploadEventImages,
  validateSingleImage,
  validateMultipleImages,
  imageFileFilter,
  validateFileType,
  VALID_MIME_TYPES,
  MAX_IMAGE_SIZE_MB,
  MAX_IMAGE_SIZE_BYTES,
  MAX_EVENT_IMAGES
};
