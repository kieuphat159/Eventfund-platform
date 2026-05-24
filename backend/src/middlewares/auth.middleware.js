import asyncHandler from '../utils/asyncHandler.js';
import JWTService from '../services/auth/jwt.service.js';
import * as userRepo from '../repositories/user.repo.js';
import { UnauthorizedError } from '../utils/customErrors.js';
import cacheService from '../services/cache/redis.service.js';
import logger from '../config/logger.js';

const jwtService = new JWTService();

/**
 * Core helper: Trích xuất, kiểm tra token và tìm User
 * - Nếu không có token: Trả về null
 * - Nếu token/user sai: Ném lỗi UnauthorizedError
 * - Sử dụng Redis cache để giảm DB queries
 */
async function resolveUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const verificationResult = jwtService.verifyToken(token);

  if (!verificationResult.valid) {
    const isExpired = verificationResult.error?.includes('expired');
    throw new UnauthorizedError(
      verificationResult.error || 'Invalid token',
      isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    );
  }

  const { walletAddress } = verificationResult.payload;

  // Try to get user from cache first
  let user = await cacheService.getUser(walletAddress);

  if (user) {
    logger.debug('User loaded from cache', { walletAddress });
  } else {
    // Cache miss - load from database
    user = await userRepo.findByWalletAddress(walletAddress);

    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }

    // Cache the user profile for future requests
    const userToCache = {
      _id: user._id,
      walletAddress: user.walletAddress,
      smartAccountAddress: user.smartAccountAddress,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
    };

    await cacheService.cacheUser(walletAddress, userToCache);
    logger.debug('User cached', { walletAddress });

    user = userToCache;
  }

  if (!user.isActive) {
    throw new UnauthorizedError('User account is inactive', 'USER_INACTIVE');
  }

  // Return safe user object
  return {
    _id: user._id,
    walletAddress: user.walletAddress,
    smartAccountAddress: user.smartAccountAddress,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
  };
}

/**
 * Middleware: Bắt buộc đăng nhập
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const user = await resolveUserFromRequest(req);

  if (!user) {
    throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
  }

  req.user = user;
  next();
});

/**
 * Middleware: Đăng nhập thì tốt, không thì thôi (Public/Guest)
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Silently fail for optional auth - user continues as guest
    logger.debug('Optional auth failed (continuing as guest)', {
      error: error.message,
      code: error.code
    });
  }
  next();
});