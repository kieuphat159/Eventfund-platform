const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

function normalizeRpcUrl(value?: string): string {
  return String(value ?? "").trim();
}

export function resolveSepoliaRpcUrl(): string {
  const candidates = [
    import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined,
    import.meta.env.VITE_WEB3AUTH_RPC_URL as string | undefined,
    import.meta.env.VITE_RPC_URL as string | undefined,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRpcUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_SEPOLIA_RPC_URL;
}
