import asyncHandler from '../utils/asyncHandler.js';
import JWTService from '../services/auth/jwt.service.js';
import * as userRepo from '../repositories/user.repo.js'; // Dùng Repo thay cho Model
import { UnauthorizedError } from '../utils/customErrors.js'; // Dùng Custom Error

const jwtService = new JWTService();

/**
 * Core helper: Trích xuất, kiểm tra token và tìm User
 * - Nếu không có token: Trả về null
 * - Nếu token/user sai: Ném lỗi UnauthorizedError
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

  // Dùng Repository thay vì gọi Model trực tiếp
  const user = await userRepo.findByWalletAddress(walletAddress);

  if (!user) {
    throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('User account is inactive', 'USER_INACTIVE');
  }

  // Chỉ đính kèm các trường an toàn, không nhét cả cục Mongoose Document vào req
  return {
    _id: user._id,
    walletAddress: user.walletAddress,
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
    // Nuốt lỗi (Silently fail) vì đây là Optional. Client vẫn truy cập được với tư cách Guest
  }
  next();
});