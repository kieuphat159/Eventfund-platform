import React, { useEffect } from "react"; // Thêm useEffect
import { Wallet } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router"; // 1. Import useNavigate

export const LoginPage: React.FC = () => {
  const { connectWallet, isLoading, error, user } = useAuth(); // Lấy thêm 'user'
  const navigate = useNavigate(); // 2. Khởi tạo navigate

  // 3. Theo dõi biến 'user', nếu role không còn là 'public' thì chuyển trang ngay
  useEffect(() => {
    if (user && user.role !== "public") {
      // Nhảy sang /app/dashboard (theo đúng cấu trúc App.tsx mình gửi lúc nãy)
      navigate("/app/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await connectWallet();
      // Sau khi hàm này chạy xong, useEffect ở trên sẽ tự động đá user đi
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md px-8 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Chào mừng đến EventChain
        </h1>
        <p className="text-slate-400 mb-8 text-sm">
          Đăng nhập bằng Google, Email hoặc MetaMask. Ví Smart Account sẽ được
          tạo tự động.
        </p>

        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Wallet className="w-5 h-5 mr-2" />
          {isLoading
            ? "Đang kết nối và tạo ví..."
            : "Đăng nhập bằng Google hoặc MetaMask"}
        </Button>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
};
