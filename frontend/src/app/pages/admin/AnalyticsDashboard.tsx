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
import {
  getAdminAnalyticsOverview,
  type AdminAnalyticsOverview,
} from '../../services/admin.service';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

export const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState<AdminAnalyticsOverview | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await getAdminAnalyticsOverview();
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics overview');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const platformStats = [
    {
      title: 'Total Users',
      value: String(data?.stats.totalUsers ?? 0),
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      subtitle: 'Registered users',
    },
    {
      title: 'Total Events',
      value: String(data?.stats.totalEvents ?? 0),
      icon: Calendar,
      color: 'from-purple-500 to-pink-500',
      subtitle: 'Published events',
    },
    {
      title: 'Tickets Sold',
      value: String(data?.stats.ticketsSold ?? 0),
      icon: Ticket,
      color: 'from-green-500 to-emerald-500',
      subtitle: 'Primary + secondary sales',
    },
    {
      title: 'Marketplace Volume',
      value: `${data?.stats.marketplaceVolumeEth ?? 0} ETH`,
      icon: ShoppingCart,
      color: 'from-orange-500 to-red-500',
      subtitle: 'Sold listing volume',
    },
  ];

  if (loading) {
    return <div className="text-white">Loading analytics dashboard...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
        <p className="text-slate-400">Platform performance and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {platformStats.map((stat, index) => (
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

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Platform Activity Trends</CardTitle>
          <CardDescription className="text-slate-400">Monthly growth metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data?.platformActivity || []}>
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
              <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} name="Users" />
              <Line type="monotone" dataKey="events" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} name="Events" />
              <Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Tickets" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Weekly User Engagement</CardTitle>
            <CardDescription className="text-slate-400">Active vs new users</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.userEngagement || []}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="active" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActive)" name="Active" />
                <Area type="monotone" dataKey="new" stroke="#10b981" fillOpacity={1} fill="url(#colorNew)" name="New" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">User Type Distribution</CardTitle>
            <CardDescription className="text-slate-400">Account role composition</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.userTypeDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {(data?.userTypeDistribution || []).map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
          </CardContent>
        </Card>
      </div>

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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Tickets</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Attendees</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Rating</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topEvents || []).map((event) => (
                  <tr key={event.rank} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      {event.rank === 1 ? (
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-slate-400">{event.rank}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-medium text-white">{event.name}</p>
                      <p className="text-xs text-slate-400">{event.organizer.slice(0, 10)}...{event.organizer.slice(-6)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">{event.category}</Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-white font-semibold">{event.tickets.toLocaleString()}</td>
                    <td className="py-4 px-4 text-sm text-green-400 font-semibold">{event.revenueEth} ETH</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 text-slate-400 mr-1" />
                        <span className="text-sm text-slate-300">{event.attendees.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-white">{event.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Performance by Category</CardTitle>
          <CardDescription className="text-slate-400">Category comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.categoryPerformance || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="category" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="events" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Events" />
              <Bar dataKey="tickets" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Tickets" />
              <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} name="Revenue (ETH)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Avg. Tickets per Event</p>
                <p className="text-2xl font-bold text-white">{data?.insights.avgTicketsPerEvent ?? 0}</p>
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
                <p className="text-2xl font-bold text-white">{data?.insights.retentionRate ?? 0}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
