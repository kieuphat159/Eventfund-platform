import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Grid, List, Plus, CalendarDays, Tag } from 'lucide-react';
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
import { useAuth } from '../../contexts/AuthContext';

export const Explore: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
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
      ['funding', 'funded', 'ticketing', 'ongoing', 'completed'].includes(event.status || '')
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
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

      const matchesStartDate = !startDateFilter
        ? true
        : !eventDate
          ? false
          : eventDate >= new Date(`${startDateFilter}T00:00:00`);

      const matchesEndDate = !endDateFilter
        ? true
        : !eventDate
          ? false
          : eventDate <= new Date(`${endDateFilter}T23:59:59`);

      return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate;
    });
  }, [publicEvents, searchQuery, categoryFilter, startDateFilter, endDateFilter]);

  const handleCreateEvent = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role === 'admin') {
      return;
    }

    navigate('/app/events/create');
  };

  const formatCategory = (category?: string) => {
    if (!category) return 'Uncategorized';

    switch (category.toLowerCase()) {
      case 'tech':
        return 'Technology';
      case 'art':
        return 'Art & Culture';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 py-8 text-white">Loading events...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-slate-950 py-8 text-red-400">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Explore Events</h1>
            <p className="text-slate-400">Discover amazing experiences on the blockchain</p>
          </div>

          {user?.role !== 'admin' && (
            <Button
              type="button"
              onClick={handleCreateEvent}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4 mr-2 text-white" />
              Create Event
            </Button>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-6 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-300" />
              <Input
                type="search"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-cyan-300 font-medium">
                <SelectValue placeholder="Category" />
              </SelectTrigger>

              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem
                  value="all"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  All Categories
                </SelectItem>
                <SelectItem
                  value="music"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  Music
                </SelectItem>
                <SelectItem
                  value="tech"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  Technology
                </SelectItem>
                <SelectItem
                  value="sports"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  Sports
                </SelectItem>
                <SelectItem
                  value="art"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  Art &amp; Culture
                </SelectItem>
                <SelectItem
                  value="business"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  Business
                </SelectItem>
                <SelectItem
                  value="conference"
                  className="text-slate-200 focus:bg-purple-500/20 focus:text-purple-300 data-[state=checked]:bg-purple-500/20 data-[state=checked]:text-purple-300 data-[state=checked]:font-semibold"
                >
                  Conference
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-300" />
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-300" />
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className={
                  viewMode === 'grid'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'border-slate-700 hover:bg-slate-800 text-white'
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
                    : 'border-slate-700 hover:bg-slate-800 text-white'
                }
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {(startDateFilter || endDateFilter) && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-400">Active date range:</span>

              {startDateFilter && (
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300">
                  From {startDateFilter}
                </span>
              )}

              {endDateFilter && (
                <span className="px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-400/20 text-fuchsia-300">
                  To {endDateFilter}
                </span>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="h-auto px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Clear dates
              </Button>
            </div>
          )}
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

                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-medium">
                        <Tag className="w-3 h-3" />
                        {formatCategory(event.category)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {event.description || 'No description'}
                    </p>

                    <div className="flex items-center justify-between text-sm gap-3">
                      <span className="text-slate-500 truncate">
                        {event.venue?.address || 'Unknown location'}
                      </span>
                      <span className="text-purple-400 font-medium whitespace-nowrap">
                        From {firstTierPrice ?? 0} wei
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

                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-medium">
                          <Tag className="w-3 h-3" />
                          {formatCategory(event.category)}
                        </span>
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
                          {firstTierPrice ?? 0} wei
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
