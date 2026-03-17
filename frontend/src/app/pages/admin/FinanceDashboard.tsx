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

export const FinanceDashboard: React.FC = () => {
  const revenueStats = [
    {
      title: 'Total Platform Revenue',
      value: '1,247.8 ETH',
      usd: '$3,892,450',
      change: '+18.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Ticket Sales Revenue',
      value: '982.3 ETH',
      usd: '$3,067,890',
      change: '+22.3%',
      trend: 'up',
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Marketplace Fees',
      value: '215.5 ETH',
      usd: '$673,210',
      change: '+12.8%',
      trend: 'up',
      icon: CreditCard,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Pending Withdrawals',
      value: '50.0 ETH',
      usd: '$156,350',
      change: '-5.2%',
      trend: 'down',
      icon: Wallet,
      color: 'from-orange-500 to-red-500',
    },
  ];

  const revenueData = [
    { month: 'Jan', ticket: 125, marketplace: 28, total: 153 },
    { month: 'Feb', ticket: 142, marketplace: 32, total: 174 },
    { month: 'Mar', ticket: 165, marketplace: 38, total: 203 },
    { month: 'Apr', ticket: 189, marketplace: 42, total: 231 },
    { month: 'May', ticket: 218, marketplace: 48, total: 266 },
    { month: 'Jun', ticket: 235, marketplace: 55, total: 290 },
  ];

  const categoryRevenueData = [
    { category: 'Music Events', revenue: 425.5 },
    { category: 'Tech Conferences', revenue: 312.8 },
    { category: 'Sports', revenue: 268.3 },
    { category: 'Art & Culture', revenue: 145.7 },
    { category: 'Other', revenue: 95.5 },
  ];

  const withdrawalRequests = [
    {
      id: 'WR-001',
      organizer: 'CryptoMusic Festival',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595bEb5',
      amount: '15.5 ETH',
      usd: '$48,425',
      date: '2024-03-05',
      status: 'pending',
    },
    {
      id: 'WR-002',
      organizer: 'Tech Summit 2024',
      wallet: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      amount: '22.3 ETH',
      usd: '$69,638',
      date: '2024-03-04',
      status: 'pending',
    },
    {
      id: 'WR-003',
      organizer: 'NFT Art Gallery',
      wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      amount: '8.7 ETH',
      usd: '$27,178',
      date: '2024-03-04',
      status: 'approved',
    },
    {
      id: 'WR-004',
      organizer: 'Sports Arena Events',
      wallet: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      amount: '18.2 ETH',
      usd: '$56,854',
      date: '2024-03-03',
      status: 'approved',
    },
    {
      id: 'WR-005',
      organizer: 'Comedy Night Live',
      wallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      amount: '5.5 ETH',
      usd: '$17,183',
      date: '2024-03-02',
      status: 'completed',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Finance Dashboard</h1>
        <p className="text-slate-400">Platform revenue and financial overview</p>
      </div>

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
            <CardDescription className="text-slate-400">Ticket sales vs marketplace fees (ETH)</CardDescription>
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalRequests.map((request) => (
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
                        <p className="text-sm font-semibold text-white">{request.amount}</p>
                        <p className="text-xs text-slate-500">{request.usd}</p>
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
                ))}
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
                <p className="text-2xl font-bold text-white">1,197.8 ETH</p>
                <p className="text-xs text-green-400 mt-1">+15.3% this month</p>
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
                <p className="text-2xl font-bold text-white">37.8 ETH</p>
                <p className="text-xs text-yellow-400 mt-1">8 requests</p>
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
                <p className="text-2xl font-bold text-white">2.5%</p>
                <p className="text-xs text-purple-400 mt-1">On all transactions</p>
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