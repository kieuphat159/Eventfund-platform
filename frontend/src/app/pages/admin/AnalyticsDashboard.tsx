import React from 'react';
import { Users, Calendar, Ticket, TrendingUp, Eye, ShoppingCart, Award, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const AnalyticsDashboard: React.FC = () => {
  const platformStats = [
    {
      title: 'Total Users',
      value: '12,847',
      change: '+18.2%',
      trend: 'up',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      subtitle: 'Active users this month',
    },
    {
      title: 'Total Events',
      value: '1,284',
      change: '+12.5%',
      trend: 'up',
      icon: Calendar,
      color: 'from-purple-500 to-pink-500',
      subtitle: '456 active events',
    },
    {
      title: 'Tickets Sold',
      value: '45,892',
      change: '+25.8%',
      trend: 'up',
      icon: Ticket,
      color: 'from-green-500 to-emerald-500',
      subtitle: 'Total ticket sales',
    },
    {
      title: 'Marketplace Volume',
      value: '892 ETH',
      change: '+15.3%',
      trend: 'up',
      icon: ShoppingCart,
      color: 'from-orange-500 to-red-500',
      subtitle: 'Secondary market',
    },
  ];

  const platformActivityData = [
    { month: 'Jan', users: 8250, events: 845, tickets: 28450 },
    { month: 'Feb', users: 9120, events: 920, tickets: 31280 },
    { month: 'Mar', users: 9850, events: 1005, tickets: 35670 },
    { month: 'Apr', users: 10540, events: 1085, tickets: 38920 },
    { month: 'May', users: 11280, events: 1158, tickets: 42150 },
    { month: 'Jun', users: 12847, events: 1284, tickets: 45892 },
  ];

  const userEngagementData = [
    { day: 'Mon', active: 4250, new: 320 },
    { day: 'Tue', active: 4580, new: 380 },
    { day: 'Wed', active: 5120, new: 420 },
    { day: 'Thu', active: 4920, new: 350 },
    { day: 'Fri', active: 5680, new: 520 },
    { day: 'Sat', active: 6250, new: 680 },
    { day: 'Sun', active: 5450, new: 450 },
  ];

  const userTypeDistribution = [
    { name: 'Regular Users', value: 9845, color: '#3b82f6' },
    { name: 'Event Organizers', value: 2280, color: '#8b5cf6' },
    { name: 'Verifiers', value: 625, color: '#10b981' },
    { name: 'Admins', value: 97, color: '#f59e0b' },
  ];

  const topEvents = [
    {
      rank: 1,
      name: 'CryptoMusic Festival 2024',
      organizer: 'CryptoEvents Inc.',
      category: 'Music',
      tickets: 8450,
      revenue: '185.5 ETH',
      attendees: 7820,
      rating: 4.8,
    },
    {
      rank: 2,
      name: 'Web3 Tech Summit',
      organizer: 'Tech Innovators',
      category: 'Technology',
      tickets: 5680,
      revenue: '142.3 ETH',
      attendees: 5420,
      rating: 4.7,
    },
    {
      rank: 3,
      name: 'NFT Art Expo',
      organizer: 'Digital Art Gallery',
      category: 'Art',
      tickets: 4250,
      revenue: '128.7 ETH',
      attendees: 4050,
      rating: 4.9,
    },
    {
      rank: 4,
      name: 'Sports Championship Finals',
      organizer: 'Sports Arena',
      category: 'Sports',
      tickets: 7250,
      revenue: '115.2 ETH',
      attendees: 7100,
      rating: 4.6,
    },
    {
      rank: 5,
      name: 'Blockchain Conference',
      organizer: 'Crypto Foundation',
      category: 'Technology',
      tickets: 3850,
      revenue: '98.5 ETH',
      attendees: 3650,
      rating: 4.5,
    },
  ];

  const categoryPerformance = [
    { category: 'Music', events: 425, tickets: 18450, revenue: 485.5 },
    { category: 'Technology', events: 312, tickets: 12280, revenue: 358.2 },
    { category: 'Sports', events: 268, tickets: 9850, revenue: 245.8 },
    { category: 'Art', events: 185, tickets: 3680, revenue: 185.7 },
    { category: 'Other', events: 94, tickets: 1632, revenue: 95.3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
        <p className="text-slate-400">Platform performance and insights</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {platformStats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400">
                  {stat.change}
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Activity Chart */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Platform Activity Trends</CardTitle>
          <CardDescription className="text-slate-400">Monthly growth metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={platformActivityData}>
              <CartesianGrid key="analytics-platform-grid" strokeDasharray="3 3" stroke="#334155" />
              <XAxis key="analytics-platform-xaxis" dataKey="month" stroke="#94a3b8" />
              <YAxis key="analytics-platform-yaxis" stroke="#94a3b8" />
              <Tooltip
                key="analytics-platform-tooltip"
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Line key="users-line" type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} name="Users" />
              <Line key="events-line" type="monotone" dataKey="events" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} name="Events" />
              <Line key="tickets-line" type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Tickets (/100)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* User Engagement and Distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly User Engagement */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Weekly User Engagement</CardTitle>
            <CardDescription className="text-slate-400">Active vs new users this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={userEngagementData}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop key="activeStop1" offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop key="activeStop2" offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop key="newStop1" offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop key="newStop2" offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="analytics-engagement-grid" strokeDasharray="3 3" stroke="#334155" />
                <XAxis key="analytics-engagement-xaxis" dataKey="day" stroke="#94a3b8" />
                <YAxis key="analytics-engagement-yaxis" stroke="#94a3b8" />
                <Tooltip
                  key="analytics-engagement-tooltip"
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area key="active-area" type="monotone" dataKey="active" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActive)" name="Active Users" />
                <Area key="new-area" type="monotone" dataKey="new" stroke="#10b981" fillOpacity={1} fill="url(#colorNew)" name="New Users" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Type Distribution */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">User Type Distribution</CardTitle>
            <CardDescription className="text-slate-400">Platform user roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={userTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {userTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Performance Ranking */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Top Performing Events</CardTitle>
          <CardDescription className="text-slate-400">Ranked by revenue and engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Event Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Tickets Sold</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Attendees</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.map((event) => (
                  <tr key={event.rank} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        {event.rank === 1 && (
                          <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                            <Award className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {event.rank !== 1 && (
                          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-bold text-slate-400">{event.rank}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-white">{event.name}</p>
                        <p className="text-xs text-slate-400">{event.organizer}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                        {event.category}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-white font-semibold">{event.tickets.toLocaleString()}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-green-400 font-semibold">{event.revenue}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 text-slate-400 mr-1" />
                        <span className="text-sm text-slate-300">{event.attendees.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-semibold text-yellow-400">★</span>
                          <span className="text-sm text-white">{event.rating}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Category Performance */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Performance by Category</CardTitle>
          <CardDescription className="text-slate-400">Event categories comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryPerformance}>
              <CartesianGrid key="analytics-category-grid" strokeDasharray="3 3" stroke="#334155" />
              <XAxis key="analytics-category-xaxis" dataKey="category" stroke="#94a3b8" />
              <YAxis key="analytics-category-yaxis" stroke="#94a3b8" />
              <Tooltip
                key="analytics-category-tooltip"
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Bar key="events-bar" dataKey="events" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Events" />
              <Bar key="tickets-bar" dataKey="tickets" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Tickets (/10)" />
              <Bar key="revenue-bar" dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} name="Revenue (ETH)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Avg. Tickets per Event</p>
                <p className="text-2xl font-bold text-white">35.7</p>
                <p className="text-xs text-blue-400 mt-1">+8.3% from last month</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">User Retention Rate</p>
                <p className="text-2xl font-bold text-white">78.5%</p>
                <p className="text-xs text-purple-400 mt-1">+5.2% improvement</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Event Success Rate</p>
                <p className="text-2xl font-bold text-white">92.3%</p>
                <p className="text-xs text-green-400 mt-1">Events at capacity</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
