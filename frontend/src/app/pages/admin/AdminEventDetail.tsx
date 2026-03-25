import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, MapPin, User, DollarSign, ArrowLeft, Tag, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/StatusBadge';
import { getEventById, type EventItem } from '../../services/events.service';

export const EventDetail: React.FC = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setError('Invalid event id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const data = await getEventById(id);

        if (!data) {
          setError('Event not found');
          return;
        }

        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  if (loading) {
    return <div className="text-white">Loading event details...</div>;
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <div className="text-red-400">{error || 'Event not found'}</div>
        <Link to="/admin/events">
          <Button variant="outline" className="border-slate-600 hover:bg-slate-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/events"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">{event.title || 'Untitled event'}</h1>
          <p className="text-slate-400">View complete event information</p>
        </div>

        <Link to={`/admin/events/edit/${event._id || event.id}`}>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Edit Event</Button>
        </Link>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Overview</CardTitle>
              <CardDescription className="text-slate-400">
                General information about this event
              </CardDescription>
            </div>

            <StatusBadge status={(event.status as any) || 'draft'} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Description</h3>
            <p className="text-slate-400 leading-relaxed">
              {event.description || 'No description available'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Start Date</span>
              </div>
              <p className="text-slate-400">
                {event.startDate ? new Date(event.startDate).toLocaleString() : 'No date'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="font-medium">Venue</span>
              </div>
              <p className="text-slate-400">
                {event.venue?.name ? `${event.venue.name} - ` : ''}
                {event.venue?.address || 'Unknown location'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <User className="w-4 h-4" />
                <span className="font-medium">Organizer</span>
              </div>
              <p className="text-slate-400 break-all">
                {event.organizer || event.organizerWallet || 'Unknown organizer'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="font-medium">Tickets / Price</span>
              </div>
              <p className="text-slate-400">
                {typeof event.totalTickets === 'number'
                  ? `${event.totalTickets} tickets`
                  : `From ${event.ticketTiers?.[0]?.price ?? 0} ETH`}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <Tag className="w-4 h-4" />
                <span className="font-medium">Category</span>
              </div>
              <p className="text-slate-400">{event.category || 'Uncategorized'}</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center space-x-2 text-slate-300 mb-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">Created At</span>
              </div>
              <p className="text-slate-400">
                {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </div>

          {event.ticketTiers && event.ticketTiers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Ticket Tiers</h3>
              <div className="space-y-3">
                {event.ticketTiers.map((tier, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium">{tier.name || `Tier ${index + 1}`}</p>
                      <p className="text-sm text-slate-400">
                        Supply: {tier.totalSupply ?? 'N/A'}
                      </p>
                      {tier.benefits && tier.benefits.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          Benefits: {tier.benefits.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="text-white font-semibold">{tier.price ?? 0} ETH</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};