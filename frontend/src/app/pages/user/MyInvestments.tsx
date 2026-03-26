import React from 'react';
import { TrendingUp, DollarSign, PieChart, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockInvestments } from '../../data/mockData';

export const MyInvestments: React.FC = () => {
  const totalInvested = mockInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalReturns = mockInvestments.reduce((sum, inv) => sum + inv.returns, 0);
  const roi = ((totalReturns / totalInvested) * 100).toFixed(1);

  const stats = [
    { label: 'Total Invested', value: `${totalInvested.toFixed(2)} ETH`, icon: DollarSign, color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Returns', value: `${totalReturns.toFixed(2)} ETH`, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
    { label: 'ROI', value: `${roi}%`, icon: PieChart, color: 'from-purple-500 to-pink-500' },
    { label: 'Active Investments', value: mockInvestments.filter(i => i.status === 'active').length.toString(), icon: Calendar, color: 'from-orange-500 to-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Investments</h1>
        <p className="text-slate-400">Track your event investments and returns</p>
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

      {/* Investment List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Investment Portfolio</CardTitle>
          <CardDescription className="text-slate-400">Your active and completed investments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockInvestments.map((investment) => {
              const profitLoss = investment.returns - investment.amount;
              const profitPercent = ((profitLoss / investment.amount) * 100).toFixed(1);
              const isProfit = profitLoss > 0;

              return (
                <div
                  key={investment.id}
                  className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-white mb-1">{investment.eventName}</h4>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`text-xs px-2 py-1 rounded capitalize ${
                            investment.status === 'active'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-slate-500/10 text-slate-400'
                          }`}
                        >
                          {investment.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          Invested: {new Date(investment.investedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-slate-400'}`}>
                        {isProfit ? '+' : ''}{profitPercent}%
                      </div>
                      <div className="text-xs text-slate-500">ROI</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-xs text-slate-500 mb-1">Amount Invested</p>
                      <p className="text-sm font-semibold text-white">{investment.amount} ETH</p>
                    </div>
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-xs text-slate-500 mb-1">Current Returns</p>
                      <p className="text-sm font-semibold text-purple-400">{investment.returns} ETH</p>
                    </div>
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-xs text-slate-500 mb-1">Profit/Loss</p>
                      <p className={`text-sm font-semibold ${isProfit ? 'text-green-400' : 'text-slate-400'}`}>
                        {isProfit ? '+' : ''}{profitLoss.toFixed(2)} ETH
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Share: {investment.sharePercentage}% of event revenue
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 text-white">
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-white mb-2">Discover Investment Opportunities</h3>
              <p className="text-slate-300">Browse events and invest in their success</p>
            </div>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
              Browse Events
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
