import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Activity,
  ShieldCheck,
  Ticket,
} from "lucide-react";
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
import {
  getAdminEvents,
  getAdminPlatformStats,
  getAdminSystemHealth,
  getAdminUsers,
  type AdminPlatformStats,
  type AdminSystemHealth,
  type AdminUserItem,
  type EventItem,
} from "../../services/events.service";

type DashboardActivity = {
  kind: "event" | "user";
  title: string;
  detail: string;
  time: string;
  createdAt: number;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

function parseNumericValue(value?: string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  try {
    return Number(BigInt(value));
  } catch {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

function formatWeiToEth(value?: string | number): string {
  try {
    const wei = BigInt(String(value ?? "0"));
    const base = 10n ** 18n;
    const whole = wei / base;
    const fraction = (wei % base).toString().padStart(18, "0").slice(0, 2).replace(/0+$/, "");
    return fraction ? `${whole.toString()}.${fraction} ETH` : `${whole.toString()} ETH`;
  } catch {
    return "0 ETH";
  }
}

function formatRelativeTime(value?: string): string {
  if (!value) return "recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getMonthKey(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map((part) => Number(part));
  if (!year || !month) return key;
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
}

function aggregateByMonth<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  getAmount: (item: T) => number,
  limit = 6,
) {
  const grouped = new Map<string, { month: string; order: number; value: number }>();

  items.forEach((item) => {
    const dateKey = getMonthKey(getDate(item));
    if (!dateKey) return;

    const [year, month] = dateKey.split("-").map(Number);
    const order = year * 12 + month;
    const current = grouped.get(dateKey) || {
      month: monthLabelFromKey(dateKey),
      order,
      value: 0,
    };

    current.value += getAmount(item);
    grouped.set(dateKey, current);
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.order - b.order)
    .slice(-limit)
    .map(({ month, value }) => ({ month, value }));
}

function buildStatusTimeline(stats?: AdminPlatformStats | null) {
  return [
    {
      label: "Draft",
      value: stats?.events?.draft ?? 0,
      tone: "from-slate-500 to-slate-400",
    },
    {
      label: "Funding",
      value: stats?.events?.funding ?? 0,
      tone: "from-cyan-500 to-sky-400",
    },
    {
      label: "Live",
      value: (stats?.events?.active ?? 0) + (stats?.events?.funding ?? 0),
      tone: "from-emerald-500 to-lime-400",
    },
    {
      label: "Completed",
      value: stats?.events?.completed ?? 0,
      tone: "from-violet-500 to-fuchsia-400",
    },
  ];
}

export const AdminDashboard: React.FC = () => {
  const [platformStats, setPlatformStats] = useState<AdminPlatformStats | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      const [statsResult, eventsResult, usersResult, healthResult] =
        await Promise.allSettled([
          getAdminPlatformStats(),
          getAdminEvents({ limit: 100, sort: "-createdAt" }),
          getAdminUsers({ limit: 100, sort: "-createdAt" }),
          getAdminSystemHealth(),
        ]);

      if (!active) return;

      if (statsResult.status === "fulfilled") {
        setPlatformStats(statsResult.value);
      }

      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value);
      }

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
      }

      if (healthResult.status === "fulfilled") {
        setSystemHealth(healthResult.value);
      }

      const failures = [statsResult, eventsResult, usersResult, healthResult]
        .filter((result) => result.status === "rejected")
        .map((result) =>
          result.status === "rejected"
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : "",
        )
        .filter(Boolean);

      if (failures.length > 0) {
        setError(failures[0]);
      }

      setLoading(false);
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const revenueData = useMemo(() => {
    return aggregateByMonth(
      events,
      (event) => event.createdAt,
      (event) => parseNumericValue(event.currentFunding ?? event.fundingGoal) / 1e18,
    );
  }, [events]);

  const userGrowthData = useMemo(() => {
    return aggregateByMonth(users, (user) => user.createdAt, () => 1);
  }, [users]);

  const eventCategoryData = useMemo(() => {
    const counts = new Map<string, number>();

    events.forEach((event) => {
      const category = event.category || "Uncategorized";
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [events]);

  const recentActivity = useMemo(() => {
    const eventActivity: DashboardActivity[] = events
      .filter((event) => event.createdAt)
      .map((event) => ({
        kind: "event",
        title: event.title || "Untitled event",
        detail: [event.status || "draft", event.category || "uncategorized"]
          .filter(Boolean)
          .join(" • "),
        time: formatRelativeTime(event.createdAt),
        createdAt: new Date(event.createdAt as string).getTime(),
      }));

    const userActivity: DashboardActivity[] = users
      .filter((user) => user.createdAt)
      .map((user) => ({
        kind: "user",
        title: user.username || user.email || user.walletAddress,
        detail: user.role || "user",
        time: formatRelativeTime(user.createdAt),
        createdAt: new Date(user.createdAt as string).getTime(),
      }));

    return [...eventActivity, ...userActivity]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 6);
  }, [events, users]);

  const statusTimeline = useMemo(() => buildStatusTimeline(platformStats), [platformStats]);

  const totalUsers = platformStats?.users?.total ?? users.length;
  const totalEvents = platformStats?.events?.total ?? events.length;
  const liveEvents = (platformStats?.events?.funding ?? 0) + (platformStats?.events?.active ?? 0);
  const soldTickets = platformStats?.tickets?.sold ?? 0;
  const platformRevenue = formatWeiToEth(platformStats?.revenue?.total);
  const fundingRevenue = formatWeiToEth(platformStats?.revenue?.funding);
  const activeOrganizers = platformStats?.users?.organizers ?? 0;
  const activeVerifiers = platformStats?.users?.verifiers ?? 0;
  const databaseOnline = systemHealth?.database?.connected === true;
  const apiStatus = systemHealth?.services?.api || "unknown";
  const healthTimestamp = systemHealth?.timestamp
    ? formatRelativeTime(systemHealth.timestamp)
    : "recently";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">
            Live admin overview
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Real-time platform statistics, event activity, and health signals pulled from the backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${databaseOnline ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Database {databaseOnline ? "connected" : systemHealth?.database?.status || "unknown"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-slate-300">
            <Activity className="h-3.5 w-3.5 text-cyan-300" />
            API {apiStatus}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-slate-400">
            Updated {healthTimestamp}
          </span>
        </div>
      </div>

      {!!error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some live metrics could not be loaded: {error}
        </div>
      )}

      {loading && !platformStats && events.length === 0 && users.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-6 text-sm text-slate-400">
            Loading live dashboard metrics...
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Users",
            value: totalUsers.toLocaleString(),
            meta: `${activeOrganizers.toLocaleString()} organizers · ${activeVerifiers.toLocaleString()} verifiers`,
            icon: Users,
            color: "from-blue-500 to-cyan-500",
          },
          {
            title: "Total Events",
            value: totalEvents.toLocaleString(),
            meta: `${platformStats?.events?.draft ?? 0} drafts · ${platformStats?.events?.completed ?? 0} completed`,
            icon: Calendar,
            color: "from-purple-500 to-pink-500",
          },
          {
            title: "Live Events",
            value: liveEvents.toLocaleString(),
            meta: `${platformStats?.events?.funding ?? 0} funding · ${platformStats?.events?.active ?? 0} ongoing`,
            icon: TrendingUp,
            color: "from-emerald-500 to-lime-500",
          },
          {
            title: "Platform Revenue",
            value: platformRevenue,
            meta: `Funding volume ${fundingRevenue}`,
            icon: DollarSign,
            color: "from-green-500 to-emerald-500",
          },
        ].map((stat) => (
          <Card key={stat.title} className="border-slate-800 bg-slate-900/95 shadow-lg shadow-slate-950/40">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Live
                </span>
              </div>
              <p className="text-sm text-slate-400">{stat.title}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{stat.meta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Funding Volume by Month</CardTitle>
            <CardDescription className="text-slate-400">
              Aggregated from recent live events stored in the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="adminColorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#22c55e" fillOpacity={1} fill="url(#adminColorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">New User Sign-ups</CardTitle>
            <CardDescription className="text-slate-400">
              Based on the most recent user records returned by the API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2.5} dot={{ fill: "#38bdf8" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Events by Category</CardTitle>
            <CardDescription className="text-slate-400">
              Derived from live event records, not sample data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="category" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" fill="#a855f7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-slate-400">
              Latest events and user registrations returned by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => {
                  const isEvent = activity.kind === "event";
                  const Icon = isEvent ? Calendar : Users;

                  return (
                    <div
                      key={`${activity.kind}-${activity.createdAt}-${activity.title}`}
                      className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                    >
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${isEvent ? "bg-cyan-500/10 text-cyan-300" : "bg-purple-500/10 text-purple-300"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {activity.title}
                          </p>
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            {activity.kind}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{activity.detail}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-slate-500">
                        {activity.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                No recent activity found yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-900/20 via-cyan-900/15 to-slate-900">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <Activity className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  System Health: {databaseOnline ? "Operational" : "Needs attention"}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  Database status: {systemHealth?.database?.status || "unknown"}. API status: {apiStatus}.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {statusTimeline.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <span className={`rounded-full bg-gradient-to-r ${item.tone} px-2 py-0.5 text-xs font-semibold text-slate-950`}>
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1">
              <Ticket className="h-3.5 w-3.5 text-cyan-300" />
              Tickets sold: {soldTickets.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
              Completed events: {platformStats?.events?.completed ?? 0}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              System snapshot pulled from live admin APIs
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};