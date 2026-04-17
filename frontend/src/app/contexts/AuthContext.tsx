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
import { User } from "../types/roles";
import { getWalletAddresses } from "../services/walletService";
import { userService } from "../services/user.service";

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const API_ORIGIN = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

interface AuthContextType {
  user: User | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: { role: "public" },
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  isLoading: false,
  error: null,
  refreshProfile: async () => {},
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
      walletAddress: eoaAddress,
      smartAccountAddress,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Login failed");

  const { token, walletAddress: returnedAddress } = json.data;

  localStorage.setItem("jwtToken", token);
  localStorage.setItem("walletAddress", returnedAddress);
  localStorage.setItem("smartAccountAddress", smartAccountAddress);

  return { returnedAddress };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>({ role: "public" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { connect, isConnected } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { getIdentityToken } = useIdentityToken();
  const { web3Auth } = useWeb3Auth();

  const clearAuth = useCallback(() => {
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("smartAccountAddress");
    setUser({ role: "public" });
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
      setUser({ role: "public" });
      return;
    }

    try {
      const profile = await userService.getProfile();

      setUser({
        walletAddress: profile.walletAddress,
        smartAccountAddress:
          localStorage.getItem("smartAccountAddress") ?? undefined,
        role: profile.role,
        email: profile.email,
        name: profile.username,
      });
    } catch (err) {
      clearAuth();
      throw err;
    }
  }, [clearAuth]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const walletAddress = localStorage.getItem("walletAddress");

        if (!token || !walletAddress) {
          setUser({ role: "public" });
          return;
        }

        await refreshProfile();
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [refreshProfile, clearAuth]);

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await connect();

      const activeProvider = web3Auth?.provider;
      if (!activeProvider) throw new Error("Provider not ready");

      const { smartAccountAddress, eoaAddress } = await getWalletAddresses(
        activeProvider as any,
      );

      const idToken = await getIdentityToken();
      if (!idToken) throw new Error("Identity token not available");

      await loginToBackend(idToken, smartAccountAddress, eoaAddress);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || "Login failed");
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [connect, getIdentityToken, web3Auth, refreshProfile, clearAuth]);

  const disconnectWallet = useCallback(async () => {
    try {
      if (isConnected) await disconnect();
    } finally {
      clearAuth();
    }
  }, [disconnect, isConnected, clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        connectWallet,
        disconnectWallet,
        isLoading,
        error,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
