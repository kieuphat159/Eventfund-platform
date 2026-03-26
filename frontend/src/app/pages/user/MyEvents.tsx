import React from 'react';
import { Link } from 'react-router';
import { Calendar, MapPin, Users, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/StatusBadge';
import { mockEvents } from '../../data/mockData';

export const MyEvents: React.FC = () => {
  // Filter for user's created events (in real app, filter by user wallet)
  const myEvents = mockEvents.slice(0, 3);

  const stats = [
    { label: 'Total Events', value: myEvents.length.toString() },
    { label: 'Approved', value: myEvents.filter(e => e.status === 'approved').length.toString() },
    { label: 'Total Tickets Sold', value: '127' },
    { label: 'Revenue', value: '45.8 ETH' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Events</h1>
          <p className="text-slate-400">Events you've created and organized</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white" asChild>
          <Link to="/events/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {myEvents.length > 0 ? (
          myEvents.map((event) => (
            <Card key={event.id} className="bg-slate-900 border-slate-800 hover:border-purple-500/50 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                      <StatusBadge status={event.status} />
                    </div>
                    <p className="text-slate-400">{event.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="icon" className="border-slate-700 hover:bg-slate-800">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="border-red-600 hover:bg-red-900/20 text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(event.date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>{event.ticketTiers.reduce((sum, tier) => sum + tier.totalSupply, 0)} tickets available</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                  {event.ticketTiers.map((tier, index) => (
                    <div key={index} className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-sm text-slate-400 mb-1">{tier.name}</p>
                      <p className="text-lg font-semibold text-white">{tier.price} ETH</p>
                      <p className="text-xs text-slate-500 mt-1">{tier.totalSupply} available</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Created: {new Date(event.createdAt).toLocaleDateString()}
                  </div>
                  <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
                    View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No events yet</h3>
              <p className="text-slate-400 mb-6">Create your first event to get started</p>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white" asChild>
                <Link to="/events/create">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Event
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
