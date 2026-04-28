import React from 'react';
import { AlertTriangle, Shield, Ban, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export const FraudMonitoring: React.FC = () => {
  const stats = [
    { label: 'Active Alerts', value: '3', icon: AlertTriangle, color: 'from-red-500 to-orange-500' },
    { label: 'Resolved Today', value: '12', icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
    { label: 'Blocked Transactions', value: '8', icon: Ban, color: 'from-purple-500 to-pink-500' },
    { label: 'Detection Rate', value: '98.5%', icon: Shield, color: 'from-blue-500 to-cyan-500' },
  ];

  const alerts = [
    {
      id: '1',
      type: 'Suspicious Activity',
      severity: 'high',
      user: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5',
      description: 'Multiple ticket purchases from same wallet in short timeframe',
      time: '10 minutes ago',
      status: 'pending',
    },
    {
      id: '2',
      type: 'Price Manipulation',
      severity: 'medium',
      user: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      description: 'Unusual pricing pattern detected on marketplace',
      time: '1 hour ago',
      status: 'investigating',
    },
    {
      id: '3',
      type: 'Fake Event',
      severity: 'high',
      user: '0xDC25EF3F5B8A186998338A2aDA83795FBA2D695E',
      description: 'Event details match known scam patterns',
      time: '3 hours ago',
      status: 'pending',
    },
  ];

  const blockedTransactions = [
    { wallet: '0x1111...2222', reason: 'Blacklisted address', amount: '5.0 ETH', time: '15 min ago' },
    { wallet: '0x3333...4444', reason: 'Suspected bot activity', amount: '12.5 ETH', time: '45 min ago' },
    { wallet: '0x5555...6666', reason: 'Failed verification', amount: '2.3 ETH', time: '2 hours ago' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Fraud Monitoring</h1>
        <p className="text-slate-400">Real-time fraud detection and prevention</p>
      </div>

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
                      <code className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">{tx.wallet}</code>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-400">{tx.reason}</td>
                    <td className="py-4 px-4 text-sm text-white">{tx.amount}</td>
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
