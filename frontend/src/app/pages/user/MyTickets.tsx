import React, { useEffect, useMemo, useState } from 'react';
import { Ticket, QrCode, Download, Share2, Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTickets, type ApiTicket } from '../../services/tickets.service';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const MyTickets: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = user?.walletAddress?.trim();

  useEffect(() => {
    const fetchTickets = async () => {
      if (!walletAddress) {
        setTickets([]);
        setError(null);
        return;
      }

      if (!ETH_ADDRESS_REGEX.test(walletAddress)) {
        setTickets([]);
        setError('Wallet address is invalid. Please reconnect wallet.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getUserTickets(walletAddress);
        setTickets(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load tickets';
        setTickets([]);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [walletAddress]);

  const upcomingEventsCount = useMemo(() => {
    const now = Date.now();
    return tickets.filter((ticket) => {
      const event = typeof ticket.eventId === 'object' ? ticket.eventId : undefined;
      if (!event?.startDate) {
        return false;
      }
      return new Date(event.startDate).getTime() > now;
    }).length;
  }, [tickets]);

  const totalValue = useMemo(() => {
    return tickets.reduce((sum, ticket) => sum + Number(ticket.originalPrice || 0), 0);
  }, [tickets]);

  const formatEth = (amount: number) => {
    return Number.isFinite(amount) ? amount.toFixed(3).replace(/\.?0+$/, '') : '0';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My NFT Tickets</h1>
        <p className="text-slate-400">Your digital tickets stored as NFTs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Total Tickets</p>
            <p className="text-3xl font-bold text-white">{tickets.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Upcoming Events</p>
            <p className="text-3xl font-bold text-white">{upcomingEventsCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Total Value</p>
            <p className="text-3xl font-bold text-white">{formatEth(totalValue)} ETH</p>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-slate-300">Loading tickets...</CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-slate-900 border-red-800">
          <CardContent className="p-6 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Tickets Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {tickets.map((ticket) => {
          const event = typeof ticket.eventId === 'object' ? ticket.eventId : undefined;
          const eventName = event?.title || 'Unknown Event';
          const eventDate = event?.startDate;
          const venue = event?.venue?.address || 'Unknown venue';
          const purchasePrice = Number(ticket.originalPrice || 0);

          return (
          <Card key={ticket._id || ticket.tokenId} className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="relative">
              <div className="absolute top-4 right-4 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">
                #{ticket.tokenId}
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 h-32 flex items-center justify-center">
                <Ticket className="w-16 h-16 text-white opacity-50" />
              </div>
            </div>
            
            <CardHeader>
              <CardTitle className="text-white">{eventName}</CardTitle>
              <CardDescription className="text-slate-400">{ticket.ticketType || 'standard'}</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    {eventDate
                      ? new Date(eventDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'TBD'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-slate-400">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{venue}</span>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Purchase Price</span>
                  <span className="text-sm font-semibold text-white">{formatEth(purchasePrice)} ETH</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Current Value</span>
                  <span className="text-sm font-semibold text-purple-400">{formatEth(purchasePrice)} ETH</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800">
                  <QrCode className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              <Button className="w-full mt-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                List on Marketplace
              </Button>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {!isLoading && tickets.length === 0 && !error && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <Ticket className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No tickets yet</h3>
            <p className="text-slate-400 mb-6">Purchase your first NFT ticket to get started</p>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
              Browse Events
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
