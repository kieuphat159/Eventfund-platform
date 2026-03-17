import React from 'react';
import { Ticket, QrCode, Download, Share2, Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockNFTTickets } from '../../data/mockData';

export const MyTickets: React.FC = () => {
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
            <p className="text-3xl font-bold text-white">{mockNFTTickets.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Upcoming Events</p>
            <p className="text-3xl font-bold text-white">2</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Total Value</p>
            <p className="text-3xl font-bold text-white">8.5 ETH</p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {mockNFTTickets.map((ticket) => (
          <Card key={ticket.id} className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="relative">
              <div className="absolute top-4 right-4 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">
                #{ticket.tokenId}
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 h-32 flex items-center justify-center">
                <Ticket className="w-16 h-16 text-white opacity-50" />
              </div>
            </div>
            
            <CardHeader>
              <CardTitle className="text-white">{ticket.eventName}</CardTitle>
              <CardDescription className="text-slate-400">{ticket.tier}</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{new Date(ticket.eventDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-400">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{ticket.venue}</span>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Purchase Price</span>
                  <span className="text-sm font-semibold text-white">{ticket.purchasePrice} ETH</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Current Value</span>
                  <span className="text-sm font-semibold text-purple-400">{ticket.purchasePrice} ETH</span>
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
        ))}
      </div>

      {/* Empty State */}
      {mockNFTTickets.length === 0 && (
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
