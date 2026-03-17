import React from 'react';
import { Users, Calendar, DollarSign, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

export const AdminDashboard: React.FC = () => {
  const stats = [
    {
      title: 'Total Users',
      value: '2,543',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Active Events',
      value: '128',
      change: '+8.2%',
      trend: 'up',
      icon: Calendar,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Platform Revenue',
      value: '458.5 ETH',
      change: '+15.3%',
      trend: 'up',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Fraud Alerts',
      value: '3',
      change: '-25%',
      trend: 'down',
      icon: AlertTriangle,
      color: 'from-red-500 to-orange-500',
    },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 65.5 },
    { month: 'Feb', revenue: 78.2 },
    { month: 'Mar', revenue: 92.8 },
    { month: 'Apr', revenue: 108.3 },
    { month: 'May', revenue: 125.7 },
    { month: 'Jun', revenue: 142.1 },
  ];

  const userGrowthData = [
    { month: 'Jan', users: 1823 },
    { month: 'Feb', users: 1956 },
    { month: 'Mar', users: 2108 },
    { month: 'Apr', users: 2267 },
    { month: 'May', users: 2398 },
    { month: 'Jun', users: 2543 },
  ];

  const eventCategoryData = [
    { category: 'Music', count: 45 },
    { category: 'Tech', count: 32 },
    { category: 'Sports', count: 28 },
    { category: 'Art', count: 15 },
    { category: 'Other', count: 8 },
  ];

  const recentActivity = [
    { action: 'New event created', user: 'CryptoEvents Inc.', time: '2 minutes ago' },
    { action: 'User suspended', user: '0x742d...bEb5', time: '15 minutes ago' },
    { action: 'Fraud alert resolved', user: 'System', time: '1 hour ago' },
    { action: 'Platform fee updated', user: 'Admin', time: '3 hours ago' },
    { action: 'New marketplace listing', user: '0x8ba1...DBA72', time: '5 hours ago' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Platform overview and system metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
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
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Platform Revenue</CardTitle>
            <CardDescription className="text-slate-400">Monthly revenue in ETH</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="adminColorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop key="stop1" offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop key="stop2" offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="revenue-grid" strokeDasharray="3 3" stroke="#334155" />
                <XAxis key="revenue-xaxis" dataKey="month" stroke="#94a3b8" />
                <YAxis key="revenue-yaxis" stroke="#94a3b8" />
                <Tooltip
                  key="revenue-tooltip"
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area key="revenue-area" type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#adminColorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Growth Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">User Growth</CardTitle>
            <CardDescription className="text-slate-400">Total registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid key="growth-grid" strokeDasharray="3 3" stroke="#334155" />
                <XAxis key="growth-xaxis" dataKey="month" stroke="#94a3b8" />
                <YAxis key="growth-yaxis" stroke="#94a3b8" />
                <Tooltip
                  key="growth-tooltip"
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line key="users-line" type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Event Categories */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Events by Category</CardTitle>
            <CardDescription className="text-slate-400">Distribution of active events</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventCategoryData}>
                <CartesianGrid key="category-grid" strokeDasharray="3 3" stroke="#334155" />
                <XAxis key="category-xaxis" dataKey="category" stroke="#94a3b8" />
                <YAxis key="category-yaxis" stroke="#94a3b8" />
                <Tooltip
                  key="category-tooltip"
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar key="count-bar" dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-slate-400">Latest platform actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-slate-800/50">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{activity.action}</p>
                    <p className="text-xs text-slate-400 truncate">{activity.user}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">System Status: Operational</h3>
                <p className="text-sm text-slate-300">All systems running smoothly. Uptime: 99.9%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-400">99.9%</p>
              <p className="text-xs text-slate-400">Uptime</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};