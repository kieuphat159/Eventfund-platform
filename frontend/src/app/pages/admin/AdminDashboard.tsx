import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Calendar,
  Ticket,
  ShoppingCart,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getAdminEvents } from '../../services/events.service';
import {
  getAdminPlatformStats,
  getAdminSystemHealth,
  getAdminUsers,
  type AdminPlatformStats,
  type AdminSystemHealth,
  type AdminUserItem,
} from '../../services/admin.service';
import { formatIntegerValue, formatIntegerWithUnit } from '../../lib/utils';

type ActivityItem = {
  key: string;
  action: string;
  actor: string;
  timestamp: string;
};

function formatActorLabel(user: Pick<AdminUserItem, 'username' | 'walletAddress'>) {
  if (user.username?.trim()) {
    return user.username.trim();
  }

  return `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-6)}`;
}

function formatTimestampLabel(value?: string) {
  if (!value) return 'Unknown time';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'Unknown time';
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;

  return new Date(value).toLocaleDateString();
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminPlatformStats | null>(null);
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUserItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<Array<{
    _id?: string;
    id?: string;
    title?: string;
    createdAt?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        const [statsData, healthData, usersData, eventsData] = await Promise.all([
          getAdminPlatformStats(),
          getAdminSystemHealth(),
          getAdminUsers({ limit: 5, sort: '-createdAt' }),
          getAdminEvents({ limit: 5 }),
        ]);

        setStats(statsData);
        setHealth(healthData);
        setRecentUsers(usersData?.docs || []);
        setRecentEvents(eventsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const userBreakdownData = useMemo(() => {
    if (!stats) return [];

    const regularUsers = Math.max(
      stats.users.total - stats.users.verifiers - stats.users.admins,
      0,
    );

    return [
      { label: 'Users', value: regularUsers },
      { label: 'Verifiers', value: stats.users.verifiers },
      { label: 'Admins', value: stats.users.admins },
    ];
  }, [stats]);

  const eventStatusData = useMemo(() => {
    if (!stats) return [];

    return [
      { label: 'Draft', value: stats.events.draft },
      { label: 'Funding', value: stats.events.funding },
      { label: 'Ongoing', value: stats.events.active },
      { label: 'Completed', value: stats.events.completed },
      { label: 'Cancelled', value: stats.events.cancelled },
    ];
  }, [stats]);

  const assetOverviewData = useMemo(() => {
    if (!stats) return [];

    return [
      { label: 'Tickets', total: stats.tickets.total, active: stats.tickets.sold, completed: stats.tickets.used },
      { label: 'Listings', total: stats.listings.total, active: stats.listings.active, completed: stats.listings.sold },
    ];
  }, [stats]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...recentUsers.map((user) => ({
        key: `user-${user._id}`,
        action: `New ${user.role} account joined`,
        actor: formatActorLabel(user),
        timestamp: user.createdAt || '',
      })),
      ...recentEvents.map((event) => ({
        key: `event-${event._id || event.id || event.title}`,
        action: 'New event created',
        actor: event.title || 'Untitled event',
        timestamp: event.createdAt || '',
      })),
    ];

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [recentEvents, recentUsers]);

  const summaryCards = useMemo(
    () => [
      {
        title: 'Total Users',
        value: stats ? formatIntegerValue(stats.users.total) : '--',
        subtitle: `${stats?.users.verifiers ?? 0} verifiers, ${stats?.users.admins ?? 0} admins`,
        icon: Users,
        color: 'from-blue-500 to-cyan-500',
      },
      {
        title: 'Active Events',
        value: stats ? formatIntegerValue(stats.events.active) : '--',
        subtitle: `${stats?.events.total ?? 0} events on platform`,
        icon: Calendar,
        color: 'from-purple-500 to-pink-500',
      },
      {
        title: 'Tickets Sold',
        value: stats ? formatIntegerValue(stats.tickets.sold) : '--',
        subtitle: `${stats?.tickets.used ?? 0} already checked in`,
        icon: Ticket,
        color: 'from-green-500 to-emerald-500',
      },
      {
        title: 'Marketplace Activity',
        value: stats ? formatIntegerValue(stats.listings.active) : '--',
        subtitle: `${stats?.listings.sold ?? 0} completed sales`,
        icon: ShoppingCart,
        color: 'from-orange-500 to-red-500',
      },
    ],
    [stats],
  );

  if (loading) {
    return <div className="text-white">Loading admin dashboard...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Live platform overview from the admin APIs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((stat) => (
          <Card key={stat.title} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">User Roles</CardTitle>
            <CardDescription className="text-slate-400">Current breakdown of user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Event Statuses</CardTitle>
            <CardDescription className="text-slate-400">What stage platform events are in right now</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Tickets And Listings</CardTitle>
            <CardDescription className="text-slate-400">Inventory, sales, and usage snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={assetOverviewData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="total" fill="#475569" radius={[8, 8, 0, 0]} />
                <Bar dataKey="active" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                <Bar dataKey="completed" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-slate-400">Latest users and events created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.key} className="flex items-start space-x-3 p-3 rounded-lg bg-slate-800/50">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{activity.action}</p>
                      <p className="text-xs text-slate-400 truncate">{activity.actor}</p>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {formatTimestampLabel(activity.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No recent activity available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  System Status: {health?.database.connected ? 'Operational' : 'Attention Required'}
                </h3>
                <p className="text-sm text-slate-300">
                  Database: {health?.database.status || 'unknown'} | API: {health?.services.api || 'unknown'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Platform Revenue</p>
              <p className="text-xl font-bold text-green-400">
                {stats ? formatIntegerWithUnit(stats.revenue.total, 'wei') : '--'}
              </p>
              <p className="text-xs text-slate-500">
                Funding raised: {stats ? formatIntegerWithUnit(stats.revenue.funding, 'wei') : '--'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
