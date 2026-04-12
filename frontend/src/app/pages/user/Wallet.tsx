import React from "react";
import {
  Wallet as WalletIcon,
  Send,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../contexts/AuthContext";

export const Wallet: React.FC = () => {
  const { user } = useAuth();

  const balance = {
    eth: "12.458",
    usd: "$24,916.00",
  };

  const transactions = [
    {
      id: "1",
      type: "received",
      description: "Ticket Sale - Crypto Music Festival",
      amount: "+2.5 ETH",
      date: "2026-03-04",
      time: "14:32",
      hash: "0x9a3bc...7f2e1",
    },
    {
      id: "2",
      type: "sent",
      description: "Investment - Web3 Summit",
      amount: "-3.0 ETH",
      date: "2026-03-03",
      time: "10:15",
      hash: "0x7c2ab...4d9f2",
    },
    {
      id: "3",
      type: "received",
      description: "Marketplace Sale - VIP Ticket",
      amount: "+0.8 ETH",
      date: "2026-03-02",
      time: "18:45",
      hash: "0x5e1cd...3a8b4",
    },
    {
      id: "4",
      type: "sent",
      description: "Ticket Purchase - NFT Art Gallery",
      amount: "-0.6 ETH",
      date: "2026-03-01",
      time: "09:20",
      hash: "0x2d4ef...6c5a7",
    },
    {
      id: "5",
      type: "received",
      description: "Investment Return - Blockchain Workshop",
      amount: "+1.2 ETH",
      date: "2026-02-28",
      time: "16:00",
      hash: "0x8f6ba...1e3d9",
    },
  ];

  const walletAddress = user?.walletAddress;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Wallet</h1>
        <p className="text-slate-400">
          Manage your digital assets and transactions
        </p>
      </div>

      <Card className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-purple-500/30">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-purple-300 mb-1">Wallet Address</p>
              <div className="flex items-center space-x-2">
                <code className="text-white bg-slate-900/50 px-3 py-2 rounded-lg">
                  {walletAddress
                    ? `${walletAddress.slice(0, 12)}...${walletAddress.slice(-8)}`
                    : "Not connected"}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-500/30 hover:bg-purple-500/10"
                  onClick={() => {
                    if (walletAddress) {
                      navigator.clipboard.writeText(walletAddress);
                    }
                  }}
                  disabled={!walletAddress}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <WalletIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-purple-300 mb-2">Total Balance</p>
            <div className="flex items-baseline space-x-3">
              <h2 className="text-4xl font-bold text-white">{balance.eth} ETH</h2>
              <span className="text-xl text-slate-300">{balance.usd}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Button className="bg-slate-900/50 hover:bg-slate-900/70 text-white border border-purple-500/30">
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
            <Button className="bg-slate-900/50 hover:bg-slate-900/70 text-white border border-purple-500/30">
              <Download className="w-4 h-4 mr-2" />
              Receive
            </Button>
            <Button className="bg-slate-900/50 hover:bg-slate-900/70 text-white border border-purple-500/30">
              Swap
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">This Month</p>
            <p className="text-2xl font-bold text-green-400">+5.8 ETH</p>
            <p className="text-xs text-slate-500 mt-1">Income</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">This Month</p>
            <p className="text-2xl font-bold text-red-400">-4.2 ETH</p>
            <p className="text-xs text-slate-500 mt-1">Expenses</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Net Change</p>
            <p className="text-2xl font-bold text-white">+1.6 ETH</p>
            <p className="text-xs text-green-500 mt-1">+12.8%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Transaction History</CardTitle>
          <CardDescription className="text-slate-400">
            Your recent wallet activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === "received" ? "bg-green-500/10" : "bg-red-500/10"
                    }`}
                  >
                    {tx.type === "received" ? (
                      <ArrowDownLeft className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-red-400" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-white">
                      {tx.description}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-slate-500">
                        {tx.date} at {tx.time}
                      </span>
                      <code className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
                        {tx.hash}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      tx.type === "received" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {tx.amount}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};