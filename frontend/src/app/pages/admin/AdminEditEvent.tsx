import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  getEventById,
  updateAdminEventStatus,
  type EventStatus,
} from '../../services/events.service';

const EVENT_STATUSES: EventStatus[] = [
  'draft',
  'funding',
  'funded',
  'ticketing',
  'ongoing',
  'completed',
  'cancelled',
  'failed',
];

export const EditEvent: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    status: 'draft' as EventStatus,
    startDate: '',
    endDate: '',
    venueName: '',
    venueAddress: '',
  });

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

        const foundEvent = await getEventById(id);

        if (!foundEvent) {
          setError('Event not found');
          return;
        }

        setFormData({
          title: foundEvent.title || '',
          description: foundEvent.description || '',
          category: foundEvent.category || '',
          status: foundEvent.status || 'draft',
          startDate: foundEvent.startDate
            ? new Date(foundEvent.startDate).toISOString().slice(0, 16)
            : '',
          endDate: foundEvent.endDate
            ? new Date(foundEvent.endDate).toISOString().slice(0, 16)
            : '',
          venueName: foundEvent.venue?.name || '',
          venueAddress: foundEvent.venue?.address || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
      setError('Invalid event id');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await updateAdminEventStatus(id, formData.status);

      navigate(`/admin/events/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading event...</div>;
  }

  if (error && !formData.title) {
    return (
      <div className="space-y-4">
        <div className="text-red-400">{error}</div>
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
      <div>
        <Link
          to={`/admin/events/${id}`}
          className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Details
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Update Event Status</h1>
        <p className="text-slate-400">Admin can currently update event status only</p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Information</CardTitle>
          <CardDescription className="text-slate-400">
            Event details are read-only. Only status can be updated.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="text-sm text-red-400">{error}</div>}

            <div className="space-y-2">
              <Label className="text-slate-300">Title</Label>
              <Input
                value={formData.title}
                disabled
                className="bg-slate-800 border-slate-700 text-white opacity-70"
                placeholder="Event title"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>
              <Textarea
                value={formData.description}
                disabled
                className="bg-slate-800 border-slate-700 text-white min-h-[120px] opacity-70"
                placeholder="Event description"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Category</Label>
                <Input
                  value={formData.category}
                  disabled
                  className="bg-slate-800 border-slate-700 text-white opacity-70"
                  placeholder="Category"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {EVENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="datetime-local"
                    value={formData.startDate}
                    disabled
                    className="pl-10 bg-slate-800 border-slate-700 text-white opacity-70"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="datetime-local"
                    value={formData.endDate}
                    disabled
                    className="pl-10 bg-slate-800 border-slate-700 text-white opacity-70"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Venue Name</Label>
                <Input
                  value={formData.venueName}
                  disabled
                  className="bg-slate-800 border-slate-700 text-white opacity-70"
                  placeholder="Venue name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Venue Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    value={formData.venueAddress}
                    disabled
                    className="pl-10 bg-slate-800 border-slate-700 text-white opacity-70"
                    placeholder="Venue address"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
              <Link to={`/admin/events/${id}`}>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-600 hover:bg-slate-700 text-white"
                >
                  Cancel
                </Button>
              </Link>

              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? 'Saving...' : 'Save Status'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};