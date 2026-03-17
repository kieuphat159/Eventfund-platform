import React, { useState } from 'react';
import { Search, Calendar, MapPin, User, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/StatusBadge';
import { mockEvents } from '../../data/mockData';

export const EventManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const stats = [
    { label: 'Total Events', value: mockEvents.length.toString(), color: 'from-blue-500 to-cyan-500' },
    { label: 'Approved', value: mockEvents.filter(e => e.status === 'approved').length.toString(), color: 'from-green-500 to-emerald-500' },
    { label: 'Pending', value: mockEvents.filter(e => e.status === 'pending').length.toString(), color: 'from-yellow-500 to-orange-500' },
    { label: 'Rejected', value: mockEvents.filter(e => e.status === 'rejected').length.toString(), color: 'from-red-500 to-pink-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Event Management</h1>
        <p className="text-slate-400">Monitor and manage all platform events</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="music">Music</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="art">Art</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">All Events</CardTitle>
          <CardDescription className="text-slate-400">Complete list of platform events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockEvents.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                      <StatusBadge status={event.status} />
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{event.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <User className="w-4 h-4" />
                    <span className="truncate">{event.organizerWallet.slice(0, 10)}...</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <DollarSign className="w-4 h-4" />
                    <span>From {event.ticketTiers[0].price} ETH</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Created: {new Date(event.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
