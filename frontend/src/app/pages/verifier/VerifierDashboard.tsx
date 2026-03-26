import React, { useState } from 'react';
import { QrCode, CheckCircle, XCircle, Clock, Ticket, Calendar, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockEvents } from '../../data/mockData';
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

interface CheckInRecord {
  id: string;
  ticketId: string;
  attendeeName: string;
  attendeeWallet: string;
  timestamp: string;
  status: 'valid' | 'invalid' | 'duplicate';
}

export const VerifierDashboard: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const [manualTicketId, setManualTicketId] = useState('');
  const [checkInRecords, setCheckInRecords] = useState<CheckInRecord[]>([
    {
      id: '1',
      ticketId: 'TKT-001-NFT',
      attendeeName: 'Alice Johnson',
      attendeeWallet: '0x742d...bEb5',
      timestamp: '2026-03-12T10:30:00',
      status: 'valid',
    },
    {
      id: '2',
      ticketId: 'TKT-002-NFT',
      attendeeName: 'Bob Smith',
      attendeeWallet: '0x8ba1...DBA72',
      timestamp: '2026-03-12T10:35:00',
      status: 'valid',
    },
    {
      id: '3',
      ticketId: 'TKT-003-NFT',
      attendeeName: 'Charlie Brown',
      attendeeWallet: '0xDC25...695E',
      timestamp: '2026-03-12T10:40:00',
      status: 'duplicate',
    },
  ]);

  const events = mockEvents.filter(e => e.status === 'approved');
  const selectedEventData = events.find(e => e.id === selectedEvent);

  // Stats for the selected event
  const totalCheckIns = checkInRecords.length;
  const validCheckIns = checkInRecords.filter(r => r.status === 'valid').length;
  const invalidCheckIns = checkInRecords.filter(r => r.status === 'invalid').length;
  const duplicateCheckIns = checkInRecords.filter(r => r.status === 'duplicate').length;

  const stats = [
    {
      title: 'Total Check-Ins',
      value: totalCheckIns.toString(),
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400',
    },
    {
      title: 'Valid Tickets',
      value: validCheckIns.toString(),
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
    },
    {
      title: 'Duplicates',
      value: duplicateCheckIns.toString(),
      icon: AlertCircle,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
    },
    {
      title: 'Invalid Tickets',
      value: invalidCheckIns.toString(),
      icon: XCircle,
      color: 'from-red-500 to-pink-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
    },
  ];

  const handleScanTicket = () => {
    setShowScanner(true);
  };

  const handleManualCheckIn = () => {
    if (!manualTicketId.trim()) return;

    // Simulate ticket validation
    const isDuplicate = checkInRecords.some(r => r.ticketId === manualTicketId);
    const isValid = manualTicketId.startsWith('TKT-');

    const newRecord: CheckInRecord = {
      id: `${checkInRecords.length + 1}`,
      ticketId: manualTicketId,
      attendeeName: 'Manual Entry',
      attendeeWallet: '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6),
      timestamp: new Date().toISOString(),
      status: isDuplicate ? 'duplicate' : isValid ? 'valid' : 'invalid',
    };

    setCheckInRecords([newRecord, ...checkInRecords]);
    setManualTicketId('');
  };

  const handleQRScan = (data: string | null) => {
    if (!data) return;

    // Simulate ticket validation from QR code
    const isDuplicate = checkInRecords.some(r => r.ticketId === data);
    const isValid = data.startsWith('TKT-');

    const newRecord: CheckInRecord = {
      id: `${checkInRecords.length + 1}`,
      ticketId: data,
      attendeeName: 'QR Scanned',
      attendeeWallet: '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6),
      timestamp: new Date().toISOString(),
      status: isDuplicate ? 'duplicate' : isValid ? 'valid' : 'invalid',
    };

    setCheckInRecords([newRecord, ...checkInRecords]);
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
                <SelectValue placeholder="Select an event..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id} className="text-white hover:bg-slate-700">
                    {event.title} - {new Date(event.date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEventData && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>{new Date(selectedEventData.date).toLocaleDateString()}</span>
                <span className="mx-2">•</span>
                <Ticket className="w-4 h-4" />
                <span>{selectedEventData.price} ETH</span>
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
                >
                  <QrCode className="w-8 h-8 mr-3" />
                  Scan QR Code
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
                  <Button onClick={handleManualCheckIn} variant="outline">
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
                    <span className="text-white font-medium">{selectedEventData?.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Date</span>
                    <span className="text-white font-medium">
                      {selectedEventData && new Date(selectedEventData.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location</span>
                    <span className="text-white font-medium">{selectedEventData?.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Capacity</span>
                    <span className="text-white font-medium">{selectedEventData?.ticketsAvailable || 'Unlimited'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Check-In Rate</span>
                    <span className="text-green-400 font-medium">
                      {selectedEventData?.ticketsAvailable
                        ? `${Math.round((validCheckIns / Number(selectedEventData.ticketsAvailable)) * 100)}%`
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
                {checkInRecords.length > 0 ? (
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
            >
              Simulate Scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};