import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import logger from '../../config/logger.js';
import { BadRequestError } from '../../utils/customErrors.js';

/**
 * Upload Service for handling Cloudinary image uploads
 * Supports avatar uploads, event image uploads, and image deletion
 */
class UploadService {
  constructor() {
    this.configureCloudinary();
  }

  /**
   * Helper function to sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Upload with retry logic and exponential backoff
   * Retries up to 3 times for transient failures (network timeouts, 5xx errors)
   * Handles rate limiting (429) with retry-after header
   *
   * @param {Function} uploadFn - Upload function to execute
   * @param {Object} context - Context for logging (userId, eventId, filename)
   * @returns {Promise<Object>} Upload result
   */
  async uploadWithRetry(uploadFn, context = {}) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Attempt the upload
        const result = await uploadFn();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          logger.info('Upload succeeded after retry', {
            ...context,
            attempt: attempt + 1,
            totalAttempts: maxRetries
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Log the error
        logger.warn('Upload attempt failed', {
          ...context,
          attempt: attempt + 1,
          totalAttempts: maxRetries,
          error: error.message,
          httpCode: error.http_code || error.statusCode,
          timestamp: new Date().toISOString()
        });

        // Check if this is a client error (4xx) - don't retry except for 429
        const httpCode = error.http_code || error.statusCode;
        if (httpCode >= 400 && httpCode < 500 && httpCode !== 429) {
          logger.error('Client error, not retrying', {
            ...context,
            httpCode,
            error: error.message
          });
          throw error;
        }

        // Handle rate limiting (429)
        if (httpCode === 429) {
          // Get retry-after header value (in seconds)
          const retryAfter = error.headers?.['retry-after'] || (attempt + 1);
          const waitTime = parseInt(retryAfter, 10) * 1000;

          logger.info('Rate limited, waiting before retry', {
            ...context,
            retryAfter: retryAfter,
            waitTimeMs: waitTime,
            attempt: attempt + 1,
            timestamp: new Date().toISOString()
          });

          await this.sleep(waitTime);
          continue;
        }

        // For other errors (network timeouts, 5xx), apply exponential backoff
        // Don't wait after the last attempt
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 0s (attempt 0), 1s (attempt 1), 2s (attempt 2)
          const backoffTime = attempt * 1000;

          if (backoffTime > 0) {
            logger.info('Applying exponential backoff', {
              ...context,
              attempt: attempt + 1,
              backoffMs: backoffTime,
              timestamp: new Date().toISOString()
            });

            await this.sleep(backoffTime);
          }
        }
      }
    }

    // All retries exhausted
    logger.error('Upload failed after maximum retries', {
      ...context,
      totalAttempts: maxRetries,
      error: lastError.message,
      stack: lastError.stack,
      timestamp: new Date().toISOString()
    });

    const error = new Error('Upload failed after maximum retries');
    error.code = 'SERVICE_UNAVAILABLE';
    error.retries = maxRetries;
    error.cause = lastError;
    throw error;
  }

  /**
   * Configure Cloudinary client with environment-specific credentials
   * Supports dev/prod environment separation
   */
  configureCloudinary() {
    const nodeEnv = process.env.NODE_ENV?.toUpperCase();

    // Choose credentials based on environment
    let cloudName, apiKey, apiSecret;

    if ((nodeEnv === 'DEV' || nodeEnv === 'DEVELOPMENT') && process.env.CLOUDINARY_STAG_NAME) {
      cloudName = process.env.CLOUDINARY_STAG_NAME;
      apiKey = process.env.CLOUDINARY_STAG_KEY;
      apiSecret = process.env.CLOUDINARY_STAG_SECRET;
    } else if ((nodeEnv === 'PROD' || nodeEnv === 'PRODUCTION') && process.env.CLOUDINARY_STAG_NAME) {
      cloudName = process.env.CLOUDINARY_STAG_NAME;
      apiKey = process.env.CLOUDINARY_STAG_KEY;
      apiSecret = process.env.CLOUDINARY_STAG_SECRET;
    } else {
      // Fallback to base credentials
      cloudName = process.env.CLOUDINARY_NAME;
      apiKey = process.env.CLOUDINARY_KEY;
      apiSecret = process.env.CLOUDINARY_SECRET;
    }

    // Validate required credentials
    if (!cloudName || !apiKey || !apiSecret) {
      const missing = [];
      if (!cloudName) missing.push('CLOUDINARY_NAME');
      if (!apiKey) missing.push('CLOUDINARY_KEY');
      if (!apiSecret) missing.push('CLOUDINARY_SECRET');

      logger.error('Cloudinary configuration error', {
        environment: nodeEnv,
        missingVariables: missing,
        timestamp: new Date().toISOString()
      });

      const error = new Error(
        `Cloudinary configuration error: Missing required environment variables: ${missing.join(', ')}`
      );
      error.code = 'CLOUDINARY_CONFIG_ERROR';
      error.missingVars = missing;
      throw error;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    logger.info('Cloudinary configured successfully', {
      environment: nodeEnv,
      cloudName
    });
  }

  /**
   * Upload avatar image with transformations
   * @param {Object} file - Multer file object
   * @param {string} userId - User ID for filename generation
   * @param {string|null} oldAvatarUrl - URL of existing avatar to delete
   * @returns {Promise<Object>} Upload result with URL and metadata
   */
  async uploadAvatar(file, userId, oldAvatarUrl = null) {
    try {
      // Delete old avatar if exists
      if (oldAvatarUrl) {
        try {
          await this.deleteImage(oldAvatarUrl);
          logger.info('Old avatar deleted', { userId, oldAvatarUrl });
        } catch (error) {
          // Log but don't fail if old avatar deletion fails
          logger.warn('Failed to delete old avatar', {
            userId,
            oldAvatarUrl,
            error: error.message
          });
        }
      }

      // Generate unique filename
      const filename = this.generateUniqueFilename('avatar', userId, file.originalname);

      // Get base folder from env or use default
      const baseFolder = process.env.CLOUDINARY_UPLOAD_FOLDER || '';
      const folder = baseFolder ? `${baseFolder}/avatars` : 'avatars';

      // Upload to Cloudinary using stream to avoid memory issues
      const result = await this.uploadWithRetry(
        () => this.uploadToCloudinaryStream(file, {
          folder: folder,
          public_id: filename,
          resource_type: 'image',
          access_mode: 'public',
          transformation: [
            { width: 400, height: 400, crop: 'fill' },
            { quality: 80 },
            { fetch_format: 'auto' }
          ]
        }),
        {
          userId,
          filename: file.originalname,
          operation: 'uploadAvatar'
        }
      );

      logger.info('Avatar uploaded successfully', {
        userId,
        publicId: result.public_id,
        url: result.secure_url
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      logger.error('Avatar upload failed', {
        userId,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Upload multiple event images with transformations
   * @param {Array<Object>} files - Array of multer file objects
   * @param {string} eventId - Event ID for folder organization
   * @returns {Promise<Object>} Upload results with URLs and metadata
   */
  async uploadEventImages(files, eventId) {
    const uploadedImages = [];
    const uploadedPublicIds = [];

    try {
      // Get base folder from env or use default
      const baseFolder = process.env.CLOUDINARY_UPLOAD_FOLDER || '';
      const folder = baseFolder ? `${baseFolder}/events/${eventId}` : `events/${eventId}`;

      // Upload each file sequentially to maintain order
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Generate unique filename for each image
        const filename = this.generateUniqueFilename(`image_${i + 1}`, eventId, file.originalname);

        // Upload to Cloudinary using stream to avoid memory issues
        const result = await this.uploadWithRetry(
          () => this.uploadToCloudinaryStream(file, {
            folder: folder,
            public_id: filename,
            resource_type: 'image',
            access_mode: 'public',
            transformation: [
              { width: 1920, height: 1080, crop: 'limit' },
              { quality: 80 },
              { fetch_format: 'auto' }
            ]
          }),
          {
            eventId,
            filename: file.originalname,
            imageNumber: i + 1,
            operation: 'uploadEventImages'
          }
        );

        // Store uploaded image info
        const imageInfo = {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes
        };

        uploadedImages.push(imageInfo);
        uploadedPublicIds.push(result.public_id);

        logger.info('Event image uploaded successfully', {
          eventId,
          imageNumber: i + 1,
          publicId: result.public_id,
          url: result.secure_url
        });
      }

      // Return all uploaded images info
      return {
        imageUrls: uploadedImages.map(img => img.url),
        publicIds: uploadedPublicIds,
        images: uploadedImages
      };
    } catch (error) {
      // Rollback: delete all successfully uploaded images
      logger.error('Event images upload failed, initiating rollback', {
        eventId,
        uploadedCount: uploadedPublicIds.length,
        totalFiles: files.length,
        error: error.message
      });

      // Delete all uploaded images
      if (uploadedPublicIds.length > 0) {
        await Promise.allSettled(
          uploadedPublicIds.map(publicId =>
            cloudinary.uploader.destroy(publicId).catch(deleteError => {
              logger.warn('Failed to delete image during rollback', {
                publicId,
                error: deleteError.message
              });
            })
          )
        );

        logger.info('Rollback completed', {
          eventId,
          deletedCount: uploadedPublicIds.length
        });
      }

      // Re-throw the original error
      logger.error('Event images upload failed', {
        eventId,
        filesCount: files.length,
        filenames: files.map(f => f.originalname),
        fileSizes: files.map(f => f.size),
        mimeTypes: files.map(f => f.mimetype),
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Extract public_id from Cloudinary URL using optimized regex
   * @param {string} url - Cloudinary image URL
   * @returns {string|null} Public ID
   */
  extractPublicId(url) {
    if (!url) {
      return null;
    }

    // Regex: Lấy tất cả sau 'upload/', bỏ qua version 'v1234/', và loại bỏ extension
    const extractRegex = /upload\/(?:v\d+\/)?(?:[^\/]+\/)*(.*)\.[a-zA-Z0-9]+$/;
    const match = url.match(extractRegex);

    if (match && match[1]) {
      return match[1];
    }

    logger.warn('Could not extract publicId from URL', { url });
    return null;
  }

  /**
   * Upload file to Cloudinary using stream (memory-efficient)
   * @param {Object} file - Multer file object
   * @param {Object} options - Cloudinary upload options
   * @returns {Promise<Object>} Upload result
   */
  uploadToCloudinaryStream(file, options) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result);
        }
      );

      // Nếu có buffer, tạo stream từ buffer
      if (file.buffer) {
        const bufferStream = Readable.from(file.buffer);
        bufferStream.pipe(uploadStream);
      }
      // Nếu có path, đọc file từ disk
      else if (file.path) {
        const fs = require('fs');
        fs.createReadStream(file.path).pipe(uploadStream);
      }
      else {
        reject(new BadRequestError('File must have either buffer or path'));
      }
    });
  }

  /**
   * Delete a single image from Cloudinary
   * @param {string} imageUrl - Cloudinary image URL
   * @returns {Promise<Object>} Deletion result
   */
  async deleteImage(imageUrl) {
    try {
      const publicId = this.extractPublicId(imageUrl);

      if (!publicId) {
        logger.warn('Could not extract publicId from URL', { imageUrl });
        return { success: true, message: 'No valid publicId found' };
      }

      const result = await cloudinary.uploader.destroy(publicId);

      logger.info('Image deleted from Cloudinary', {
        publicId,
        result: result.result
      });

      return {
        success: true,
        publicId,
        result: result.result
      };
    } catch (error) {
      logger.error('Failed to delete image from Cloudinary', {
        imageUrl,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // Return success even if deletion fails (idempotent)
      return {
        success: true,
        message: 'Deletion attempted',
        error: error.message
      };
    }
  }

  /**
   * Delete multiple images from Cloudinary
   * @param {Array<string>} imageUrls - Array of Cloudinary image URLs
   * @returns {Promise<Object>} Deletion results
   */
  async deleteMultipleImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
      return { success: true, deleted: [] };
    }

    const results = await Promise.allSettled(
      imageUrls.map(url => this.deleteImage(url))
    );

    const deleted = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    if (failed.length > 0) {
      logger.warn('Some images failed to delete', {
        failedCount: failed.length,
        totalCount: imageUrls.length
      });
    }

    return {
      success: true,
      deleted,
      failedCount: failed.length
    };
  }

  /**
   * Generate unique filename with UUID
   * @param {string} type - File type (avatar, event)
   * @param {string} id - User or event ID
   * @param {string} originalName - Original filename
   * @returns {string} Sanitized unique filename
   */
  generateUniqueFilename(type, id, originalName) {
    // Sanitize the original filename
    const sanitized = this.sanitizeFilename(originalName);

    // Extract extension from sanitized filename
    const lastDotIndex = sanitized.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? sanitized.substring(lastDotIndex) : '';

    // Generate unique filename: {type}_{id}_{uuid}
    const uuid = randomUUID();
    const filename = `${type}_${id}_${uuid}${extension}`;

    return filename;
  }

  /**
   * Sanitize filename to prevent path traversal
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    if (!filename) {
      return '';
    }

    // Remove path traversal patterns
    let sanitized = filename.replace(/\.\.[/\\]/g, '');
    sanitized = sanitized.replace(/\.\.\\/g, '');
    sanitized = sanitized.replace(/\.\.\//g, '');

    // Remove any remaining path separators at the start
    sanitized = sanitized.replace(/^[/\\]+/, '');

    // Replace spaces and special characters with underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Remove multiple consecutive underscores
    sanitized = sanitized.replace(/_+/g, '_');

    // Remove leading/trailing underscores and dots
    sanitized = sanitized.replace(/^[._]+|[._]+$/g, '');

    return sanitized;
  }
}

// Export class for dependency injection
export default UploadService;
