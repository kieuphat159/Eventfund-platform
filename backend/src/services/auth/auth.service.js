import {
  BadRequestError,
  UnauthorizedError,
} from "../../utils/customErrors.js";
import User from "../../models/User.model.js";
import { decodeJwt } from "jose";

class AuthService {
  constructor(nonceService, siweService, jwtService) {
    this.nonceService = nonceService;
    this.siweService = siweService;
    this.jwtService = jwtService;
  }

  async generateNonce(walletAddress) {
    return await this.nonceService.generateNonce(walletAddress);
  }

  async getNonce(walletAddress) {
    return await this.nonceService.getNonce(walletAddress);
  }

  createSIWEMessage(walletAddress, nonce, domain, uri, chainId) {
    return this.siweService.createSIWEMessage(
      walletAddress,
      nonce,
      domain,
      uri,
      chainId,
    );
  }

  async loginWithIdToken(idToken, eoaAddress, smartAccountAddress) {
    let decoded;
    let email;

    try {
      decoded = decodeJwt(idToken);
      email = decoded.email;
    } catch {
      throw new BadRequestError("idToken is not a valid JWT");
    }

    if (!email) {
      throw new BadRequestError("idToken does not contain an email");
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        walletAddress: eoaAddress.toLowerCase(),
        smartAccountAddress: smartAccountAddress?.toLowerCase(),
        role: "user",
        username: decoded.name || email.split("@")[0],
        avatarUrl: decoded.picture || "",
        nonce: "social_login",
        nonceExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
    } else {
      user.walletAddress = eoaAddress.toLowerCase();

      if (smartAccountAddress) {
        user.smartAccountAddress = smartAccountAddress.toLowerCase();
      }

      if (!user.username && decoded.name) {
        user.username = decoded.name;
      }

      if (!user.avatarUrl && decoded.picture) {
        user.avatarUrl = decoded.picture;
      }
    }

    await user.save();

    const token = this.jwtService.generateToken(user.walletAddress, user.role);

    return {
      token,
      walletAddress: user.walletAddress,
      user: {
        email: user.email,
        username: user.username,
      },
    };
  }

  async verifyAndAuthenticate(message, signature) {
    const parseResult = this.siweService.parseSIWEMessage(message);
    if (!parseResult.valid) {
      throw new BadRequestError(
        parseResult.error || "Invalid SIWE message format",
      );
    }

    const { address: walletAddress, nonce } = parseResult.parsed;

    const verifyResult = await this.siweService.verifySIWE(message, signature);
    if (!verifyResult.valid) {
      throw new UnauthorizedError(verifyResult.error || "Invalid signature");
    }

    const nonceResult = await this.nonceService.validateNonce(
      walletAddress,
      nonce,
    );
    if (!nonceResult.valid) {
      throw new UnauthorizedError(nonceResult.error || "Invalid nonce");
    }

    await this.nonceService.invalidateNonce(walletAddress);

    const token = this.jwtService.generateToken(
      nonceResult.user.walletAddress,
      nonceResult.user.role,
    );

    return {
      token,
      user: {
        walletAddress: nonceResult.user.walletAddress,
      },
    };
  }

  refreshToken(token) {
    const result = this.jwtService.refreshToken(token);
    if (!result.valid) {
      throw new UnauthorizedError(result.error || "Token refresh failed");
    }
    return result.token;
  }
}

export default AuthService;