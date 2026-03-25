import React from 'react';
import { Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';

export const LoginPage: React.FC = () => {
  const { connectWallet, isLoading, error } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md px-8 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Chào mừng đến EventChain</h1>
        <p className="text-slate-400 mb-8 text-sm">
          Đăng nhập bằng Google, Email hoặc MetaMask. Ví Smart Account sẽ được tạo tự động.
        </p>

        <Button
          onClick={connectWallet}
          disabled={isLoading}
          className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Wallet className="w-5 h-5 mr-2" />
          {isLoading ? 'Đang kết nối và tạo ví...' : 'Đăng nhập bằng Google hoặc MetaMask'}
        </Button>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
};
