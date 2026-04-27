import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet as WalletIcon,
  Send,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
} from "lucide-react";
import { DepositModal } from "../../components/shared/DepositModal";
import { formatEther } from "ethers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { useLoading } from "../../components/ui/loadingContext";
import { getUserTickets } from "../../services/tickets.service";
import { getInvestments } from "../../services/investment.service";
import { getMarketplaceHistory } from "../../services/listings.service";
import { userService } from "../../services/user.service";
import {
  addIntegerValues,
  compareIntegerValues,
  formatIntegerValue,
  formatIntegerWithUnit,
  subtractIntegerValues,
} from "../../lib/utils";

type WalletTransaction = {
  id: string;
  type: "received" | "sent";
  description: string;
  amountWei: string;
  date: string;
  hash?: string | null;
};

type WalletBalance = {
  wei: string;
  eth: string;
};

const BALANCE_RPC_URL =
  (import.meta.env.VITE_WEB3AUTH_RPC_URL as string | undefined) ||
  (import.meta.env.VITE_RPC_URL as string | undefined) ||
  "https://ethereum-sepolia-rpc.publicnode.com";

async function fetchWalletBalance(walletAddress: string): Promise<WalletBalance> {
  const response = await fetch(BALANCE_RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [walletAddress, "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch wallet balance (${response.status})`);
  }

  const payload = await response.json();
  const wei = BigInt(payload?.result || "0x0").toString();
  const eth = Number(formatEther(BigInt(wei))).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });

  return { wei, eth };
}

function truncateHash(hash?: string | null): string {
  if (!hash) return "No tx hash";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export const Wallet: React.FC = () => {
  const { user } = useAuth();
  const walletAddress = user?.walletAddress;
  const { show: showLoading, hide: hideLoading } = useLoading();

  const [balance, setBalance] = useState<WalletBalance>({
    wei: "0",
    eth: "0",
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadWalletData = async () => {
      if (!walletAddress) {
        setBalance({ wei: "0", eth: "0" });
        setTransactions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      showLoading('Loading wallet...');

      const [
        balanceResult,
        ticketsResult,
        investmentsResult,
        rewardsResult,
        marketplaceSalesResult,
      ] = await Promise.allSettled([
        fetchWalletBalance(walletAddress),
        getUserTickets(walletAddress),
        getInvestments(),
        userService.getUserRewards(),
        getMarketplaceHistory({
          seller: walletAddress.toLowerCase(),
          page: 1,
          limit: 100,
          sort: "soldAt",
          order: "desc",
        }),
      ]);

      setBalance(
        balanceResult.status === "fulfilled"
          ? balanceResult.value
          : { wei: "0", eth: "0" },
      );

      const nextTransactions: WalletTransaction[] = [];

      if (ticketsResult.status === "fulfilled") {
        ticketsResult.value.forEach((ticket) => {
          if (!ticket.soldAt) return;

          const eventTitle =
            typeof ticket.eventId === "object" ? ticket.eventId?.title : null;

          nextTransactions.push({
            id: `ticket-${ticket.tokenId}-purchase`,
            type: "sent",
            description: `Ticket Purchase - ${eventTitle || `Event ${ticket.eventIdRaw || "-"}`}`,
            amountWei: String(ticket.originalPrice || "0"),
            date: ticket.soldAt,
            hash:
              // prefer explicit soldTxHash set by backend, fall back to any transferHistory entry
              (ticket as any).soldTxHash ||
              ((ticket as any).transferHistory?.length
                ? (ticket as any).transferHistory[(ticket as any).transferHistory.length - 1].txHash
                : null) ||
              null,
          });
        });
      }

      if (investmentsResult.status === "fulfilled") {
        investmentsResult.value.forEach((investment) => {
          if (!investment.createdAt) return;

          nextTransactions.push({
            id: `investment-${investment._id}`,
            type: "sent",
            description: `Investment - ${investment.eventId?.title || "Event"}`,
            amountWei: String(investment.contributionAmount || "0"),
            date: investment.createdAt,
            hash: (investment as any).txHash || (investment as any).transactionHash || null,
          });
        });
      }

      if (rewardsResult.status === "fulfilled") {
        rewardsResult.value.claimed.forEach((reward, index) => {
          if (!reward.claimedAt) return;

          const eventTitle =
            reward.eventTitle ||
            (typeof reward.eventId === "object" ? reward.eventId?.title : null) ||
            "Event";

          nextTransactions.push({
            id: `reward-${reward.txHash || index}`,
            type: "received",
            description: `Reward Claim - ${eventTitle}`,
            amountWei: String(reward.rewardAmount || "0"),
            date: reward.claimedAt,
            hash: reward.txHash || null,
          });
        });
      }

      if (marketplaceSalesResult.status === "fulfilled") {
        marketplaceSalesResult.value.docs.forEach((sale) => {
          if (!sale.time) return;

          nextTransactions.push({
            id: `marketplace-sale-${sale.listingId}`,
            type: "received",
            description: `Marketplace Sale - ${sale.event || `Ticket #${sale.tokenId}`}`,
            amountWei: String(sale.price || "0"),
            date: sale.time,
            hash: (sale as any).txHash || (sale as any).transactionHash || null,
          });
        });
      }

      nextTransactions.sort(
        (left, right) =>
          new Date(right.date).getTime() - new Date(left.date).getTime(),
      );

      setTransactions(nextTransactions.slice(0, 20));
      setLoading(false);
      hideLoading();
    };

    loadWalletData();
  }, [walletAddress]);

  const currentMonthTransactions = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return (
        transactionDate.getMonth() === month &&
        transactionDate.getFullYear() === year
      );
    });
  }, [transactions]);

  const monthlyIncome = useMemo(() => {
    return currentMonthTransactions
      .filter((transaction) => transaction.type === "received")
      .reduce(
        (sum, transaction) => addIntegerValues(sum, transaction.amountWei),
        "0",
      );
  }, [currentMonthTransactions]);

  const monthlyExpenses = useMemo(() => {
    return currentMonthTransactions
      .filter((transaction) => transaction.type === "sent")
      .reduce(
        (sum, transaction) => addIntegerValues(sum, transaction.amountWei),
        "0",
      );
  }, [currentMonthTransactions]);

  const netChange = useMemo(() => {
    return subtractIntegerValues(monthlyIncome, monthlyExpenses);
  }, [monthlyExpenses, monthlyIncome]);

  const isNetPositive = compareIntegerValues(netChange, "0") >= 0;

  const handleDepositSuccess = async () => {
    // Reload wallet balance after successful deposit
    if (walletAddress) {
      try {
        const newBalance = await fetchWalletBalance(walletAddress);
        setBalance(newBalance);
      } catch (error) {
        console.error("Failed to reload balance:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Wallet</h1>
        <p className="text-slate-400">
          Manage your digital assets and transactions
        </p>
      </div>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onSuccess={handleDepositSuccess}
      />

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
                  className={`border-purple-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform ${
                    copied ? "bg-emerald-600 text-white scale-105" : "hover:bg-purple-500/10"
                  }`}
                  onClick={async () => {
                    if (!walletAddress) return;
                    try {
                      await navigator.clipboard.writeText(walletAddress);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    } catch {
                      // ignore clipboard errors silently
                    }
                  }}
                  disabled={!walletAddress}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-emerald-200" /> Copied
                    </>
                  ) : (
                    "Copy"
                  )}
                </Button>
              </div>
            </div>

            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <WalletIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-purple-300 mb-2">On-chain Balance</p>
            <div className="flex flex-col gap-1">
              <h2 className="text-4xl font-bold text-white">
                {loading ? "Loading..." : `${balance.eth} ETH`}
              </h2>
              <span className="text-sm text-slate-300">
                {formatIntegerWithUnit(balance.wei, "wei")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Button
              className="bg-slate-900/50 hover:bg-slate-900/70 text-white border border-purple-500/30"
              disabled
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white border-0"
              onClick={() => setIsDepositModalOpen(true)}
            >
              <Download className="w-4 h-4 mr-2" />
              Receive
            </Button>
            <Button
              className="bg-slate-900/50 hover:bg-slate-900/70 text-white border border-purple-500/30"
              disabled
            >
              Swap
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">This Month</p>
            <p className="text-2xl font-bold text-green-400">
              +{formatIntegerValue(monthlyIncome)} wei
            </p>
            <p className="text-xs text-slate-500 mt-1">Income</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">This Month</p>
            <p className="text-2xl font-bold text-red-400">
              -{formatIntegerValue(monthlyExpenses)} wei
            </p>
            <p className="text-xs text-slate-500 mt-1">Expenses</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Net Change</p>
            <p
              className={`text-2xl font-bold ${isNetPositive ? "text-white" : "text-red-300"}`}
            >
              {isNetPositive ? "+" : ""}
              {formatIntegerValue(netChange)} wei
            </p>
            <p
              className={`text-xs mt-1 ${isNetPositive ? "text-green-500" : "text-red-400"}`}
            >
              {currentMonthTransactions.length} tracked transaction
              {currentMonthTransactions.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Transaction History</CardTitle>
          <CardDescription className="text-slate-400">
            Your recent wallet activity built from tickets, rewards, investments,
            and marketplace sales
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              Loading wallet activity...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No wallet activity found yet.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const transactionDate = new Date(transaction.date);

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          transaction.type === "received"
                            ? "bg-green-500/10"
                            : "bg-red-500/10"
                        }`}
                      >
                        {transaction.type === "received" ? (
                          <ArrowDownLeft className="w-5 h-5 text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-red-400" />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-white">
                          {transaction.description}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-slate-500">
                            {transactionDate.toLocaleDateString()} at{" "}
                            {transactionDate.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <code className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
                            {truncateHash(transaction.hash)}
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          transaction.type === "received"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {transaction.type === "received" ? "+" : "-"}
                        {formatIntegerValue(transaction.amountWei)} wei
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
