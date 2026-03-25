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

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '').replace(/\/api$/, '');

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
    'ngrok-skip-browser-warning': 'true',
  };

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ idToken, walletAddress }),
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const json = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const errMsg =
      typeof json === 'object' && json !== null
        ? typeof (json as { error?: unknown }).error === 'string'
          ? (json as { error: string }).error
          : (json as { message?: string }).message ||
            ((json as { error?: unknown }).error
              ? JSON.stringify((json as { error?: unknown }).error)
              : `Login failed (${res.status})`)
        : `Login failed (${res.status})`;

    throw new Error(errMsg);
  }

  if (
    typeof json !== 'object' ||
    json === null ||
    !('success' in json) ||
    !(json as { success?: boolean }).success
  ) {
    throw new Error('Login failed');
  }

  const data = (json as {
    data?: {
      token?: string;
      walletAddress?: string;
      user?: {
        role?: UserRole;
        email?: string;
        username?: string;
      };
    };
  }).data;

  const token = data?.token;
  const returnedAddress = data?.walletAddress || walletAddress;
  const backendUser = data?.user;

  if (!token) {
    throw new Error('Backend did not return JWT token');
  }

  localStorage.setItem('jwtToken', token);
  localStorage.setItem('walletAddress', returnedAddress);
  if (backendUser?.email) {
    localStorage.setItem('userEmail', backendUser.email);
  } else {
    localStorage.removeItem('userEmail');
  }
  localStorage.setItem('userRole', backendUser?.role ?? 'user');

  return { returnedAddress, backendUser };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({ role: 'public' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connect, isConnected } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { getIdentityToken } = useIdentityToken();
  const { web3Auth } = useWeb3Auth();

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
      await connect();

      const activeProvider = web3Auth?.provider;
      if (!activeProvider) {
        throw new Error('Web3Auth provider unavailable after connect. Please try again.');
      }

      const idToken = await getIdentityToken();
      if (!idToken) {
        throw new Error('Failed to get idToken from Web3Auth');
      }

      const walletAddress = await createSmartAccount(activeProvider as any);

      const { returnedAddress, backendUser } = await loginToBackend(idToken, walletAddress);

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
      if (isConnected) {
        await disconnect();
      }
    } catch (e) {
      console.warn('[AuthContext] Disconnect error:', e);
    }

    localStorage.removeItem('jwtToken');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');

    setUser({ role: 'public' });
    setError(null);
  }, [disconnect, isConnected]);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (user) {
        setUser({ ...user, role });
        localStorage.setItem('userRole', role);
      }
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, connectWallet, disconnectWallet, switchRole, isLoading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);