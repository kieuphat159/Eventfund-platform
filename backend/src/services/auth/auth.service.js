import {
  BadRequestError,
  UnauthorizedError,
} from "../../utils/customErrors.js";
import User from "../../models/User.model.js";
import { decodeJwt } from "jose";
/**
 * AuthService - Handles authentication business logic
 */
class AuthService {
  constructor(nonceService, siweService, jwtService) {
    this.nonceService = nonceService;
    this.siweService = siweService;
    this.jwtService = jwtService;
  }

  /**
   * Generate nonce for wallet address
   */
  async generateNonce(walletAddress) {
    return await this.nonceService.generateNonce(walletAddress);
  }

  /**
   * Get nonce for wallet address
   */
  async getNonce(walletAddress) {
    return await this.nonceService.getNonce(walletAddress);
  }

  /**
   * Create SIWE message
   */
  createSIWEMessage(walletAddress, nonce, domain, uri, chainId) {
    return this.siweService.createSIWEMessage(
      walletAddress,
      nonce,
      domain,
      uri,
      chainId,
    );
  }

  /**
   * Verify signature and authenticate user
   * Consolidates the entire authentication flow
   */
  async verifyAndAuthenticate(message, signature) {
    // Parse SIWE message
    const parseResult = this.siweService.parseSIWEMessage(message);
    if (!parseResult.valid) {
      throw new BadRequestError(
        parseResult.error || "Invalid SIWE message format",
      );
    }

    const { address: walletAddress, nonce } = parseResult.parsed;

    // Verify signature
    const verifyResult = await this.siweService.verifySIWE(message, signature);
    if (!verifyResult.valid) {
      throw new UnauthorizedError(verifyResult.error || "Invalid signature");
    }

    // Validate nonce
    const nonceResult = await this.nonceService.validateNonce(
      walletAddress,
      nonce,
    );
    if (!nonceResult.valid) {
      throw new UnauthorizedError(nonceResult.error || "Invalid nonce");
    }

    // Invalidate used nonce
    await this.nonceService.invalidateNonce(walletAddress);

    // Generate JWT token
    const token = this.jwtService.generateToken(
      nonceResult.user.walletAddress,
      nonceResult.user.role,
    );

    return {
      token,
      user: {
        walletAddress: nonceResult.user.walletAddress,
        role: nonceResult.user.role,
      },
    };
  }
  /**
   * Đăng nhập bằng Gmail (Web3Auth)
   * idToken: Token từ Gmail
   * smartAccountAddress: Địa chỉ ví AA từ Frontend gửi lên
   */
  async loginWithIdToken(idToken, eoaAddress, smartAccountAddress) {
    let decoded;
    try {
      decoded = decodeJwt(idToken);
    } catch (err) {
      throw new BadRequestError("idToken không hợp lệ");
    }

    const email = decoded?.email;
    if (!email) throw new BadRequestError("idToken không chứa email");
    if (!eoaAddress) {
      throw new BadRequestError("walletAddress (EOA) is required");
    }

    const normalizedEoa = eoaAddress.toLowerCase();
    const normalizedSmartAccount = smartAccountAddress
      ? smartAccountAddress.toLowerCase()
      : null;

    // Tìm user theo email
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // TẠO MỚI: Lưu tách biệt Chìa khóa (EOA) và Két sắt (AA)
      user = new User({
        email: email.toLowerCase(),
        walletAddress: normalizedEoa, // 0xF21...
        smartAccountAddress: normalizedSmartAccount, // 0xdbb...
        role: "user",
        username: email.split("@")[0],
        nonce: "social_login",
        nonceExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
    } else {
      // CẬP NHẬT: Đảm bảo cả 2 địa chỉ đều được lưu đúng
      user.walletAddress = normalizedEoa;
      user.smartAccountAddress = normalizedSmartAccount;
    }
    await user.save();

    // QUAN TRỌNG: Tạo Token dựa trên walletAddress (EOA)
    const token = this.jwtService.generateToken(user.walletAddress, user.role);

    return {
      token,
      walletAddress: user.walletAddress,
      user: {
        email: user.email,
        role: user.role,
        username: user.username,
      },
    };
  }

  /**
   * Refresh JWT token
   */
  refreshToken(token) {
    const result = this.jwtService.refreshToken(token);
    if (!result.valid) {
      throw new UnauthorizedError(result.error || "Token refresh failed");
    }
    return result.token;
  }
}

export default AuthService;
