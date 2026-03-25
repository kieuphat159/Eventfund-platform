/**
 * walletService.ts
 * Frontend Smart Account creation using Web3Auth provider + permissionless.
 * Private key never leaves the browser — backend only receives the address.
 */

import { createPublicClient, http, type Client } from 'viem';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

const CHAIN_ID = import.meta.env.VITE_CHAIN_ID ?? '0xaa36a7'; // default: Sepolia
const RPC_URL = import.meta.env.VITE_RPC_URL ?? 'https://rpc.ankr.com/eth_sepolia';

// Extract the owner type directly from toSimpleSmartAccount's parameters.
// Covers EIP1193Provider, WalletClient, and LocalAccount — Web3Auth's IProvider
// satisfies the { request(...args): Promise<any> } shape at runtime.
type SmartAccountOwner = Parameters<typeof toSimpleSmartAccount>[0]['owner'];

/**
 * Derive a counterfactual Simple Smart Account address from a Web3Auth provider.
 * Works for both Social Login and MetaMask (both go through Web3Auth Modal).
 * No deployment needed — address is deterministic from the owner key.
 *
 * @param provider - EIP-1193 provider from web3Auth.provider (set after connect())
 * @returns Smart Account address (0x...)
 */
export async function createSmartAccount(provider: SmartAccountOwner): Promise<string> {
  if (!provider) {
    throw new Error('Web3Auth provider is not available. Make sure the user is connected.');
  }

  // Dynamic import keeps unused chains out of the initial bundle
  const { sepolia, mainnet, polygon, polygonAmoy } = await import('viem/chains');

  const chainMap: Record<string, any> = {
    '0x1': mainnet,
    '0xaa36a7': sepolia,
    '0x89': polygon,
    '0x13882': polygonAmoy, // Polygon Amoy testnet (Mumbai deprecated)
  };

  const chain = chainMap[CHAIN_ID.toLowerCase()] ?? sepolia;

  // Cast to Client: permissionless@0.3.x requires viem@^2.44.4 peer dep.
  // package.json declared viem@^2.0.0 but node_modules has 2.47.6 — types
  // are resolved from the declared range, causing a PublicClient ↔ Client
  // intersection conflict. The cast is safe; runtime behavior is identical.
  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  }) as unknown as Client;

  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: provider,
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  });

  return smartAccount.address;
}
