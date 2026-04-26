import React from 'react';
import { DollarSign, TrendingUp, CreditCard, Wallet, CheckCircle, Clock, XCircle } from 'lucide-react';
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
  getAdminFinanceOverview,
  type AdminFinanceOverview,
} from '../../services/admin.service';

export const FinanceDashboard: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState<AdminFinanceOverview | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await getAdminFinanceOverview();
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load finance overview');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const revenueStats = [
    {
      title: 'Total Platform Revenue',
      value: `${data?.stats.totalPlatformRevenueEth ?? 0} ETH`,
      subtitle: data?.stats.totalPlatformRevenueWei ?? '0',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Ticket Sales Revenue',
      value: `${data?.stats.ticketSalesRevenueEth ?? 0} ETH`,
      subtitle: data?.stats.ticketSalesRevenueWei ?? '0',
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Marketplace Fees',
      value: `${data?.stats.marketplaceFeesEth ?? 0} ETH`,
      subtitle: data?.stats.marketplaceFeesWei ?? '0',
      icon: CreditCard,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Pending Withdrawals',
      value: `${data?.stats.pendingWithdrawalsEth ?? 0} ETH`,
      subtitle: data?.stats.pendingWithdrawalsWei ?? '0',
      icon: Wallet,
      color: 'from-orange-500 to-red-500',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="text-white">Loading finance dashboard...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Finance Dashboard</h1>
        <p className="text-slate-400">Platform revenue and financial overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {revenueStats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Monthly Revenue Breakdown</CardTitle>
            <CardDescription className="text-slate-400">Ticket sales vs marketplace fees (ETH)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data?.monthlyRevenue || []}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="ticket" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTicket)" />
                <Area type="monotone" dataKey="marketplace" stackId="1" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMarketplace)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Revenue by Event Category</CardTitle>
            <CardDescription className="text-slate-400">Total revenue by category (ETH)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data?.categoryRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="category" stroke="#94a3b8" angle={-15} textAnchor="end" height={80} />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Withdrawal Requests</CardTitle>
              <CardDescription className="text-slate-400">Event organizer payout requests</CardDescription>
            </div>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              Process All Approved
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
                </tr>
              </thead>
              <tbody>
                {(data?.withdrawalRequests || []).map((request) => (
                  <tr key={request.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-white">{request.id}</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-white">{request.organizer}</td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-400 font-mono">{request.wallet.slice(0, 10)}...{request.wallet.slice(-6)}</span>
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold text-white">{request.amountEth} ETH</td>
                    <td className="py-4 px-4 text-sm text-slate-400">{request.date ? new Date(request.date).toLocaleDateString() : 'N/A'}</td>
                    <td className="py-4 px-4">{getStatusBadge(request.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Processed</p>
                <p className="text-2xl font-bold text-white">{data?.summary.totalProcessedWei || '0'} wei</p>
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
                <p className="text-2xl font-bold text-white">{data?.summary.pendingApprovalWei || '0'} wei</p>
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
                <p className="text-sm text-slate-400 mb-1">Platform Fee Rate</p>
                <p className="text-2xl font-bold text-white">{data?.summary.platformFeeRatePercent ?? 0}%</p>
                <p className="text-xs text-purple-400 mt-1">On marketplace trades</p>
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
