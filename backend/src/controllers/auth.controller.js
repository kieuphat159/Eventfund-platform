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
