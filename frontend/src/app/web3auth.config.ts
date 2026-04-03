import type { Web3AuthContextConfig } from '@web3auth/modal/react';

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID as string;
const web3AuthNetwork = (import.meta.env.VITE_WEB3AUTH_NETWORK ?? 'sapphire_devnet') as string;
const bundlerUrl = import.meta.env.VITE_BUNDLER_URL as string | undefined;

if (!clientId) {
  console.warn('[Web3Auth] VITE_WEB3AUTH_CLIENT_ID is not set. Social login will not work.');
}
if (!bundlerUrl) {
  console.warn('[Web3Auth] VITE_BUNDLER_URL is not set. Smart Account transactions will not work.');
}

export const web3AuthConfig: Web3AuthContextConfig = {
  web3AuthOptions: {
    clientId: clientId ?? '',
    web3AuthNetwork: web3AuthNetwork as any,
    // widgetType is a runtime-only field (not in UIConfig .d.ts but required by LoginModal).
    // Without it, Web3Auth v10 defaults to "embed" mode and throws
    // "targetId is required for embed widget". Setting "modal" renders a popup instead.
    uiConfig: { widgetType: 'modal' } as any,
    // ERC-4337 Smart Account via Web3Auth native AA — requires Growth plan on mainnet,
    // free on sapphire_devnet. Configure bundler in dashboard or override here.
    accountAbstractionConfig: {
      smartAccountType: 'metamask',
      chains: [
        {
          chainId: '0xaa36a7', // Sepolia
          bundlerConfig: {
            url: bundlerUrl ?? '',
          },
        },
      ],
    } as any,
  },
};
