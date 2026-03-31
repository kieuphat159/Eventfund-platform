import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Ticket, TrendingUp, Wallet, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockEvents, mockNFTTickets, mockInvestments } from '../../data/mockData';
import { StatusBadge } from '../../components/StatusBadge';

export const Dashboard: React.FC = () => {
  const stats = [
    {
      title: 'My Events',
      value: '3',
      icon: Calendar,
      color: 'from-purple-500 to-blue-500',
      link: '/app/events/my-events',
    },
    {
      title: 'My Tickets',
      value: mockNFTTickets.length.toString(),
      icon: Ticket,
      color: 'from-blue-500 to-cyan-500',
      link: '/app/tickets/my-tickets',
    },
    {
      title: 'Active Investments',
      value: mockInvestments.filter(i => i.status === 'active').length.toString(),
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-500',
      link: '/app/investments',
    },
    {
      title: 'Total Returns',
      value: `${mockInvestments.reduce((sum, inv) => sum + inv.returns, 0).toFixed(2)} ETH`,
      icon: Wallet,
      color: 'from-orange-500 to-red-500',
      link: '/app/wallet',
    },
  ];

  const upcomingEvents = mockEvents.filter(e => e.status === 'approved').slice(0, 3);
  const recentTransactions = [
    { type: 'Purchase', event: 'Crypto Music Festival 2026', amount: '2.0 ETH', date: '2026-03-01' },
    { type: 'Investment', event: 'Web3 Summit 2026', amount: '3.0 ETH', date: '2026-02-28' },
    { type: 'Sale', event: 'NFT Art Gallery Opening', amount: '0.6 ETH', date: '2026-02-25' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back! Here's an overview of your activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Link key={index} to={stat.link}>
            <Card className="bg-slate-900 border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Upcoming Events</CardTitle>
            <CardDescription className="text-slate-400">Events you're attending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center space-x-4 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{event.title}</h4>
                    <p className="text-sm text-slate-400">{event.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/app/tickets/my-tickets" className="block mt-4">
              <Button variant="ghost" className="w-full text-purple-400 hover:text-purple-300 hover:bg-slate-800">
                View All Tickets
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Transactions</CardTitle>
            <CardDescription className="text-slate-400">Your latest activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((tx, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{tx.type}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{tx.event}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{tx.amount}</p>
                    <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/wallet" className="block mt-4">
              <Button variant="ghost" className="w-full text-purple-400 hover:text-purple-300 hover:bg-slate-800">
                View Transaction History
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-white mb-2">Become an Event Organizer</h3>
              <p className="text-slate-300">Create and manage your own events with NFT tickets</p>
            </div>
            <Link to="/app/events/create">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                Create Event
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};