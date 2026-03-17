import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '../types/roles';

interface AuthContextType {
  user: User | null;
  connectWallet: () => void;
  disconnectWallet: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({
    role: 'public',
  });

  const connectWallet = () => {
    // Simulate wallet connection
    const mockWallet = '0x' + Math.random().toString(16).substring(2, 42);
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
