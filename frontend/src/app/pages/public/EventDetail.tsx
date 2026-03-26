import React from 'react';
import { useParams } from 'react-router';
import { Calendar, MapPin, Users, Clock, Ticket, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { mockEvents } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connectWallet } = useAuth();
  
  // Find event by ID (in real app, fetch from API)
  const event = mockEvents.find(e => e.id === id) || mockEvents[0];

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Event Header */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="aspect-video rounded-xl overflow-hidden">
            <ImageWithFallback
              src={event.image}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">{event.title}</h1>
            <p className="text-lg text-slate-400 mb-6">{event.description}</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-3 text-slate-300">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>{new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-300">
                <Clock className="w-5 h-5 text-purple-400" />
                <span>{new Date(event.date).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-300">
                <MapPin className="w-5 h-5 text-purple-400" />
                <span>{event.location}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-300">
                <Users className="w-5 h-5 text-purple-400" />
                <span>{event.ticketTiers.reduce((sum, tier) => sum + tier.totalSupply, 0)} tickets available</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-400 mb-1">Organized by</p>
              <code className="text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded">
                {event.organizerWallet.slice(0, 20)}...{event.organizerWallet.slice(-10)}
              </code>
            </div>
          </div>
        </div>

        {/* Ticket Tiers */}
        <Card className="bg-slate-900 border-slate-800 mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Ticket Tiers</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {event.ticketTiers.map((tier, index) => (
                <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-purple-500/50 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                    <Ticket className="w-5 h-5 text-purple-400" />
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-3xl font-bold text-white">{tier.price} ETH</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {tier.totalSupply} available
                    </p>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm text-slate-400">
                    {tier.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-purple-400 mr-2">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={connectWallet}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    Purchase Ticket
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Investment Opportunity */}
        <Card className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">Investment Opportunity</h3>
                <p className="text-slate-300 mb-4">
                  Invest in this event and earn returns based on ticket sales and event success
                </p>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Investment Target</p>
                    <p className="text-lg font-semibold text-white">10.0 ETH</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Revenue Share</p>
                    <p className="text-lg font-semibold text-white">20%</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Raised So Far</p>
                    <p className="text-lg font-semibold text-green-400">6.5 ETH</p>
                  </div>
                </div>
                <Button
                  onClick={connectWallet}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Invest in Event
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
