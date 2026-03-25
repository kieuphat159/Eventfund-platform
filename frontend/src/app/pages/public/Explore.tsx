import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Grid, List } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { StatusBadge } from '../../components/StatusBadge';
import { getEvents, type EventItem } from '../../services/events.service';

type DateFilter = 'all' | 'today' | 'week' | 'month';

export const Explore: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getEvents();
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const publicEvents = useMemo(() => {
    return events.filter((event) =>
      ['funded', 'ticketing', 'ongoing', 'completed'].includes(event.status || '')
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const endOfMonth = new Date(now);
    endOfMonth.setMonth(now.getMonth() + 1);
    endOfMonth.setHours(23, 59, 59, 999);

    return publicEvents.filter((event) => {
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !q ||
        (event.title || '').toLowerCase().includes(q) ||
        (event.description || '').toLowerCase().includes(q) ||
        (event.category || '').toLowerCase().includes(q) ||
        (event.venue?.address || '').toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all'
          ? true
          : (event.category || '').toLowerCase() === categoryFilter.toLowerCase();

      const eventDate = event.startDate ? new Date(event.startDate) : null;

      const matchesDate =
        dateFilter === 'all'
          ? true
          : !eventDate
            ? false
            : dateFilter === 'today'
              ? eventDate >= now && eventDate <= endOfToday
              : dateFilter === 'week'
                ? eventDate >= now && eventDate <= endOfWeek
                : eventDate >= now && eventDate <= endOfMonth;

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [publicEvents, searchQuery, categoryFilter, dateFilter]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 py-8 text-white">Loading events...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-slate-950 py-8 text-red-400">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Explore Events</h1>
          <p className="text-slate-400">Discover amazing experiences on the blockchain</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="music">Music</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="art">Art</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className={
                  viewMode === 'grid'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'border-slate-700 hover:bg-slate-800'
                }
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className={
                  viewMode === 'list'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'border-slate-700 hover:bg-slate-800'
                }
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
            No events found.
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const eventId = event._id || event.id || '';
              const coverImage = event.imageUrls?.[0] || '';
              const firstTierPrice = event.ticketTiers?.[0]?.price;
              const eventDate = event.startDate ? new Date(event.startDate) : null;

              return (
                <Link
                  key={eventId}
                  to={`/events/${eventId}`}
                  className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
                >
                  <div className="aspect-video overflow-hidden">
                    <ImageWithFallback
                      src={coverImage}
                      alt={event.title || 'Event'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
                        {event.title || 'Untitled event'}
                      </h3>
                      <StatusBadge status={(event.status as any) || 'draft'} />
                    </div>

                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {event.description || 'No description'}
                    </p>

                    <div className="flex items-center justify-between text-sm gap-3">
                      <span className="text-slate-500 truncate">
                        {event.venue?.address || 'Unknown location'}
                      </span>
                      <span className="text-purple-400 font-medium whitespace-nowrap">
                        From {firstTierPrice ?? 0} ETH
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
                      {eventDate
                        ? eventDate.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'No date'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const eventId = event._id || event.id || '';
              const coverImage = event.imageUrls?.[0] || '';
              const firstTierPrice = event.ticketTiers?.[0]?.price;
              const eventDate = event.startDate ? new Date(event.startDate) : null;

              return (
                <Link
                  key={eventId}
                  to={`/events/${eventId}`}
                  className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all flex"
                >
                  <div className="w-48 flex-shrink-0 overflow-hidden">
                    <ImageWithFallback
                      src={coverImage}
                      alt={event.title || 'Event'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <h3 className="text-xl font-semibold text-white group-hover:text-purple-400 transition-colors">
                          {event.title || 'Untitled event'}
                        </h3>
                        <StatusBadge status={(event.status as any) || 'draft'} />
                      </div>

                      <p className="text-sm text-slate-400 mb-3">
                        {event.description || 'No description'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm text-slate-500">
                        <p>{event.venue?.address || 'Unknown location'}</p>
                        <p className="mt-1">
                          {eventDate
                            ? eventDate.toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'No date'}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-slate-400 mb-1">Starting from</p>
                        <p className="text-xl font-semibold text-purple-400">
                          {firstTierPrice ?? 0} ETH
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};