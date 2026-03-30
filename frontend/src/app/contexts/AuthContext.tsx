/// <reference types="vite/client" />
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useIdentityToken,
  useWeb3Auth,
} from "@web3auth/modal/react";
import { User, UserRole } from "../types/roles";
import { getWalletAddresses } from "../services/walletService";

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const API_ORIGIN = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

interface AuthContextType {
  user: User | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: { role: "public" },
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  isLoading: false,
  error: null,
});

async function loginToBackend(
  idToken: string,
  smartAccountAddress: string,
  eoaAddress: string,
) {
  const res = await fetch(`${API_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      walletAddress: eoaAddress, // EOA (0xF21...)
      smartAccountAddress: smartAccountAddress, // Smart Account (0xdbb...)
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Login failed");

  const {
    token,
    walletAddress: returnedAddress,
    user: backendUser,
  } = json.data;

  // Persist auth data in localStorage
  localStorage.setItem("jwtToken", token);
  localStorage.setItem("walletAddress", returnedAddress);
  localStorage.setItem("smartAccountAddress", smartAccountAddress);
  localStorage.setItem("userRole", backendUser?.role ?? "user");
  localStorage.setItem("userEmail", backendUser?.email ?? "");

  return { returnedAddress, backendUser };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>({ role: "public" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connect, isConnected } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { getIdentityToken } = useIdentityToken();
  const { web3Auth } = useWeb3Auth();

  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
    const walletAddress = localStorage.getItem("walletAddress");
    if (token && walletAddress) {
      setUser({
        walletAddress,
        smartAccountAddress: localStorage.getItem("smartAccountAddress") ?? undefined,
        role: (localStorage.getItem("userRole") as UserRole) ?? "user",
        email: localStorage.getItem("userEmail") ?? undefined,
      });
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      await connect();
      const activeProvider = web3Auth?.provider;
      if (!activeProvider) throw new Error("Provider not ready");

      // Web3Auth native AA: addresses[0] = Smart Account, addresses[1] = EOA
      const { smartAccountAddress, eoaAddress } = await getWalletAddresses(activeProvider as any);

      const idToken = await getIdentityToken();
      const { returnedAddress, backendUser } = await loginToBackend(
        idToken!,
        smartAccountAddress,
        eoaAddress,
      );

      setUser({
        walletAddress: returnedAddress,
        smartAccountAddress,
        role: backendUser?.role ?? "user",
        email: backendUser?.email ?? undefined,
      });
    } catch (err: any) {
      setError(err.message);
      localStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, [connect, getIdentityToken, web3Auth]);

  const disconnectWallet = useCallback(async () => {
    if (isConnected) await disconnect();
    localStorage.clear();
    setUser({ role: "public" });
  }, [disconnect, isConnected]);

  return (
    <AuthContext.Provider
      value={{ user, connectWallet, disconnectWallet, isLoading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
