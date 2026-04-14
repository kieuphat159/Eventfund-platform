import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QrCode, CheckCircle, XCircle, Clock, Ticket, Calendar, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/api';
import { getTicketByTokenId, getTickets, markTicketAsUsed, type ApiTicket } from '../../services/tickets.service';

interface ApiEventItem {
  _id: string;
  title?: string;
  startDate?: string;
  venue?: {
    address?: string;
  };
  totalTickets?: number;
}

interface ApiEventsResponse {
  success: boolean;
  data?: {
    docs?: ApiEventItem[];
  };
}

interface EventStatsResponse {
  success: boolean;
  data?: {
    totalTickets?: number;
    soldTickets?: number;
    usedTickets?: number;
    mintedTickets?: number;
    availableTickets?: number;
  };
}

interface CheckInRecord {
  id: string;
  ticketId: string;
  attendeeName: string;
  attendeeWallet: string;
  timestamp: string;
  status: 'valid' | 'invalid' | 'duplicate';
}

interface EventStats {
  totalTickets: number;
  soldTickets: number;
  usedTickets: number;
}

const EMPTY_STATS: EventStats = {
  totalTickets: 0,
  soldTickets: 0,
  usedTickets: 0,
};

function shortenWallet(wallet?: string): string {
  if (!wallet) return 'Unknown';
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

function resolveTicketEventId(ticket: ApiTicket | null | undefined): string | null {
  if (!ticket) return null;
  if (ticket.eventIdRaw) return ticket.eventIdRaw;
  if (typeof ticket.eventId === 'string') return ticket.eventId;
  if (typeof ticket.eventId === 'object' && ticket.eventId?._id) return ticket.eventId._id;
  return null;
}

export const VerifierDashboard: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const [manualTicketId, setManualTicketId] = useState('');
  const [events, setEvents] = useState<ApiEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingCheckIns, setIsLoadingCheckIns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState<EventStats>(EMPTY_STATS);
  const [usedCheckIns, setUsedCheckIns] = useState<CheckInRecord[]>([]);
  const [manualRecords, setManualRecords] = useState<CheckInRecord[]>([]);

  const selectedEventData = useMemo(
    () => events.find((e) => e._id === selectedEvent),
    [events, selectedEvent],
  );

  const checkInRecords = useMemo(() => {
    const byKey = new Map<string, CheckInRecord>();
    [...manualRecords, ...usedCheckIns].forEach((record) => {
      if (!byKey.has(record.id)) {
        byKey.set(record.id, record);
      }
    });

    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [manualRecords, usedCheckIns]);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      setPageError(null);

      try {
        const payload = await api.get<ApiEventsResponse>('/events?limit=100&sortBy=startDate&sortOrder=asc');
        const docs = payload.data?.docs || [];
        setEvents(docs);

        if (!selectedEvent && docs.length > 0) {
          setSelectedEvent(docs[0]._id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load events';
        setPageError(message);
        setEvents([]);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [selectedEvent]);

  const loadSelectedEventData = useCallback(async (eventId: string) => {
    if (!eventId) {
      setEventStats(EMPTY_STATS);
      setUsedCheckIns([]);
      return;
    }

    setIsLoadingCheckIns(true);
    setActionError(null);

    try {
      const [statsPayload, usedTicketsPayload] = await Promise.all([
        api.get<EventStatsResponse>(`/tickets/event/${eventId}/stats`),
        getTickets({ eventId, status: 'used', page: 1, limit: 100, sort: '-usedAt' }),
      ]);

      setEventStats({
        totalTickets: statsPayload.data?.totalTickets || 0,
        soldTickets: statsPayload.data?.soldTickets || 0,
        usedTickets: statsPayload.data?.usedTickets || 0,
      });

      setUsedCheckIns(
        usedTicketsPayload.docs.map((ticket) => ({
          id: `used-${ticket.tokenId}-${ticket.usedAt || ticket.createdAt || ''}`,
          ticketId: ticket.tokenId,
          attendeeName: 'Wallet Holder',
          attendeeWallet: shortenWallet(ticket.currentOwner),
          timestamp: ticket.usedAt || ticket.createdAt || new Date().toISOString(),
          status: 'valid',
        })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load event tickets';
      setActionError(message);
      setEventStats(EMPTY_STATS);
      setUsedCheckIns([]);
    } finally {
      setIsLoadingCheckIns(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedEvent) {
      setManualRecords([]);
      setUsedCheckIns([]);
      setEventStats(EMPTY_STATS);
      return;
    }

    setManualRecords([]);
    loadSelectedEventData(selectedEvent);
  }, [selectedEvent, loadSelectedEventData]);

  const createManualRecord = (
    ticketId: string,
    status: CheckInRecord['status'],
    wallet = 'Unknown',
  ): CheckInRecord => ({
    id: `manual-${Date.now()}-${ticketId}`,
    ticketId,
    attendeeName: status === 'valid' ? 'Verified Attendee' : 'Manual Entry',
    attendeeWallet: shortenWallet(wallet),
    timestamp: new Date().toISOString(),
    status,
  });

  const stats = [
    {
      title: 'Total Check-Ins',
      value: eventStats.usedTickets.toString(),
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400',
    },
    {
      title: 'Valid Tickets',
      value: eventStats.usedTickets.toString(),
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
    },
    {
      title: 'Duplicates',
      value: manualRecords.filter((r) => r.status === 'duplicate').length.toString(),
      icon: AlertCircle,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
    },
    {
      title: 'Invalid Tickets',
      value: manualRecords.filter((r) => r.status === 'invalid').length.toString(),
      icon: XCircle,
      color: 'from-red-500 to-pink-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
    },
  ];

  const handleScanTicket = () => {
    setShowScanner(true);
  };

  const checkInByTokenId = useCallback(
    async (tokenId: string) => {
      const normalized = tokenId.trim();

      if (!normalized || !selectedEvent) {
        return;
      }

      setIsSubmitting(true);
      setActionError(null);

      try {
        const ticket = await getTicketByTokenId(normalized);

        if (!ticket) {
          setManualRecords((prev) => [createManualRecord(normalized, 'invalid'), ...prev]);
          return;
        }

        const ticketEventId = resolveTicketEventId(ticket);
        if (!ticketEventId || ticketEventId !== selectedEvent) {
          setManualRecords((prev) => [createManualRecord(normalized, 'invalid', ticket.currentOwner), ...prev]);
          return;
        }

        if (ticket.status === 'used') {
          setManualRecords((prev) => [createManualRecord(normalized, 'duplicate', ticket.currentOwner), ...prev]);
          return;
        }

        await markTicketAsUsed(normalized, selectedEvent);
        await loadSelectedEventData(selectedEvent);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to verify ticket';
        setActionError(message);
        setManualRecords((prev) => [createManualRecord(normalized, 'invalid'), ...prev]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadSelectedEventData, selectedEvent],
  );

  const handleManualCheckIn = async () => {
    if (!manualTicketId.trim()) return;
    await checkInByTokenId(manualTicketId);
    setManualTicketId('');
  };

  const handleQRScan = async (data: string | null) => {
    if (!data) return;
    await checkInByTokenId(data);
    setShowScanner(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Event Check-In</h1>
          <p className="text-slate-400">Scan NFT tickets and manage event entry</p>
        </div>
      </div>

      {pageError && (
        <Card className="bg-slate-900 border-red-800">
          <CardContent className="p-4 text-red-300">{pageError}</CardContent>
        </Card>
      )}

      {actionError && (
        <Card className="bg-slate-900 border-yellow-800">
          <CardContent className="p-4 text-yellow-300">{actionError}</CardContent>
        </Card>
      )}

      {/* Event Selection */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Select Event</CardTitle>
          <CardDescription className="text-slate-400">
            Choose the event you're managing check-in for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="flex-1 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder={isLoadingEvents ? 'Loading events...' : 'Select an event...'} />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {events.map((event) => (
                  <SelectItem key={event._id} value={event._id} className="text-white hover:bg-slate-700">
                    {event.title || `Event ${event._id.slice(0, 8)}`}
                    {event.startDate ? ` - ${new Date(event.startDate).toLocaleDateString()}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEventData && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>
                  {selectedEventData.startDate
                    ? new Date(selectedEventData.startDate).toLocaleDateString()
                    : 'TBA'}
                </span>
                <span className="mx-2">•</span>
                <Ticket className="w-4 h-4" />
                <span>{eventStats.soldTickets} sold</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                      <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* QR Scanner Section */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Ticket Scanner</CardTitle>
                <CardDescription className="text-slate-400">
                  Scan QR codes or enter ticket IDs manually
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleScanTicket}
                  className="w-full h-32 text-lg"
                  disabled={!selectedEvent || isSubmitting}
                >
                  <QrCode className="w-8 h-8 mr-3" />
                  {isSubmitting ? 'Processing...' : 'Scan QR Code'}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500">Or enter manually</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Ticket ID (e.g., TKT-001-NFT)"
                    value={manualTicketId}
                    onChange={(e) => setManualTicketId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualCheckIn()}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Button onClick={handleManualCheckIn} variant="outline" disabled={!selectedEvent || isSubmitting}>
                    Check In
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Card */}
            <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-white">Event Information</CardTitle>
                <CardDescription className="text-slate-400">
                  Current event details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Event Name</span>
                    <span className="text-white font-medium">{selectedEventData?.title || 'Unknown Event'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Date</span>
                    <span className="text-white font-medium">
                      {selectedEventData?.startDate
                        ? new Date(selectedEventData.startDate).toLocaleDateString()
                        : 'TBA'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location</span>
                    <span className="text-white font-medium">
                      {selectedEventData?.venue?.address || 'TBA'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Capacity</span>
                    <span className="text-white font-medium">
                      {selectedEventData?.totalTickets || eventStats.totalTickets || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Check-In Rate</span>
                    <span className="text-green-400 font-medium">
                      {(selectedEventData?.totalTickets || eventStats.totalTickets) > 0
                        ? `${Math.round((eventStats.usedTickets / Number(selectedEventData?.totalTickets || eventStats.totalTickets)) * 100)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Check-Ins */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Recent Check-Ins</CardTitle>
              <CardDescription className="text-slate-400">
                Latest ticket validations for this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoadingCheckIns ? (
                  <div className="text-center py-8 text-slate-400">Loading check-in data...</div>
                ) : checkInRecords.length > 0 ? (
                  checkInRecords.slice(0, 10).map((record) => (
                    <div
                      key={record.id}
                      className={`p-4 rounded-lg border transition-all ${
                        record.status === 'valid'
                          ? 'bg-green-500/5 border-green-500/30'
                          : record.status === 'duplicate'
                          ? 'bg-yellow-500/5 border-yellow-500/30'
                          : 'bg-red-500/5 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              record.status === 'valid'
                                ? 'bg-green-500/20'
                                : record.status === 'duplicate'
                                ? 'bg-yellow-500/20'
                                : 'bg-red-500/20'
                            }`}
                          >
                            {record.status === 'valid' ? (
                              <CheckCircle className="w-5 h-5 text-green-400" />
                            ) : record.status === 'duplicate' ? (
                              <AlertCircle className="w-5 h-5 text-yellow-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-white">{record.attendeeName}</h4>
                            <p className="text-sm text-slate-400">{record.ticketId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              record.status === 'valid'
                                ? 'text-green-400'
                                : record.status === 'duplicate'
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }`}
                          >
                            {record.status === 'valid'
                              ? 'Valid'
                              : record.status === 'duplicate'
                              ? 'Already Used'
                              : 'Invalid'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Wallet: {record.attendeeWallet}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No check-ins yet</p>
                    <p className="text-sm text-slate-500 mt-1">Start scanning tickets to see them here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedEvent && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Select an Event</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Choose an event from the dropdown above to start managing check-ins and scanning tickets
            </p>
          </CardContent>
        </Card>
      )}

      {/* QR Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Scan QR Code</DialogTitle>
            <DialogDescription className="text-slate-400">
              Position the QR code within the camera frame
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-800 rounded-lg p-8 text-center">
            <QrCode className="w-32 h-32 text-purple-400 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">Camera scanning simulation</p>
            <p className="text-sm text-slate-500 mb-4">
              In production, this would activate your device camera
            </p>
            <Button
              onClick={() => handleQRScan('TKT-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-NFT')}
              variant="outline"
              className="w-full"
              disabled={isSubmitting || !selectedEvent}
            >
              Simulate Scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
