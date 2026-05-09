import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Shield, Ban, CheckCircle, Search, Activity, BadgeAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  getAdminEvents,
  getAdminPlatformStats,
  getAdminSystemHealth,
  type AdminPlatformStats,
  type AdminSystemHealth,
  type EventItem,
} from '../../services/events.service';

type FraudAlert = {
  id: string;
  type: string;
  severity: 'high' | 'medium';
  user: string;
  description: string;
  time: string;
  status: string;
  amountWei: string;
  createdAt: number;
};

function parseNumericValue(value?: string | number): bigint {
  if (typeof value === 'number') return BigInt(Math.max(0, Math.floor(value)));
  if (!value) return 0n;
  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
}

function formatWeiToEth(value?: string | number): string {
  try {
    const wei = parseNumericValue(value);
    const base = 10n ** 18n;
    const whole = wei / base;
    const fraction = (wei % base).toString().padStart(18, '0').slice(0, 2).replace(/0+$/, '');
    return fraction ? `${whole.toString()}.${fraction} ETH` : `${whole.toString()} ETH`;
  } catch {
    return '0 ETH';
  }
}

function formatRelativeTime(value?: string): string {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  const diffMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function shortenWallet(wallet?: string): string {
  if (!wallet) return 'Unknown wallet';
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 10)}...${wallet.slice(-8)}`;
}

export const FraudMonitoring: React.FC = () => {
  const [platformStats, setPlatformStats] = useState<AdminPlatformStats | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');

      const [statsResult, eventsResult, healthResult] = await Promise.allSettled([
        getAdminPlatformStats(),
        getAdminEvents({ limit: 200, sort: '-updatedAt' }),
        getAdminSystemHealth(),
      ]);

      if (!alive) return;

      if (statsResult.status === 'fulfilled') setPlatformStats(statsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
      if (healthResult.status === 'fulfilled') setSystemHealth(healthResult.value);

      const failure = [statsResult, eventsResult, healthResult].find(
        (result) => result.status === 'rejected',
      );

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

  const fraudAlerts = useMemo<FraudAlert[]>(() => {
    const baseAlerts = events
      .filter((event) => {
        const penalty = parseNumericValue(event.totalPenaltyAmount);
        return penalty > 0n || event.status === 'cancelled' || event.status === 'failed';
      })
      .map((event) => {
        const penalty = parseNumericValue(event.totalPenaltyAmount);
        const severity: 'high' | 'medium' =
          event.status === 'failed' || penalty > 0n ? 'high' : 'medium';
        const type = penalty > 0n
          ? 'Penalty Applied'
          : event.status === 'failed'
            ? 'Failed Event'
            : 'Cancelled Event';
        const description = penalty > 0n
          ? `Penalty of ${formatWeiToEth(event.totalPenaltyAmount)} recorded for ${event.title || 'unnamed event'}`
          : event.status === 'failed'
            ? `Event ${event.title || 'unnamed event'} reached failed state during on-chain processing`
            : `Event ${event.title || 'unnamed event'} was cancelled before completion`;
        const createdAt = new Date(event.lastPenaltyAt || event.updatedAt || event.createdAt || Date.now()).getTime();

        return {
          id: event._id || event.id || `${event.title || 'event'}-${createdAt}`,
          type,
          severity,
          user: event.organizer || event.organizerWallet || 'Unknown organizer',
          description,
          time: formatRelativeTime(event.lastPenaltyAt || event.updatedAt || event.createdAt),
          status: event.status || 'unknown',
          amountWei: String(event.totalPenaltyAmount || event.organizerStakeWithdrawn || '0'),
          createdAt,
        };
      });

    return baseAlerts
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 5);
  }, [events]);

  const blockedTransactions = useMemo(() => {
    return fraudAlerts.slice(0, 5).map((alert) => ({
      wallet: alert.user,
      reason: `${alert.type} · ${alert.status}`,
      amount: formatWeiToEth(alert.amountWei),
      time: alert.time,
    }));
  }, [fraudAlerts]);

  const activeAlerts = fraudAlerts.length;
  const resolvedToday = fraudAlerts.filter((alert) => {
    const age = Date.now() - alert.createdAt;
    return age >= 0 && age <= 24 * 60 * 60 * 1000 && alert.status !== 'failed';
  }).length;
  const detectionRate = activeAlerts > 0 ? Math.max(0, Math.min(100, Math.round((resolvedToday / activeAlerts) * 100))) : 100;

  const stats = [
    { label: 'Active Alerts', value: activeAlerts.toLocaleString(), icon: AlertTriangle, color: 'from-red-500 to-orange-500' },
    { label: 'Resolved Today', value: resolvedToday.toLocaleString(), icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
    { label: 'Blocked Transactions', value: blockedTransactions.length.toLocaleString(), icon: Ban, color: 'from-purple-500 to-pink-500' },
    { label: 'Detection Rate', value: `${detectionRate}%`, icon: Shield, color: 'from-blue-500 to-cyan-500' },
  ];

  const healthLabel = systemHealth?.database?.connected === true ? 'Connected' : systemHealth?.database?.status || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-red-300/80">Live risk signals</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Fraud Monitoring</h1>
          <p className="mt-2 text-slate-400">Real-time risk events derived from live event and penalty data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
            <Activity className="h-3.5 w-3.5 text-cyan-300" />
            Database {healthLabel}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-slate-400">
            {events.length} live events scanned
          </span>
        </div>
      </div>

      {!!error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some fraud data could not be loaded: {error}
        </div>
      )}

      {loading && events.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-6 text-sm text-slate-400">Loading live risk events...</CardContent>
        </Card>
      ) : null}

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
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Alerts */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Active Fraud Alerts</CardTitle>
          <CardDescription className="text-slate-400">Cancelled, failed, or penalized events requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fraudAlerts.length > 0 ? fraudAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'high'
                    ? 'bg-red-500/5 border-red-500/30'
                    : 'bg-yellow-500/5 border-yellow-500/30'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle
                      className={`w-5 h-5 ${
                        alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                      }`}
                    />
                    <div>
                      <h4 className="font-semibold text-white">{alert.type}</h4>
                      <p className="text-sm text-slate-400 mt-1">{alert.description}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      alert.severity === 'high'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-500">User: </span>
                    <code className="text-slate-300 bg-slate-800 px-2 py-1 rounded">
                      {shortenWallet(alert.user)}
                    </code>
                    <span className="text-slate-500 ml-4">{alert.time}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
                      Investigate
                    </Button>
                    <Button variant="outline" size="sm" className="border-red-600 hover:bg-red-900/20 text-red-400">
                      Block
                    </Button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                No fraud alerts detected from the current event set.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocked Transactions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Blocked Transactions</CardTitle>
          <CardDescription className="text-slate-400">Penalty-related event records derived from live backend data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Wallet</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Reason</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {blockedTransactions.length > 0 ? blockedTransactions.map((tx, index) => (
                  <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <code className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">{tx.wallet}</code>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-400">{tx.reason}</td>
                    <td className="py-4 px-4 text-sm text-white">{tx.amount}</td>
                    <td className="py-4 px-4 text-sm text-slate-500 text-right">{tx.time}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={4}>
                      No blocked transactions were derived from live penalty data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
