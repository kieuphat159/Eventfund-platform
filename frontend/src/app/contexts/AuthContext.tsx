/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useIdentityToken,
  useWeb3Auth,
} from '@web3auth/modal/react';
import { User, UserRole } from '../types/roles';
import { createSmartAccount } from '../services/walletService';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

interface AuthContextType {
  user: User | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: { role: 'public' },
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  switchRole: () => {},
  isLoading: false,
  error: null,
});

/** Call backend login endpoint, persist session, return parsed data */
async function loginToBackend(idToken: string, walletAddress: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Bypass ngrok's browser interstitial page in dev
    'ngrok-skip-browser-warning': 'true',
  };

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ idToken, walletAddress }),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const errMsg =
      typeof json.error === 'string' ? json.error :
      json.message ||
      (json.error ? JSON.stringify(json.error) : null) ||
      'Login failed';
    throw new Error(errMsg);
  }

  const { token, walletAddress: returnedAddress, user: backendUser } = json.data;

  localStorage.setItem('jwtToken', token);
  localStorage.setItem('walletAddress', returnedAddress || walletAddress);
  if (backendUser?.email) localStorage.setItem('userEmail', backendUser.email);
  localStorage.setItem('userRole', backendUser?.role ?? 'user');

  return { returnedAddress: returnedAddress || walletAddress, backendUser };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({ role: 'public' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connect, isConnected } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { getIdentityToken } = useIdentityToken();
  // web3Auth.provider is set synchronously when connect() resolves —
  // unlike the reactive `provider` hook which requires a re-render cycle.
  const { web3Auth } = useWeb3Auth();

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    const walletAddress = localStorage.getItem('walletAddress');
    const email = localStorage.getItem('userEmail');
    const role = (localStorage.getItem('userRole') as UserRole) ?? 'user';

    if (token && walletAddress) {
      setUser({ walletAddress, role, email: email ?? undefined });
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Open Web3Auth Login Modal (Social + MetaMask in one UI)
      await connect();

      // 2. Read provider from the instance — available immediately after connect()
      const activeProvider = web3Auth?.provider;
      if (!activeProvider) {
        throw new Error('Web3Auth provider unavailable after connect. Please try again.');
      }

      // 3. Get idToken issued by Web3Auth
      const idToken = await getIdentityToken();
      if (!idToken) throw new Error('Failed to get idToken from Web3Auth');

      // 4. Derive Smart Account address on frontend — private key never leaves the browser
      // Cast: Web3Auth IProvider satisfies { request } shape permissionless needs at runtime
      const walletAddress = await createSmartAccount(activeProvider as any);

      // 5. Send { idToken, walletAddress } to backend → get session JWT
      const { returnedAddress, backendUser } = await loginToBackend(idToken, walletAddress);

      // 6. Update context state
      setUser({
        walletAddress: returnedAddress,
        role: backendUser?.role ?? 'user',
        name: backendUser?.username ?? undefined,
        email: backendUser?.email ?? undefined,
      });
    } catch (err: any) {
      console.error('[AuthContext] connectWallet failed:', err);
      setError(err.message || 'Đăng nhập thất bại');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connect, getIdentityToken, web3Auth]);

  const disconnectWallet = useCallback(async () => {
    try {
      if (isConnected) await disconnect();
    } catch (e) {
      console.warn('[AuthContext] Disconnect error:', e);
    }
    // Only remove auth-related keys — don't nuke unrelated localStorage data
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    setUser({ role: 'public' });
    setError(null);
  }, [disconnect, isConnected]);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (user) setUser({ ...user, role });
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, connectWallet, disconnectWallet, switchRole, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
