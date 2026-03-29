import React, { useEffect } from "react";
import { Wallet } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router";

export const LoginPage: React.FC = () => {
  const { connectWallet, isLoading, error, user } = useAuth();
  const navigate = useNavigate();

  // Redirect right away if user is already authenticated
  useEffect(() => {
    if (user && user.role !== "public") {
      navigate("/app/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await connectWallet();
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
          Welcome to EventChain
        </h1>
        <p className="text-slate-400 mb-8 text-sm">
          Sign in with Google, Email, or MetaMask. Your Smart Account wallet
          will be created automatically.
        </p>

        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Wallet className="w-5 h-5 mr-2" />
          {isLoading
            ? "Connecting and creating wallet..."
            : "Sign in with Google or MetaMask"}
        </Button>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
};
