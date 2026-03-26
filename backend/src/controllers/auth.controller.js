import asyncHandler from '../utils/asyncHandler.js';
import { BadRequestError } from '../utils/customErrors.js';
import AuthService from '../services/auth/auth.service.js';
import config from '../config/env.js';

/**
 * AuthController - Handles authentication endpoints
 */
class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * POST /api/auth/login
   * Hybrid Web3Auth login — frontend creates Smart Account, sends { idToken, walletAddress }.
   * Backend verifies idToken, saves walletAddress, issues session JWT.
   */
  login = asyncHandler(async (req, res) => {
    const { idToken, walletAddress } = req.body;

    if (!idToken) {
      throw new BadRequestError('idToken is required', 'ID_TOKEN_REQUIRED');
    }

    if (!walletAddress) {
      throw new BadRequestError('walletAddress is required', 'WALLET_ADDRESS_REQUIRED');
    }

    const result = await this.authService.loginWithIdToken(idToken, walletAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getNonce = asyncHandler(async (req, res) => {
    const { walletAddress } = req.validated?.body || req.body;

    const result = await this.authService.generateNonce(walletAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getMessage = asyncHandler(async (req, res) => {
    const { walletAddress, chainId } = req.validated?.body || req.body;

    const nonceData = await this.authService.getNonce(walletAddress);

    if (!nonceData) {
      throw new BadRequestError('No nonce found. Please request a nonce first by calling POST /auth/nonce', 'NONCE_NOT_FOUND');
    }

    const message = this.authService.createSIWEMessage(
      walletAddress,
      nonceData.nonce,
      config.siwe.domain,
      config.siwe.uri,
      chainId || config.siwe.chainId
    );

    res.status(200).json({
      success: true,
      data: {
        message,
        nonce: nonceData.nonce
      }
    });
  });

  verifySignature = asyncHandler(async (req, res) => {
    const { message, signature } = req.validated.body;

    const result = await this.authService.verifyAndAuthenticate(message, signature);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  logout = asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  refreshToken = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
      throw new BadRequestError('Token is required');
    }

    const newToken = this.authService.refreshToken(token);

    res.status(200).json({
      success: true,
      data: {
        token: newToken
      }
    });
  });
}

export default AuthController;
