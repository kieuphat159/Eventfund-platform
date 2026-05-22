import asyncHandler from '../utils/asyncHandler.js';
import * as usersService from '../services/users/users.service.js';
import { BadRequestError } from '../utils/customErrors.js';

/**
 * UsersController - Handles user profile and portfolio endpoints
 */
class UsersController {
  constructor(service = usersService) {
    this.usersService = service;
    this.BadRequestError = BadRequestError;
  }

  getProfile = asyncHandler(async (req, res) => {
    const walletAddress = req.user.walletAddress;

    const user = await this.usersService.getProfile(walletAddress);

    res.status(200).json({
      success: true,
      data: user
    });
  });

  updateProfile = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const updateData = req.validated?.body || req.body;
    const file = req.file;
    const walletAddress = req.user.walletAddress;

    // Check if at least one field or file is provided
    const hasBodyFields = updateData && Object.keys(updateData).length > 0;
    const hasFile = !!file;

    if (!hasBodyFields && !hasFile) {
      const error = new this.BadRequestError('Validation failed');
      error.code = 'VALIDATION_ERROR';
      error.details = [{ field: 'body', message: 'At least one field must be provided', type: 'any.required' }];
      throw error;
    }

    const result = await this.usersService.updateProfileWithAvatar(walletAddress, updateData, file);

    const totalDuration = Date.now() - startTime;
    res.setHeader('X-Request-Duration', totalDuration);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getUserPortfolio = asyncHandler(async (req, res) => {
    const walletAddress = req.user.walletAddress;

    const portfolio = await this.usersService.getUserPortfolio(walletAddress);

    res.status(200).json({
      success: true,
      data: portfolio
    });
  });

  getUserShares = asyncHandler(async (req, res) => {
    const walletAddress = req.user.walletAddress;

    const shares = await this.usersService.getUserShares(walletAddress);

    res.status(200).json({
      success: true,
      data: shares
    });
  });

  getUserShareById = asyncHandler(async (req, res) => {
    const walletAddress = req.user.walletAddress;
    const { id } = req.params;

    const share = await this.usersService.getUserShareById(walletAddress, id);

    res.status(200).json({
      success: true,
      data: share
    });
  });

  getUserRewards = asyncHandler(async (req, res) => {
    const walletAddress = req.user.walletAddress;

    const rewards = await this.usersService.getUserRewards(walletAddress);

    res.status(200).json({
      success: true,
      data: rewards
    });
  });

  getUserContributions = asyncHandler(async (req, res) => {
    const walletAddress = req.user.walletAddress;

    const contributions =
      await this.usersService.getUserContributions(walletAddress);

    res.status(200).json({
      success: true,
      data: contributions,
    });
  });

  getUserByWallet = asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;

    const user = await this.usersService.getUserByWallet(walletAddress);

    res.status(200).json({
      success: true,
      data: user
    });
  });
}

export default UsersController;
