import asyncHandler from '../utils/asyncHandler.js';
import * as usersService from '../services/users/users.service.js';
import { convertBigIntToString } from '../utils/bigint.js';

/**
 * UsersController - Handles user profile and portfolio endpoints
 */
class UsersController {
  constructor(service = usersService) {
    this.usersService = service;
  }

  getProfile = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get user profile
    const user = await this.usersService.getProfile(req.user.walletAddress);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: convertBigIntToString(user)
    });
  });

  updateProfile = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;

    // Update profile
    const user = await this.usersService.updateProfile(req.user.walletAddress, validatedData);

    res.status(200).json({
      success: true,
      data: convertBigIntToString(user)
    });
  });

  getUserPortfolio = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get portfolio
    const portfolio = await this.usersService.getUserPortfolio(req.user.walletAddress);

    res.status(200).json({
      success: true,
      data: convertBigIntToString(portfolio)
    });
  });

  getUserShares = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get shares
    const shares = await this.usersService.getUserShares(req.user.walletAddress);

    res.status(200).json({
      success: true,
      data: convertBigIntToString(shares)
    });
  });

  getUserRewards = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Get rewards
    const rewards = await this.usersService.getUserRewards(req.user.walletAddress);

    res.status(200).json({
      success: true,
      data: convertBigIntToString(rewards)
    });
  });
}

export default UsersController;
