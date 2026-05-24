import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";
import { logger } from "../lib/logger";

/**
 * Decode a JWT payload without verifying the signature.
 * Used only to inspect the idToken type (social vs external wallet).
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/**
 * Retrieve Smart Account and EOA addresses from Web3Auth provider.
 *
 * Accepts the idToken so it can reliably distinguish social login from
 * external wallet — provider shape alone (CommonJRPCProvider) is not
 * sufficient because Web3Auth v10 uses the same provider class for both.
 *
 * Social login (Google/Facebook):
 *   idToken payload contains `email`. Web3Auth creates an embedded key +
 *   Smart Account via accountAbstractionConfig.
 *   getAddresses() returns [SmartAccount, EOA].
 *
 * External wallet (MetaMask):
 *   idToken payload has no `email`. Web3Auth wraps MetaMask in
 *   CommonJRPCProvider which does not forward eth_accounts correctly.
 *   We fall back to window.ethereum to get the real MetaMask address.
 *   No Smart Account — smartAccountAddress === eoaAddress.
 */
export async function getWalletAddresses(
  provider: any,
  idToken: string,
): Promise<{ smartAccountAddress: string; eoaAddress: string }> {
  if (!provider) throw new Error("Web3Auth provider is unavailable");

  // Decode idToken to determine wallet type.
  // Social login always has `email`; external wallets never do.
  const payload = decodeJwtPayload(idToken);
  const isSocialLogin = Boolean(payload?.email);

  if (!isSocialLogin) {
    const rawEthereum =
      globalThis.window != null
        ? (globalThis.window as any).ethereum
        : null;

    if (!rawEthereum) {
      throw new Error("No injected wallet found (window.ethereum is unavailable)");
    }

    const accounts: string[] = await rawEthereum.request({
      method: "eth_requestAccounts",
    });
    if (!accounts || accounts.length === 0) {
      throw new Error("MetaMask returned no accounts");
    }

    const eoaAddress = accounts[0] as `0x${string}`;
    return { smartAccountAddress: eoaAddress, eoaAddress };
  }

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(provider),
  });

  const addresses = await walletClient.getAddresses();
  const smartAccountAddress = addresses[0];
  const eoaAddress = addresses[1] || addresses[0];

  if (!smartAccountAddress) throw new Error("Failed to get Smart Account address.");
  if (!eoaAddress) throw new Error("Failed to get EOA address.");

  logger.debug("wallet", "Resolved wallet addresses", {
    smartAccountAddress,
    eoaAddress,
  });

  return { smartAccountAddress, eoaAddress };
}
