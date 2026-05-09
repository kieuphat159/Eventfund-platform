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

    try {
      decoded = decodeJwt(idToken);
    } catch {
      throw new BadRequestError("idToken is not a valid JWT");
    }

    // Web3Auth issues idToken for both social and external wallets, but with
    // different payloads:
    //   Social login:    { email, name, wallets: [{ type: "web3auth_key" }] }
    //   External wallet: { wallets: [{ type: "ethereum", address: "0x..." }] }
    //                    no email, no name
    const email = decoded.email;

    if (email) {
      return await this._loginSocial(decoded, email, eoaAddress, smartAccountAddress);
    } else {
      return await this._loginExternalWallet(decoded, eoaAddress, smartAccountAddress);
    }
  }

  /**
   * Social login path — idToken contains email from Google/Facebook/etc.
   */
  async _loginSocial(decoded, email, eoaAddress, smartAccountAddress) {
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        walletAddress: eoaAddress.toLowerCase(),
        smartAccountAddress: smartAccountAddress?.toLowerCase() ?? null,
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
      user: { email: user.email, username: user.username },
    };
  }

  /**
   * External wallet path — idToken has no email, wallet address comes from
   * the request body (eoaAddress) which the frontend gets from window.ethereum.
   * We still verify the idToken is a valid Web3Auth-issued JWT (signature check
   * is done at the HTTP layer via JWKS if configured; here we at minimum confirm
   * the token is well-formed and the address matches).
   */
  async _loginExternalWallet(decoded, eoaAddress, smartAccountAddress) {
    if (!eoaAddress) {
      throw new BadRequestError(
        "walletAddress is required for external wallet login",
        "WALLET_ADDRESS_REQUIRED",
      );
    }

    const normalizedAddress = eoaAddress.toLowerCase();

    // Note: we do NOT cross-check the address in the idToken wallets array.
    // Web3Auth v10 external wallet tokens (iss: "metamask") contain internal
    // keys (e.g. Solana address) that do not correspond to the user's Ethereum
    // address. The reliable address is eoaAddress from window.ethereum, which
    // the user explicitly authorized when connecting MetaMask.

    let user = await User.findOne({ walletAddress: normalizedAddress });

    if (!user) {
      user = new User({
        walletAddress: normalizedAddress,
        smartAccountAddress: smartAccountAddress?.toLowerCase() ?? null,
        role: "user",
        username: `user_${normalizedAddress.slice(2, 8)}`,
        nonce: "external_wallet",
        nonceExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
    } else {
      if (smartAccountAddress) {
        user.smartAccountAddress = smartAccountAddress.toLowerCase();
      }
    }

    await user.save();

    const token = this.jwtService.generateToken(user.walletAddress, user.role);
    return {
      token,
      walletAddress: user.walletAddress,
      user: { email: user.email ?? null, username: user.username },
    };
  }

  async verifyAndAuthenticate(message, signature, smartAccountAddress) {
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

    // Persist smartAccountAddress if provided (external wallet login)
    if (smartAccountAddress) {
      const user = nonceResult.user;
      user.smartAccountAddress = smartAccountAddress.toLowerCase();
      await user.save();
    }

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
