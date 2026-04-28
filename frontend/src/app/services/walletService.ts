import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";

/**
 * Retrieve Smart Account and EOA addresses from Web3Auth provider.
 *
 * When accountAbstractionConfig is set in web3AuthConfig, Web3Auth manages
 * the Smart Account natively. The provider returns addresses in this order:
 *   addresses[0] = Smart Account address (ERC-4337)
 *   addresses[1] = EOA address
 *
 * Docs: https://web3auth.io/docs/sdk/pnp/web/modal/smart-accounts
 */
export async function getWalletAddresses(
  provider: any,
): Promise<{ smartAccountAddress: string; eoaAddress: string }> {
  if (!provider) throw new Error("Web3Auth provider is unavailable");

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(provider),
  });

  const addresses = await walletClient.getAddresses();

  // Some Web3Auth setups return only one address.
  // Prefer the documented ordering when both exist, and fall back gracefully otherwise.
  const smartAccountAddress = addresses[0];
  const eoaAddress = addresses[1] || addresses[0];

  if (!smartAccountAddress) throw new Error("Failed to get Smart Account address.");
  if (!eoaAddress) throw new Error("Failed to get EOA address.");

  console.log("Smart Account:", smartAccountAddress);
  console.log("EOA:", eoaAddress);

  return { smartAccountAddress, eoaAddress };
}
