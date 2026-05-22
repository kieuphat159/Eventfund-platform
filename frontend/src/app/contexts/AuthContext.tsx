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
import { watchAndCleanWeb3AuthModal, forceCloseWeb3AuthModal } from "../lib/web3authModalCleanup";

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

/**
 * Unified login — works for both social (Google/Facebook) and external wallets
 * (MetaMask). Web3Auth issues an idToken for both; the backend distinguishes
 * them by presence of `email` in the JWT payload.
 */
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

  // Decode Web3Auth idToken (not app JWT) to determine wallet type for providerService.
  // Social login idToken always has `email`; MetaMask idToken never does.
  try {
    const parts = idToken.split(".");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    localStorage.setItem("walletType", payload?.email ? "social" : "external");
  } catch {
    localStorage.setItem("walletType", "social"); // safe fallback
  }

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
    localStorage.removeItem("walletType");
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

    const stopWatching = watchAndCleanWeb3AuthModal();

    try {
      await connect();

      forceCloseWeb3AuthModal();
      stopWatching();

      const activeProvider = web3Auth?.provider;
      if (!activeProvider) throw new Error("Provider not ready");

      const idToken = await getIdentityToken();
      if (!idToken) throw new Error("Web3Auth did not return an idToken");

      const { smartAccountAddress, eoaAddress } =
        await getWalletAddresses(activeProvider as any, idToken);

      await loginToBackend(idToken, smartAccountAddress, eoaAddress);

      await refreshProfile();
    } catch (err: any) {
      forceCloseWeb3AuthModal();
      stopWatching();

      const isUserCancelled =
        err?.message?.includes("user closed") ||
        err?.message?.includes("cancelled") ||
        err?.message?.includes("Popup closed") ||
        err?.message?.includes("User cancelled") ||
        err?.message?.includes("user_rejected") ||
        err?.message?.includes("USER_DENIED_REQUEST");

      try { await disconnect(); } catch { /* ignore */ }

      // Remount Web3Auth to reset internal state so popup works again
      window.dispatchEvent(new CustomEvent("web3auth:remount"));

      if (isUserCancelled) {
        setError(null);
      } else {
        console.error("[Auth] connectWallet error:", err);
        setError(err.message || "Login failed");
      }
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [connect, disconnect, getIdentityToken, web3Auth, refreshProfile, clearAuth]);

  const disconnectWallet = useCallback(async () => {
    try {
      if (web3Auth) {
        await web3Auth.logout({ cleanup: true }).catch(() => {});
      }
      try { await disconnect(); } catch { /* ignore */ }
    } catch (err) {
      console.warn("[Auth] logout error (non-fatal):", err);
    } finally {
      clearAuth();
      // Remount Web3AuthProvider to reset all internal state without page reload
      window.dispatchEvent(new CustomEvent("web3auth:remount"));
    }
  }, [web3Auth, disconnect, clearAuth]);

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
