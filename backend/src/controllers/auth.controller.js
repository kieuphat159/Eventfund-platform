import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/customErrors.js";

/**
 * AuthController - Điều phối các yêu cầu xác thực
 */
class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * POST /api/auth/login
   * Hybrid Web3Auth login — nhận idToken, walletAddress (EOA) và smartAccountAddress (AA).
   */
  login = asyncHandler(async (req, res) => {
    // 1. Lấy dữ liệu từ body (Frontend sẽ gửi 3 trường này)
    const { idToken, walletAddress, smartAccountAddress } = req.body;

    // 2. Kiểm tra dữ liệu bắt buộc
    if (!idToken) {
      throw new BadRequestError("idToken is required", "ID_TOKEN_REQUIRED");
    }

    if (!walletAddress) {
      throw new BadRequestError(
        "walletAddress (EOA) is required",
        "WALLET_ADDRESS_REQUIRED",
      );
    }

    // 3. Gọi Service để xử lý (Đảm bảo AuthService đã được sửa để nhận 3 tham số)
    // Thứ tự: idToken, eoaAddress, smartAccountAddress
    const result = await this.authService.loginWithIdToken(
      idToken,
      walletAddress, // Đây là ví gốc (EOA - Chìa khóa)
      smartAccountAddress, // Đây là ví thông minh (AA - Két sắt)
    );

    // 4. Trả về kết quả
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /api/auth/nonce
   */
  getNonce = asyncHandler(async (req, res) => {
    const { walletAddress } = req.validated?.body || req.body;
    const result = await this.authService.generateNonce(walletAddress);
    res.status(200).json({ success: true, data: result });
  });

  /**
   * POST /api/auth/message
   */
  getMessage = asyncHandler(async (req, res) => {
    const { walletAddress, chainId } = req.validated?.body || req.body;
    const nonceData = await this.authService.getNonce(walletAddress);

    if (!nonceData) {
      throw new BadRequestError(
        "No nonce found. Please request a nonce first by calling POST /auth/nonce",
        "NONCE_NOT_FOUND",
      );
    }

    const message = this.authService.createSIWEMessage(
      walletAddress,
      nonceData.nonce,
      process.env.SIWE_DOMAIN || "localhost",
      process.env.SIWE_URI || "http://localhost:3000",
      chainId || 1,
    );

    res.status(200).json({
      success: true,
      data: {
        message,
        nonce: nonceData.nonce,
      },
    });
  });

  /**
   * POST /api/auth/verify
   */
  verifySignature = asyncHandler(async (req, res) => {
    const { message, signature } = req.validated.body;
    const result = await this.authService.verifyAndAuthenticate(
      message,
      signature,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  });

  /**
   * POST /api/auth/refresh-token
   */
  refreshToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
      throw new BadRequestError("Token is required");
    }
    const newToken = this.authService.refreshToken(token);
    res.status(200).json({
      success: true,
      data: {
        token: newToken,
      },
    });
  });
}

export default AuthController;
