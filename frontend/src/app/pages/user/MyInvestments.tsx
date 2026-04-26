import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  claimContributionRefundOnChain,
  getInvestments,
  InvestmentDetail as InvestmentDetailType,
} from "../../services/investment.service";
import { useAuth } from "../../contexts/AuthContext";
import { useWeb3Auth } from "@web3auth/modal/react";
import {
  addIntegerValues,
  calculatePercentage,
  compareIntegerValues,
  formatIntegerWithUnit,
  subtractIntegerValues,
} from "../../lib/utils";
import { StatusBadge } from "../../components/StatusBadge";

export const MyInvestments: React.FC = () => {
  const { user, connectWallet } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const [investments, setInvestments] = useState<InvestmentDetailType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundingEventId, setRefundingEventId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvestments = async () => {
      try {
        const shares = await getInvestments();
        setInvestments(shares);
      } catch (error) {
        console.error("Failed to load investments:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.walletAddress) {
      fetchInvestments();
    } else {
      setLoading(false);
    }
  }, [user]);

  const walletProvider = web3Auth?.provider as
    | {
        request: (args: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      }
    | undefined;

  const refreshInvestments = async () => {
    const shares = await getInvestments();
    setInvestments(shares);
  };

  const handleClaimRefund = async (investment: InvestmentDetailType) => {
    const eventId = investment.eventId?._id;
    if (!eventId) return;

    try {
      if (!user?.walletAddress) {
        await connectWallet();
        return;
      }

      if (!walletProvider?.request) {
        throw new Error(
          "Wallet provider is not ready. Please reconnect wallet and try again.",
        );
      }

      setRefundingEventId(eventId);
      await claimContributionRefundOnChain(
        walletProvider,
        eventId,
        user.walletAddress,
      );
      await refreshInvestments();
    } catch (error) {
      console.error("Failed to claim contribution refund:", error);
    } finally {
      setRefundingEventId(null);
    }
  };

  const totalInvested = investments.reduce(
    (sum, inv) => addIntegerValues(sum, inv.contributionAmount),
    "0",
  );
  const totalReturns = investments.reduce(
    (sum, inv) => addIntegerValues(sum, inv.claimedReward, inv.pendingReward),
    "0",
  );
  const roi = calculatePercentage(totalReturns, totalInvested, 1);
  const activeCount = investments.filter((inv) =>
    ["funding", "ticketing", "ongoing", "completed"].includes(
      inv.eventId?.status || "",
    ),
  ).length;

  const stats = [
    {
      label: "Total Invested",
      value: formatIntegerWithUnit(totalInvested, "wei"),
      icon: DollarSign,
      color: "from-cyan-500 to-sky-500",
    },
    {
      label: "Total Returns",
      value: formatIntegerWithUnit(totalReturns, "wei"),
      icon: TrendingUp,
      color: "from-green-500 to-emerald-500",
    },
    {
      label: "ROI",
      value: `${roi.toFixed(1)}%`,
      icon: PieChart,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Active Investments",
      value: activeCount.toString(),
      icon: Calendar,
      color: "from-teal-500 to-emerald-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          My Investments
        </h1>
        <p className="text-slate-400">
          Track your event investments and returns
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="bg-slate-900/90 border-slate-800 hover:border-cyan-400/40 transition-colors"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900/90 border-slate-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-white">Investment Portfolio</CardTitle>
          <CardDescription className="text-slate-400">
            Your active and completed investments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              Loading your investments...
            </div>
          ) : investments.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-slate-400">No investments found yet.</p>
              <Link to="/explore">
                <Button className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white">
                  Browse events to invest
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {investments.map((investment) => {
                const itemTotalReturns = addIntegerValues(
                  investment.claimedReward,
                  investment.pendingReward,
                );
                const profitLoss = subtractIntegerValues(
                  itemTotalReturns,
                  investment.contributionAmount,
                );
                const profitPercent = calculatePercentage(
                  profitLoss,
                  investment.contributionAmount,
                  1,
                );
                const isProfit = compareIntegerValues(profitLoss, "0") >= 0;
                const canClaimRefund =
                  investment.eventId?.status === "cancelled" &&
                  compareIntegerValues(investment.contributionAmount, "0") > 0;
                const refundEventId = investment.eventId?._id || null;

                return (
                  <div
                    key={investment._id}
                    className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 hover:border-cyan-400/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-2">
                          {investment.eventId?.title || "Untitled investment"}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          <StatusBadge
                            status={investment.eventId?.status || "unknown"}
                          />
                          <span>
                            Invested:{" "}
                            {new Date(
                              investment.createdAt,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${isProfit ? "text-emerald-300" : "text-red-300"}`}
                        >
                          {isProfit ? "+" : ""}
                          {profitPercent.toFixed(1)}%
                        </div>
                        <div className="text-xs text-slate-500">ROI</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                        <p className="text-xs text-slate-500 mb-1">
                          Amount Invested
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {formatIntegerWithUnit(
                            investment.contributionAmount,
                            "wei",
                          )}
                        </p>
                      </div>
                      <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                        <p className="text-xs text-slate-500 mb-1">
                          Total Returns
                        </p>
                        <p className="text-sm font-semibold text-cyan-300">
                          {formatIntegerWithUnit(itemTotalReturns, "wei")}
                        </p>
                      </div>
                      <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                        <p className="text-xs text-slate-500 mb-1">
                          Profit/Loss
                        </p>
                        <p
                          className={`text-sm font-semibold ${isProfit ? "text-emerald-300" : "text-red-300"}`}
                        >
                          {isProfit ? "+" : ""}
                          {formatIntegerWithUnit(profitLoss, "wei")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                        Share: {investment.sharePercentage.toFixed(2)}% of
                        donator revenue pool
                      </div>
                      <Link to={`/app/investments/${investment._id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 hover:bg-slate-700 text-white"
                        >
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </Link>
                      {canClaimRefund && refundEventId && (
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                          disabled={refundingEventId === refundEventId}
                          onClick={() => void handleClaimRefund(investment)}
                        >
                          {refundingEventId === refundEventId
                            ? "Claiming Refund..."
                            : "Claim Refund"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-900/20 via-emerald-900/20 to-slate-900/40">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-semibold text-white mb-2">
                Discover Investment Opportunities
              </h3>
              <p className="text-slate-300">
                Browse events and invest in their success
              </p>
            </div>
            <Link to="/explore">
              <Button className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white">
                Browse Events
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
