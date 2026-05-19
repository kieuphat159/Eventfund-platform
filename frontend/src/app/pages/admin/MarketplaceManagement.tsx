import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, TrendingUp, DollarSign, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  getListings,
  getMarketplaceStats,
  getMarketplaceHistory,
  type ApiListing,
  type MarketplaceStats,
  type TransactionHistory,
  type GetHistoryParams,
} from "../../services/listings.service";
import { formatEther } from "ethers";
import { logger } from "../../lib/logger";

export const MarketplaceManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketplaceStats, setMarketplaceStats] = useState<MarketplaceStats>({
    totalListings: 0,
    activeListings: 0,
    soldListings: 0,
    cancelledListings: 0,
    totalVolume: "0",
    averagePrice: "0",
  });
  const [activeListings, setActiveListings] = useState<ApiListing[]>([]);
  const [activeListingsCount, setActiveListingsCount] = useState(0);
  const [historyData, setHistoryData] = useState<TransactionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const fetchMarketplaceData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [stats, activeListingsPayload] = await Promise.all([
          getMarketplaceStats(),
          getListings({ status: "active", page: 1, limit: 6 }),
        ]);

        setMarketplaceStats(stats);
        setActiveListings(activeListingsPayload.docs || []);
        setActiveListingsCount(activeListingsPayload.totalDocs || 0);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load marketplace data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMarketplaceData();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const params: GetHistoryParams = {
          page: 1,
          limit: 10,
          sort: "soldAt",
          order: "desc",
        };
        const result = await getMarketplaceHistory(params);
        setHistoryData(result.docs || []);
      } catch (err) {
        logger.error(
          "marketplace-admin",
          "Failed to load marketplace history",
          err instanceof Error ? err.message : err,
        );
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatWeiToEth = (weiValue: string) => {
    try {
      return `${Number(formatEther(weiValue))
        .toFixed(3)
        .replace(/\.?0+$/, "")} ETH`;
    } catch {
      return "0 ETH";
    }
  };

  const stats = useMemo(
    () => [
      {
        label: "Total Listings",
        value: marketplaceStats.totalListings.toString(),
        icon: Package,
        color: "from-blue-500 to-cyan-500",
      },
      {
        label: "Active Listings",
        value: activeListingsCount.toString(),
        icon: ShoppingCart,
        color: "from-green-500 to-emerald-500",
      },
      {
        label: "Sold Listings",
        value: marketplaceStats.soldListings.toString(),
        icon: TrendingUp,
        color: "from-orange-500 to-red-500",
      },
      {
        label: "Total Volume",
        value: formatWeiToEth(marketplaceStats.totalVolume),
        icon: DollarSign,
        color: "from-purple-500 to-pink-500",
      },
    ],
    [activeListingsCount, marketplaceStats],
  );

  const formatTime = (date: string | null | undefined) => {
    if (!date) return "N/A";
    try {
      const time = new Date(date).getTime();
      const now = new Date().getTime();
      const diff = now - time;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Marketplace Management
        </h1>
        <p className="text-slate-400">
          Monitor ticket sales and marketplace activity
        </p>
      </div>

      {/* Stats */}
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

      {error && (
        <Card className="bg-slate-900 border-red-800">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Active Listings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Active Listings</CardTitle>
          <CardDescription className="text-slate-400">
            Current tickets for sale on marketplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading && activeListings.length === 0 && (
              <p className="text-slate-400">Loading active listings...</p>
            )}
            {!loading && activeListings.length === 0 && (
              <p className="text-slate-400">No active listings found.</p>
            )}
            {activeListings.map((listing) => (
              <div
                key={listing._id || listing.id}
                className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <h4 className="font-semibold text-white mb-1">
                  {listing.eventId?.title || "Unknown Event"}
                </h4>
                <p className="text-sm text-slate-400 mb-3">
                  {listing.ticketId?.ticketType || "Standard"}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">Seller:</span>
                  <code className="text-xs text-slate-300">
                    {listing.seller?.slice(0, 10)}...
                  </code>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-lg font-bold text-purple-400">
                    {formatWeiToEth(listing.price)}
                  </span>
                  {/* <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 hover:bg-slate-700 text-white"
                  >
                    Manage
                  </Button> */}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Sales</CardTitle>
          <CardDescription className="text-slate-400">
            Latest marketplace transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Event
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Tier
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Price
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Buyer
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Seller
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 px-4 text-center text-slate-400"
                    >
                      Loading transaction history...
                    </td>
                  </tr>
                )}
                {!historyLoading && historyData.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 px-4 text-center text-slate-400"
                    >
                      No transactions found.
                    </td>
                  </tr>
                )}
                {historyData.map((sale) => (
                  <tr
                    key={sale.listingId}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="py-4 px-4 text-sm text-white">
                      {sale.event || "Unknown Event"}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-400">
                      {sale.tier || "N/A"}
                    </td>
                    <td className="py-4 px-4 text-sm text-purple-400 font-medium">
                      {formatWeiToEth(sale.price)}
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">
                        {sale.buyer ? `${sale.buyer.slice(0, 10)}...` : "N/A"}
                      </code>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">
                        {sale.seller ? `${sale.seller.slice(0, 10)}...` : "N/A"}
                      </code>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500 text-right">
                      {formatTime(sale.time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
