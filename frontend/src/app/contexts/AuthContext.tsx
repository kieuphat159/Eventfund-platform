import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '../types/roles';

interface AuthContextType {
  user: User | null;
  connectWallet: () => void;
  disconnectWallet: () => void;
  switchRole: (role: UserRole) => void;
}

const defaultAuthContext: AuthContextType = {
  user: { role: 'public' },
  connectWallet: () => {},
  disconnectWallet: () => {},
  switchRole: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({
    role: 'public',
  });

  const connectWallet = () => {
    // Simulate wallet connection with a valid 40-hex Ethereum-style address
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const mockWallet = `0x${randomHex}`;
    setUser({
      walletAddress: mockWallet,
      role: 'user',
      name: 'Web3 User',
    });
  };

  const disconnectWallet = () => {
    setUser({ role: 'public' });
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  return (
    <AuthContext.Provider value={{ user, connectWallet, disconnectWallet, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
