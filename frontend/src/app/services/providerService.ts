/**
 * providerService — resolve the correct EIP-1193 provider for transactions.
 *
 * Problem: Web3Auth v10 wraps external wallets (MetaMask) in CommonJRPCProvider,
 * which does NOT correctly forward JSON-RPC methods like eth_chainId,
 * eth_sendTransaction, etc. All on-chain operations fail with:
 *   "SerializableError: Response has no error or result for request"
 *
 * Solution: When the active wallet is an external wallet (MetaMask), bypass
 * CommonJRPCProvider and use window.ethereum directly. For social login
 * (embedded wallet), web3Auth.provider works correctly.
 *
 * Detection: decode idToken payload — social login always has `email`,
 * external wallet never does. This is the only reliable signal in v10.
 */

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * Returns the correct EIP-1193 provider to use for on-chain transactions.
 *
 * @param web3AuthProvider - web3Auth.provider from useWeb3Auth()
 * @returns window.ethereum for MetaMask, web3AuthProvider for social login
 */
export function resolveTransactionProvider(
  web3AuthProvider: any,
): Eip1193Provider {
  if (!web3AuthProvider?.request) {
    throw new Error("Wallet provider is not ready. Please reconnect your wallet.");
  }

  // walletType is stored during login by AuthContext using the Web3Auth idToken
  // payload (social login has `email`, external wallet does not).
  const walletType = localStorage.getItem("walletType");

  if (walletType === "external") {
    const rawEthereum =
      globalThis.window != null
        ? (globalThis.window as any).ethereum
        : null;

    if (rawEthereum?.request) {
      return rawEthereum as Eip1193Provider;
    }
  }

  // Social login or no walletType stored — use web3Auth provider
  return web3AuthProvider as Eip1193Provider;
}
