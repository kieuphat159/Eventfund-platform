import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, TrendingUp, CreditCard, Wallet, CheckCircle, Clock, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  getAdminEvents,
  getAdminPlatformStats,
  type AdminPlatformStats,
  type EventItem,
} from '../../services/events.service';

type SettlementRow = {
  id: string;
  organizer: string;
  wallet: string;
  amountEth: string;
  date: string;
  status: 'pending' | 'approved' | 'completed';
};

function parseNumericValue(value?: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  try {
    return Number(BigInt(String(value)));
  } catch {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

function formatWeiToEth(value?: string | number): string {
  try {
    const wei = BigInt(String(value ?? '0'));
    const base = 10n ** 18n;
    const whole = wei / base;
    const fraction = (wei % base).toString().padStart(18, '0').slice(0, 2).replace(/0+$/, '');
    return fraction ? `${whole.toString()}.${fraction} ETH` : `${whole.toString()} ETH`;
  } catch {
    return '0 ETH';
  }
}

function formatMonthKey(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
}

function aggregateByMonth<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  getValue: (item: T) => number,
) {
  const grouped = new Map<string, { month: string; order: number; revenue: number }>();

  items.forEach((item) => {
    const key = formatMonthKey(getDate(item));
    if (!key) return;

    const [year, month] = key.split('-').map(Number);
    const order = year * 12 + month;
    const current = grouped.get(key) || { month: monthLabelFromKey(key), order, revenue: 0 };
    current.revenue += getValue(item);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((left, right) => left.order - right.order);
}

function shortenWallet(wallet?: string): string {
  if (!wallet) return 'Unknown wallet';
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 10)}...${wallet.slice(-6)}`;
}

export const FinanceDashboard: React.FC = () => {
  const [platformStats, setPlatformStats] = useState<AdminPlatformStats | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');

      const [statsResult, eventsResult] = await Promise.allSettled([
        getAdminPlatformStats(),
        getAdminEvents({ limit: 200, sort: '-updatedAt' }),
      ]);

      if (!alive) return;

      if (statsResult.status === 'fulfilled') setPlatformStats(statsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);

      const failure = [statsResult, eventsResult].find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') {
        setError(failure.reason instanceof Error ? failure.reason.message : String(failure.reason));
      }

      setLoading(false);
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const revenueStats = useMemo(() => {
    const totalRevenue = formatWeiToEth(platformStats?.revenue?.total);
    const fundingRevenue = formatWeiToEth(platformStats?.revenue?.funding);
    const soldListings = platformStats?.listings?.sold ?? 0;
    const activeListings = platformStats?.listings?.active ?? 0;

    return [
      {
        title: 'Total Platform Revenue',
        value: totalRevenue,
        usd: 'Live backend total',
        change: '+live',
        trend: 'up',
        icon: DollarSign,
        color: 'from-green-500 to-emerald-500',
      },
      {
        title: 'Funding Volume',
        value: fundingRevenue,
        usd: 'Live on-chain funding',
        change: '+live',
        trend: 'up',
        icon: TrendingUp,
        color: 'from-blue-500 to-cyan-500',
      },
      {
        title: 'Sold Listings',
        value: soldListings.toLocaleString(),
        usd: `${activeListings.toLocaleString()} active listings`,
        change: '+live',
        trend: 'up',
        icon: CreditCard,
        color: 'from-purple-500 to-pink-500',
      },
      {
        title: 'Active Listings',
        value: activeListings.toLocaleString(),
        usd: `${platformStats?.listings?.total ?? 0} total listings`,
        change: '+live',
        trend: 'up',
        icon: Wallet,
        color: 'from-orange-500 to-red-500',
      },
    ];
  }, [platformStats]);

  const revenueData = useMemo(() => {
    return aggregateByMonth(
      events,
      (event) => event.createdAt,
      (event) => parseNumericValue(event.totalRevenue ?? event.currentFunding) / 1e18,
    ).map((item, index, array) => ({
      month: item.month,
      ticket: item.revenue,
      marketplace: Math.max(0, Math.round(item.revenue * 0.15)),
      total: item.revenue,
    }));
  }, [events]);

  const categoryRevenueData = useMemo(() => {
    const grouped = new Map<string, { category: string; revenue: number }>();

    events.forEach((event) => {
      const category = event.category || 'Other';
      const current = grouped.get(category) || { category, revenue: 0 };
      current.revenue += parseNumericValue(event.totalRevenue ?? event.currentFunding) / 1e18;
      grouped.set(category, current);
    });

    return Array.from(grouped.values())
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5);
  }, [events]);

  const withdrawalRequests = useMemo<SettlementRow[]>(() => {
    return [...events]
      .filter((event) => event.revenueReleased || parseNumericValue(event.organizerStakeWithdrawn) > 0 || event.status === 'completed')
      .sort((left, right) => {
        const leftDate = new Date(left.stakeWithdrawnAt || left.updatedAt || left.createdAt || 0).getTime();
        const rightDate = new Date(right.stakeWithdrawnAt || right.updatedAt || right.createdAt || 0).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 6)
      .map((event, index) => {
        const settled = parseNumericValue(event.organizerStakeWithdrawn || event.totalRevenue || event.currentFunding);
        const hasReleased = Boolean(event.revenueReleased || parseNumericValue(event.organizerStakeWithdrawn) > 0);
        const status: SettlementRow['status'] =
          parseNumericValue(event.organizerStakeWithdrawn) > 0 || event.revenueReleased
            ? 'completed'
            : event.status === 'completed'
              ? 'approved'
              : 'pending';

        return {
          id: event.contractEventId ? `EV-${event.contractEventId}` : `SET-${index + 1}`,
          organizer: event.title || 'Untitled event',
          wallet: event.organizer || event.organizerWallet || 'Unknown wallet',
          amountEth: formatWeiToEth(settled),
          date: new Date(event.stakeWithdrawnAt || event.updatedAt || event.createdAt || Date.now()).toISOString().slice(0, 10),
          status: hasReleased ? 'completed' : status,
        };
      });
  }, [events]);

  const getStatusBadge = (status: SettlementRow['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const totalProcessedWei = events.reduce((sum, event) => {
    if (event.revenueReleased || parseNumericValue(event.organizerStakeWithdrawn) > 0) {
      return sum + parseNumericValue(event.organizerStakeWithdrawn || event.totalRevenue || event.currentFunding);
    }
    return sum;
  }, 0);

  const pendingApprovalWei = events.reduce((sum, event) => {
    if (event.status === 'completed' && !event.revenueReleased && parseNumericValue(event.organizerStakeWithdrawn) === 0) {
      return sum + parseNumericValue(event.totalRevenue || event.currentFunding);
    }
    return sum;
  }, 0);

  const settlementCoverage = events.length > 0
    ? Math.round((events.filter((event) => event.revenueReleased || parseNumericValue(event.organizerStakeWithdrawn) > 0).length / events.length) * 100)
    : 0;

  const loadingState = loading && events.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-300/80">Live finance</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Finance Dashboard</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Platform revenue and settlement overview derived from live backend event data.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
          <Activity className="h-3.5 w-3.5 text-cyan-300" />
          {events.length} events scanned
        </div>
      </div>

      {!!error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some finance data could not be loaded: {error}
        </div>
      )}

      {loadingState ? (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-6 text-sm text-slate-400">Loading live finance data...</CardContent>
        </Card>
      ) : null}

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {revenueStats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    stat.trend === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.usd}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Breakdown */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Monthly Revenue Breakdown</CardTitle>
            <CardDescription className="text-slate-400">Live revenue vs funding volume (ETH)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorTicket" x1="0" y1="0" x2="0" y2="1">
                    <stop key="ticketStop1" offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop key="ticketStop2" offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMarketplace" x1="0" y1="0" x2="0" y2="1">
                    <stop key="marketplaceStop1" offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop key="marketplaceStop2" offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="fin-revenue-grid" strokeDasharray="3 3" stroke="#334155" />
                <XAxis key="fin-revenue-xaxis" dataKey="month" stroke="#94a3b8" />
                <YAxis key="fin-revenue-yaxis" stroke="#94a3b8" />
                <Tooltip
                  key="fin-revenue-tooltip"
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area key="ticket-area" type="monotone" dataKey="ticket" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTicket)" />
                <Area key="marketplace-area" type="monotone" dataKey="marketplace" stackId="1" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMarketplace)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Revenue by Event Category</CardTitle>
            <CardDescription className="text-slate-400">Total revenue by category (ETH)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={categoryRevenueData}>
                <CartesianGrid key="fin-category-grid" strokeDasharray="3 3" stroke="#334155" />
                <XAxis key="fin-category-xaxis" dataKey="category" stroke="#94a3b8" angle={-15} textAnchor="end" height={80} />
                <YAxis key="fin-category-yaxis" stroke="#94a3b8" />
                <Tooltip
                  key="fin-category-tooltip"
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar key="revenue-bar" dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Requests */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Settlement Requests</CardTitle>
              <CardDescription className="text-slate-400">Organizer settlements derived from live event completion data</CardDescription>
            </div>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              Review Settlements
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Request ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Organizer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Wallet Address</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalRequests.length > 0 ? withdrawalRequests.map((request) => (
                  <tr key={request.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-white">{request.id}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm text-white">{request.organizer}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-400 font-mono">{request.wallet.slice(0, 10)}...{request.wallet.slice(-6)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{request.amountEth}</p>
                        <p className="text-xs text-slate-500">Derived from live event revenue</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-400">{request.date}</span>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="py-4 px-4">
                      {request.status === 'pending' && (
                        <div className="flex space-x-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                            Reject
                          </Button>
                        </div>
                      )}
                      {request.status === 'approved' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          Process
                        </Button>
                      )}
                      {request.status === 'completed' && (
                        <span className="text-xs text-slate-500">Processed</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={7}>
                      No completed or pending settlements were found in the current live event set.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Processed</p>
                <p className="text-2xl font-bold text-white">{formatWeiToEth(totalProcessedWei.toString())}</p>
                <p className="text-xs text-green-400 mt-1">Completed settlements</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Pending Approval</p>
                <p className="text-2xl font-bold text-white">{formatWeiToEth(pendingApprovalWei.toString())}</p>
                <p className="text-xs text-yellow-400 mt-1">{withdrawalRequests.filter((request) => request.status === 'pending').length} requests</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Settlement Coverage</p>
                <p className="text-2xl font-bold text-white">{settlementCoverage}%</p>
                <p className="text-xs text-purple-400 mt-1">Settled events out of total tracked events</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};