import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Ticket, TrendingUp, Wallet, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockInvestments } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTickets, type ApiTicket } from '../../services/tickets.service';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type UpcomingEvent = {
  id: string;
  title: string;
  location: string;
  startDate?: string;
};

type TicketActivity = {
  key: string;
  type: 'Purchase' | 'Check-in';
  event: string;
  amount: string;
  date: string;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<ApiTicket[]>([]);

  const walletAddress = user?.walletAddress?.trim();

  useEffect(() => {
    const fetchTickets = async () => {
      if (!walletAddress || !ETH_ADDRESS_REGEX.test(walletAddress)) {
        setTickets([]);
        return;
      }

      try {
        const data = await getUserTickets(walletAddress);
        setTickets(data);
      } catch {
        setTickets([]);
      }
    };

    fetchTickets();
  }, [walletAddress]);

  const upcomingEvents = useMemo<UpcomingEvent[]>(() => {
    const now = Date.now();
    const map = new Map<string, UpcomingEvent>();

    tickets.forEach((ticket) => {
      const event = typeof ticket.eventId === 'object' ? ticket.eventId : undefined;
      if (!event?.startDate || !event?.title) {
        return;
      }

      const startTs = new Date(event.startDate).getTime();
      if (!Number.isFinite(startTs) || startTs <= now) {
        return;
      }

      const key = event._id || ticket.eventIdRaw || event.title;
      if (map.has(key)) {
        return;
      }

      map.set(key, {
        id: key,
        title: event.title,
        location: event.venue?.address || 'TBA',
        startDate: event.startDate,
      });
    });

    return Array.from(map.values())
      .sort((a, b) => {
        const ta = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })
      .slice(0, 3);
  }, [tickets]);

  const recentActivities = useMemo<TicketActivity[]>(() => {
    const activities = tickets
      .flatMap((ticket) => {
        const event = typeof ticket.eventId === 'object' ? ticket.eventId : undefined;
        const eventTitle = event?.title || `Event ${ticket.eventIdRaw || '-'}`;
        const price = Number(ticket.originalPrice || 0);
        const formattedPrice = Number.isFinite(price)
          ? `${price.toFixed(3).replace(/\.?0+$/, '')} ETH`
          : '0 ETH';

        const records: TicketActivity[] = [];

        if (ticket.soldAt) {
          records.push({
            key: `${ticket.tokenId}-sold`,
            type: 'Purchase',
            event: eventTitle,
            amount: formattedPrice,
            date: ticket.soldAt,
          });
        }

        if (ticket.usedAt) {
          records.push({
            key: `${ticket.tokenId}-used`,
            type: 'Check-in',
            event: eventTitle,
            amount: formattedPrice,
            date: ticket.usedAt,
          });
        }

        return records;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    return activities;
  }, [tickets]);

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
      value: tickets.length.toString(),
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
                      {event.startDate
                        ? new Date(event.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'TBA'}
                    </p>
                  </div>
                </div>
              ))}
              {upcomingEvents.length === 0 && (
                <p className="text-sm text-slate-500">No upcoming events from your current tickets.</p>
              )}
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
              {recentActivities.map((tx) => (
                <div
                  key={tx.key}
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
              {recentActivities.length === 0 && (
                <p className="text-sm text-slate-500">No ticket activity yet.</p>
              )}
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
