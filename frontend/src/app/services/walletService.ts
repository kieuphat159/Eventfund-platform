import { createPublicClient, createWalletClient, custom, http } from "viem";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import { sepolia } from "viem/chains";

const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://rpc.ankr.com/eth_sepolia";

export async function createSmartAccount(provider: any): Promise<string> {
  if (!provider) throw new Error("Web3Auth provider không tồn tại");

  // Public client (read blockchain)
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

  // Wallet client (wrap Web3Auth provider)
  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(provider),
  });

  // Lấy address từ provider
  const [address] = await walletClient.getAddresses();

  if (!address) {
    throw new Error("Không lấy được ví từ Web3Auth.");
  }

  console.log("EOA:", address);

  // Tạo Smart Account
  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: walletClient,
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  console.log("Smart Account:", smartAccount.address);

  return smartAccount.address;
}
