import type { Web3AuthContextConfig } from "@web3auth/modal/react";

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID as string;
const web3AuthNetwork = (import.meta.env.VITE_WEB3AUTH_NETWORK ??
  "sapphire_devnet") as string;
const bundlerUrl = import.meta.env.VITE_BUNDLER_URL as string | undefined;
const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY as
  | string
  | undefined;
const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

function resolveRpcUrl(): string {
  const configured =
    (import.meta.env.VITE_WEB3AUTH_RPC_URL as string | undefined) ||
    (import.meta.env.VITE_RPC_URL as string | undefined) ||
    DEFAULT_SEPOLIA_RPC_URL;

  const trimmed = configured.trim();
  if (!trimmed) return DEFAULT_SEPOLIA_RPC_URL;

  const looksLikeQuickNode = /quiknode\.pro/i.test(trimmed);
  if (looksLikeQuickNode) {
    console.warn(
      "[Web3Auth] QuickNode free-tier may hit 429 while signing tx. Falling back to public Sepolia RPC.",
    );
    return DEFAULT_SEPOLIA_RPC_URL;
  }

  return trimmed;
}

const rpcUrl = resolveRpcUrl();

export const WEB3AUTH_SEPOLIA_CHAIN_ID = "0xaa36a7";
export const WEB3AUTH_SEPOLIA_CHAIN = {
  chainNamespace: "eip155",
  chainId: WEB3AUTH_SEPOLIA_CHAIN_ID,
  rpcTarget: rpcUrl,
  displayName: "Ethereum Sepolia",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
};

function resolveBundlerUrl(url?: string, apiKey?: string): string | undefined {
  if (!url) return undefined;

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Pimlico v2 endpoints require an API key, either in query param or request header.
  // Web3Auth bundler config only accepts URL, so we include apikey in query when needed.
  const isPimlico = trimmed.includes("api.pimlico.io");
  const hasApiKeyInUrl = /[?&]apikey=/.test(trimmed);

  if (!isPimlico || hasApiKeyInUrl || !apiKey) {
    return trimmed;
  }

  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}apikey=${encodeURIComponent(apiKey)}`;
}

const resolvedBundlerUrl = resolveBundlerUrl(bundlerUrl, pimlicoApiKey);

if (!clientId) {
  console.warn(
    "[Web3Auth] VITE_WEB3AUTH_CLIENT_ID is not set. Social login will not work.",
  );
}
if (!resolvedBundlerUrl) {
  console.warn(
    "[Web3Auth] VITE_BUNDLER_URL is not set. Smart Account transactions will not work.",
  );
}
if (
  bundlerUrl?.includes("api.pimlico.io") &&
  !/[?&]apikey=/.test(bundlerUrl) &&
  !pimlicoApiKey
) {
  console.warn(
    "[Web3Auth] Pimlico bundler URL is missing API key. Set VITE_PIMLICO_API_KEY or include ?apikey=... in VITE_BUNDLER_URL to avoid 401 Unauthorized.",
  );
}

export const web3AuthConfig: Web3AuthContextConfig = {
  web3AuthOptions: {
    clientId: clientId ?? "",
    web3AuthNetwork: web3AuthNetwork as any,
    defaultChainId: WEB3AUTH_SEPOLIA_CHAIN_ID,
    chains: [WEB3AUTH_SEPOLIA_CHAIN as any],
    walletServicesConfig: {
      // Work around Web3Auth confirm-modal crashes during tx/sign flows by
      // avoiding the SDK modal confirmation path.
      confirmationStrategy: "auto-approve",
      whiteLabel: {
        showWidgetButton: false,
      },
    } as any,
    // widgetType is a runtime-only field (not in UIConfig .d.ts but required by LoginModal).
    // Without it, Web3Auth v10 defaults to "embed" mode and throws
    // "targetId is required for embed widget". Setting "modal" renders a popup instead.
    uiConfig: { widgetType: "modal" } as any,
    // ERC-4337 Smart Account via Web3Auth native AA — requires Growth plan on mainnet,
    // free on sapphire_devnet. Configure bundler in dashboard or override here.
    accountAbstractionConfig: {
      smartAccountType: "metamask",
      chains: [
        {
          chainId: "0xaa36a7", // Sepolia
          bundlerConfig: {
            url: resolvedBundlerUrl ?? "",
          },
        },
      ],
    } as any,
  },
};
