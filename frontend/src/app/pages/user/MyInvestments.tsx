import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, DollarSign, PieChart, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  getInvestments,
  InvestmentDetail as InvestmentDetailType,
} from "../../services/investment.service";
import { useAuth } from "../../contexts/AuthContext";

export const MyInvestments: React.FC = () => {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<InvestmentDetailType[]>([]);
  const [loading, setLoading] = useState(true);

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

  const totalInvested = investments.reduce(
    (sum, inv) => sum + inv.contributionAmount,
    0,
  );
  const totalReturns = investments.reduce(
    (sum, inv) => sum + inv.claimedReward + inv.pendingReward,
    0,
  );
  const roi = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
  const activeCount = investments.filter((inv) =>
    ["funding", "ticketing", "ongoing", "completed"].includes(
      inv.eventId?.status || "",
    ),
  ).length;

  const stats = [
    {
      label: "Total Invested",
      value: `${totalInvested.toFixed(4)} ETH`,
      icon: DollarSign,
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "Total Returns",
      value: `${totalReturns.toFixed(4)} ETH`,
      icon: TrendingUp,
      color: "from-green-500 to-emerald-500",
    },
    {
      label: "ROI",
      value: `${roi.toFixed(1)}%`,
      icon: PieChart,
      color: "from-purple-500 to-pink-500",
    },
    {
      label: "Active Investments",
      value: activeCount.toString(),
      icon: Calendar,
      color: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Investments</h1>
        <p className="text-slate-400">
          Track your event investments and returns
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
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

      <Card className="bg-slate-900 border-slate-800">
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
              <Link to="/app/events/my-events">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                  Browse events to invest
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {investments.map((investment) => {
                const totalReturns =
                  investment.claimedReward + investment.pendingReward;
                const profitLoss = totalReturns - investment.contributionAmount;
                const profitPercent =
                  investment.contributionAmount > 0
                    ? (profitLoss / investment.contributionAmount) * 100
                    : 0;
                const isProfit = profitLoss >= 0;

                return (
                  <div
                    key={investment._id}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-1">
                          {investment.eventId?.title || "Untitled investment"}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          <span
                            className={`px-2 py-1 rounded capitalize ${
                              investment.eventId?.status === "active"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-slate-500/10 text-slate-400"
                            }`}
                          >
                            {investment.eventId?.status || "unknown"}
                          </span>
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
                          className={`text-lg font-bold ${isProfit ? "text-green-400" : "text-slate-400"}`}
                        >
                          {isProfit ? "+" : ""}
                          {profitPercent.toFixed(1)}%
                        </div>
                        <div className="text-xs text-slate-500">ROI</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="bg-slate-800 rounded p-3">
                        <p className="text-xs text-slate-500 mb-1">
                          Amount Invested
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {investment.contributionAmount.toFixed(4)} ETH
                        </p>
                      </div>
                      <div className="bg-slate-800 rounded p-3">
                        <p className="text-xs text-slate-500 mb-1">
                          Total Returns
                        </p>
                        <p className="text-sm font-semibold text-purple-400">
                          {totalReturns.toFixed(4)} ETH
                        </p>
                      </div>
                      <div className="bg-slate-800 rounded p-3">
                        <p className="text-xs text-slate-500 mb-1">
                          Profit/Loss
                        </p>
                        <p
                          className={`text-sm font-semibold ${isProfit ? "text-green-400" : "text-slate-400"}`}
                        >
                          {isProfit ? "+" : ""}
                          {profitLoss.toFixed(4)} ETH
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        Share: {investment.sharePercentage}% of event revenue
                      </div>
                      <Link to={`/app/investments/${investment._id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 hover:bg-slate-800 text-white"
                        >
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-white mb-2">
                Discover Investment Opportunities
              </h3>
              <p className="text-slate-300">
                Browse events and invest in their success
              </p>
            </div>
            <Link to="/app/events/my-events">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                Browse Events
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
