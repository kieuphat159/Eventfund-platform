import React, { useEffect, useMemo, useState } from 'react';
import { Users, Calendar, Ticket, TrendingUp, ShoppingCart, Award, Activity, BarChart3 } from 'lucide-react';
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
  getAdminEvents,
  getAdminPlatformStats,
  getAdminUsers,
  type AdminPlatformStats,
  type AdminUserItem,
  type EventItem,
} from '../../services/events.service';

type TopEventRow = {
  rank: number;
  name: string;
  organizer: string;
  category: string;
  tickets: number;
  revenueEth: string;
  fillRate: number;
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

function formatMonthKey(dateValue?: string): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
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
  const grouped = new Map<string, { month: string; order: number; value: number }>();

  items.forEach((item) => {
    const key = formatMonthKey(getDate(item));
    if (!key) return;

    const [year, month] = key.split('-').map(Number);
    const order = year * 12 + month;
    const current = grouped.get(key) || { month: monthLabelFromKey(key), order, value: 0 };
    current.value += getValue(item);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((left, right) => left.order - right.order);
}

function countByRole(users: AdminUserItem[]) {
  const roleCounts = new Map<string, number>();
  users.forEach((user) => {
    const role = user.role || 'user';
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
  });

  return [
    { name: 'Regular Users', value: roleCounts.get('user') || 0, color: '#3b82f6' },
    { name: 'Event Organizers', value: roleCounts.get('organizer') || 0, color: '#8b5cf6' },
    { name: 'Verifiers', value: roleCounts.get('verifier') || 0, color: '#10b981' },
    { name: 'Admins', value: roleCounts.get('admin') || 0, color: '#f59e0b' },
  ].filter((item) => item.value > 0);
}

export const AnalyticsDashboard: React.FC = () => {
  const [platformStats, setPlatformStats] = useState<AdminPlatformStats | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');

      const [statsResult, eventsResult, usersResult] = await Promise.allSettled([
        getAdminPlatformStats(),
        getAdminEvents({ limit: 200, sort: '-createdAt' }),
        getAdminUsers({ limit: 200, sort: '-createdAt' }),
      ]);

      if (!alive) return;

      if (statsResult.status === 'fulfilled') setPlatformStats(statsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
      if (usersResult.status === 'fulfilled') setUsers(usersResult.value);

      const firstFailure = [statsResult, eventsResult, usersResult].find((result) => result.status === 'rejected');
      if (firstFailure?.status === 'rejected') {
        setError(firstFailure.reason instanceof Error ? firstFailure.reason.message : String(firstFailure.reason));
      }

      setLoading(false);
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const platformStatsCards = useMemo(() => {
    const totalUsers = platformStats?.users?.total ?? users.length;
    const totalEvents = platformStats?.events?.total ?? events.length;
    const totalTicketsSold = platformStats?.tickets?.sold ?? events.reduce((sum, event) => sum + (event.ticketsSold || 0), 0);
    const platformRevenue = formatWeiToEth(platformStats?.revenue?.total);

    return [
      {
        title: 'Total Users',
        value: totalUsers.toLocaleString(),
        change: '+live',
        trend: 'up',
        icon: Users,
        color: 'from-blue-500 to-cyan-500',
        subtitle: 'Current registered users',
      },
      {
        title: 'Total Events',
        value: totalEvents.toLocaleString(),
        change: '+live',
        trend: 'up',
        icon: Calendar,
        color: 'from-purple-500 to-pink-500',
        subtitle: `${platformStats?.events?.active ?? 0} active events`,
      },
      {
        title: 'Tickets Sold',
        value: totalTicketsSold.toLocaleString(),
        change: '+live',
        trend: 'up',
        icon: Ticket,
        color: 'from-green-500 to-emerald-500',
        subtitle: 'Aggregated from live event records',
      },
      {
        title: 'Platform Revenue',
        value: platformRevenue,
        change: '+live',
        trend: 'up',
        icon: ShoppingCart,
        color: 'from-orange-500 to-red-500',
        subtitle: 'Total on-chain revenue tracked by backend',
      },
    ];
  }, [events, platformStats, users]);

  const platformActivityData = useMemo(() => {
    const monthKeys = new Set<string>();

    const userByMonth = aggregateByMonth(users, (user) => user.createdAt, () => 1);
    const eventByMonth = aggregateByMonth(events, (event) => event.createdAt, () => 1);
    const ticketsByMonth = aggregateByMonth(events, (event) => event.createdAt, (event) => event.ticketsSold || 0);

    userByMonth.forEach((item) => monthKeys.add(item.month));
    eventByMonth.forEach((item) => monthKeys.add(item.month));
    ticketsByMonth.forEach((item) => monthKeys.add(item.month));

    return Array.from(monthKeys)
      .sort()
      .map((month) => ({
      month,
      users: userByMonth.find((item) => item.month === month)?.value || 0,
      events: eventByMonth.find((item) => item.month === month)?.value || 0,
      tickets: ticketsByMonth.find((item) => item.month === month)?.value || 0,
      }));
  }, [events, users]);

  const userEngagementData = useMemo(() => {
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dayKey = date.toISOString().slice(0, 10);
      return { dayKey, day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date), newUsers: 0, newEvents: 0 };
    });

    users.forEach((user) => {
      const dayKey = user.createdAt?.slice(0, 10);
      const target = lastSevenDays.find((item) => item.dayKey === dayKey);
      if (target) target.newUsers += 1;
    });

    events.forEach((event) => {
      const dayKey = event.createdAt?.slice(0, 10);
      const target = lastSevenDays.find((item) => item.dayKey === dayKey);
      if (target) target.newEvents += 1;
    });

    return lastSevenDays;
  }, [events, users]);

  const userTypeDistribution = useMemo(() => countByRole(users), [users]);

  const topEvents = useMemo<TopEventRow[]>(() => {
    return [...events]
      .sort((left, right) => parseNumericValue(right.currentFunding ?? right.totalRevenue) - parseNumericValue(left.currentFunding ?? left.totalRevenue))
      .slice(0, 5)
      .map((event, index) => {
        const totalTickets = event.totalTickets || event.ticketTiers?.reduce((sum, tier) => sum + (tier.totalSupply || 0), 0) || 0;
        const ticketsSold = event.ticketsSold || 0;
        const fillRate = totalTickets > 0 ? Math.round((ticketsSold / totalTickets) * 100) : 0;

        return {
          rank: index + 1,
          name: event.title || 'Untitled event',
          organizer: event.organizer || event.organizerWallet || 'Unknown organizer',
          category: event.category || 'Uncategorized',
          tickets: ticketsSold,
          revenueEth: formatWeiToEth(event.totalRevenue ?? event.currentFunding),
          fillRate,
        };
      });
  }, [events]);

  const categoryPerformance = useMemo(() => {
    const grouped = new Map<string, { category: string; events: number; tickets: number; revenue: number }>();

    events.forEach((event) => {
      const category = event.category || 'Other';
      const current = grouped.get(category) || { category, events: 0, tickets: 0, revenue: 0 };
      current.events += 1;
      current.tickets += event.ticketsSold || 0;
      current.revenue += parseNumericValue(event.totalRevenue ?? event.currentFunding) / 1e18;
      grouped.set(category, current);
    });

    return Array.from(grouped.values())
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5);
  }, [events]);

  const insightCards = useMemo(() => {
    const avgTicketsPerEvent = events.length > 0 ? (events.reduce((sum, event) => sum + (event.ticketsSold || 0), 0) / events.length).toFixed(1) : '0.0';
    const completedRate = events.length > 0 ? `${Math.round(((events.filter((event) => event.status === 'completed').length) / events.length) * 100)}%` : '0%';
    const activeRoles = userTypeDistribution.reduce((sum, role) => sum + role.value, 0);

    return [
      {
        title: 'Avg. Tickets per Event',
        value: avgTicketsPerEvent,
        note: `${events.filter((event) => (event.ticketsSold || 0) > 0).length} selling events`,
        icon: TrendingUp,
        color: 'from-blue-500 to-cyan-500',
      },
      {
        title: 'Event Completion Rate',
        value: completedRate,
        note: `${events.filter((event) => event.status === 'completed').length} completed events`,
        icon: Activity,
        color: 'from-purple-500 to-pink-500',
      },
      {
        title: 'Tracked User Roles',
        value: activeRoles.toLocaleString(),
        note: `${userTypeDistribution.length} role buckets`,
        icon: Award,
        color: 'from-green-500 to-emerald-500',
      },
    ];
  }, [events, userTypeDistribution]);

  const loadingState = loading && events.length === 0 && users.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Live analytics</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Analytics Dashboard</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Platform performance and insights derived from live users, events, and revenue data.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
          <BarChart3 className="h-3.5 w-3.5 text-cyan-300" />
          {events.length} events · {users.length} users
        </div>
      </div>

      {!!error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some analytics data could not be loaded: {error}
        </div>
      )}

      {loadingState ? (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-6 text-sm text-slate-400">Loading live analytics data...</CardContent>
        </Card>
      ) : null}

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {platformStatsCards.map((stat, index) => (
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
          <CardDescription className="text-slate-400">Monthly growth metrics from live user and event records</CardDescription>
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
        {/* Weekly Activity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Weekly Activity</CardTitle>
            <CardDescription className="text-slate-400">New users vs new events this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={userEngagementData}>
                <defs>
                  <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop key="activeStop1" offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop key="activeStop2" offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNewEvents" x1="0" y1="0" x2="0" y2="1">
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
                <Area key="new-users-area" type="monotone" dataKey="newUsers" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNewUsers)" name="New Users" />
                <Area key="new-events-area" type="monotone" dataKey="newEvents" stroke="#10b981" fillOpacity={1} fill="url(#colorNewEvents)" name="New Events" />
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
          <CardDescription className="text-slate-400">Ranked by live revenue and ticket fill rate</CardDescription>
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Fill Rate</th>
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
                      <span className="text-sm text-green-400 font-semibold">{event.revenueEth}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${event.fillRate}%` }} />
                        </div>
                        <span className="text-sm text-slate-300">{event.fillRate}%</span>
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
          <CardDescription className="text-slate-400">Event categories comparison from live records</CardDescription>
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
        {insightCards.map((card) => (
          <Card key={card.title} className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{card.title}</p>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{card.note}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
