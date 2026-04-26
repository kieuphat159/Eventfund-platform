import React from 'react';
import { AlertTriangle, Shield, Ban, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockFraudMonitoringData } from '../../data/adminMockData';
import {
  getAdminFraudOverview,
  type AdminFraudAlert,
  type AdminBlockedTransaction,
} from '../../services/admin.service';

export const FraudMonitoring: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [alerts, setAlerts] = React.useState<AdminFraudAlert[]>(mockFraudMonitoringData.alerts);
  const [blockedTransactions, setBlockedTransactions] = React.useState<AdminBlockedTransaction[]>(mockFraudMonitoringData.blockedTransactions);
  const [stats, setStats] = React.useState(mockFraudMonitoringData.stats);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await getAdminFraudOverview();
        setStats(
          response?.stats || {
            activeAlerts: 0,
            resolvedToday: 0,
            blockedTransactions: 0,
            detectionRate: 0,
          },
        );
        setAlerts(response?.alerts || []);
        setBlockedTransactions(response?.blockedTransactions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch fraud data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    { label: 'Active Alerts', value: String(stats.activeAlerts), icon: AlertTriangle, color: 'from-red-500 to-orange-500' },
    { label: 'Resolved Today', value: String(stats.resolvedToday), icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
    { label: 'Blocked Transactions', value: String(stats.blockedTransactions), icon: Ban, color: 'from-purple-500 to-pink-500' },
    { label: 'Detection Rate', value: `${stats.detectionRate.toFixed(2)}%`, icon: Shield, color: 'from-blue-500 to-cyan-500' },
  ];

  if (loading) {
    return <div className="text-white">Loading fraud monitoring data...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Fraud Monitoring</h1>
        <p className="text-slate-400">Real-time fraud detection and prevention</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
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
          <CardDescription className="text-slate-400">Suspicious activities requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.map((alert) => (
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
                      {alert.user.slice(0, 10)}...{alert.user.slice(-8)}
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Blocked Transactions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Blocked Transactions</CardTitle>
          <CardDescription className="text-slate-400">Recently prevented fraudulent activities</CardDescription>
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
                {blockedTransactions.map((tx, index) => (
                  <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <code className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">
                        {tx.wallet.slice(0, 10)}...{tx.wallet.slice(-6)}
                      </code>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-400">{tx.reason}</td>
                    <td className="py-4 px-4 text-sm text-white">{tx.amountEth} ETH</td>
                    <td className="py-4 px-4 text-sm text-slate-500 text-right">{tx.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
