import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, MapPin, Upload, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  getEventById,
  updateEvent,
  type EventItem,
  type EventStatus,
} from '../../services/events.service';

type TicketTierForm = {
  name: string;
  price: string;
  supply: string;
};

const toDateInputValue = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toTimeInputValue = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const EditEvent: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [eventData, setEventData] = useState<EventItem | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [fundingGoal, setFundingGoal] = useState('');
  const [minStakeRequired, setMinStakeRequired] = useState('');
  const [status, setStatus] = useState<EventStatus>('draft');

  const [ticketTiers, setTicketTiers] = useState<TicketTierForm[]>([
    { name: 'General', price: '', supply: '' },
  ]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        if (!id) {
          setError('Không tìm thấy event id');
          return;
        }

        setLoading(true);
        setError('');

        const data = await getEventById(id);

        if (!data) {
          setError('Không tìm thấy sự kiện');
          return;
        }

        setEventData(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setDate(toDateInputValue(data.startDate));
        setTime(toTimeInputValue(data.startDate));
        setLocation(data.venue?.address || '');
        setCategory(data.category || '');
        setFundingGoal(data.fundingGoal != null ? String(data.fundingGoal) : '');
        setMinStakeRequired(data.minStakeRequired != null ? String(data.minStakeRequired) : '');
        setStatus((data.status as EventStatus) || 'draft');

        if (data.ticketTiers?.length) {
          setTicketTiers(
            data.ticketTiers.map((tier) => ({
              name: tier.name || '',
              price: tier.price != null ? String(tier.price) : '',
              supply: tier.totalSupply != null ? String(tier.totalSupply) : '',
            }))
          );
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Không tải được dữ liệu sự kiện');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const addTier = () => {
    setTicketTiers((prev) => [...prev, { name: '', price: '', supply: '' }]);
  };

  const removeTier = (index: number) => {
    setTicketTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTierField = (
    index: number,
    field: 'name' | 'price' | 'supply',
    value: string
  ) => {
    setTicketTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const buildStartDate = () => {
    if (!date || !time) return null;
    return new Date(`${date}T${time}`);
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSuccess('');

      if (!id) {
        setError('Thiếu event id');
        return;
      }

      if (!title.trim()) {
        setError('Vui lòng nhập tên sự kiện');
        return;
      }

      if (!description.trim()) {
        setError('Vui lòng nhập mô tả sự kiện');
        return;
      }

      if (!date || !time) {
        setError('Vui lòng chọn ngày và giờ sự kiện');
        return;
      }

      if (!location.trim()) {
        setError('Vui lòng nhập địa điểm');
        return;
      }

      if (!category) {
        setError('Vui lòng chọn danh mục');
        return;
      }

      const normalizedTiers = ticketTiers
        .filter((tier) => tier.name.trim() && tier.price !== '' && tier.supply !== '')
        .map((tier) => ({
          name: tier.name.trim(),
          price: Number(tier.price),
          totalSupply: Number(tier.supply),
        }));

      if (!normalizedTiers.length) {
        setError('Vui lòng tạo ít nhất 1 hạng vé hợp lệ');
        return;
      }

      const hasInvalidTier = normalizedTiers.some(
        (tier) =>
          Number.isNaN(tier.price) ||
          Number.isNaN(tier.totalSupply) ||
          tier.price < 0 ||
          tier.totalSupply <= 0
      );

      if (hasInvalidTier) {
        setError('Giá vé hoặc số lượng vé không hợp lệ');
        return;
      }

      const totalTickets = normalizedTiers.reduce((sum, tier) => sum + tier.totalSupply, 0);

      const start = buildStartDate();
      if (!start) {
        setError('Ngày giờ bắt đầu không hợp lệ');
        return;
      }

      const end = eventData?.endDate
        ? new Date(eventData.endDate)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000);

      const fundingDeadline = eventData?.fundingDeadline
        ? new Date(eventData.fundingDeadline)
        : new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

      if (!fundingGoal.trim()) {
        setError('Vui lòng nhập funding goal');
        return;
      }

      setSubmitting(true);

      const updated = await updateEvent(id, {
        title: title.trim(),
        description: description.trim(),
        category,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        fundingGoal: fundingGoal.trim(),
        minStakeRequired: minStakeRequired.trim() || '0',
        fundingDeadline: fundingDeadline.toISOString(),
        totalTickets,
        venue: {
          address: location.trim(),
        },
        ticketTiers: normalizedTiers,
        status,
      });

      if (!updated) {
        setError('Cập nhật sự kiện thất bại');
        return;
      }

      setSuccess('Cập nhật sự kiện thành công');
      setEventData(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi cập nhật sự kiện');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading event...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Edit Event</h1>
          <p className="text-slate-400">Update your event information</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="border-slate-700 hover:bg-slate-800 text-white"
          onClick={() => navigate('/app/events/my-events')}
        >
          Back
        </Button>
      </div>

      {!!error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!!success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Details</CardTitle>
          <CardDescription className="text-slate-400">
            Basic information about your event
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-white">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event name"
              className="mt-1.5 bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-white">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your event..."
              className="mt-1.5 bg-slate-800 border-slate-700 text-white min-h-[120px]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-white">Event Date *</Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="time" className="text-white">Event Time *</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location" className="text-white">Location *</Label>
            <div className="relative mt-1.5">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter venue or address"
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-white">Category *</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-white text-sm"
              >
                <option value="">Select a category</option>
                <option value="music">Music</option>
                <option value="tech">Technology</option>
                <option value="sports">Sports</option>
                <option value="art">Art &amp; Culture</option>
                <option value="business">Business</option>
                <option value="conference">Conference</option>
              </select>
            </div>

            <div>
              <Label htmlFor="status" className="text-white">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="mt-1.5 w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-white text-sm"
              >
                <option value="draft">Draft</option>
                <option value="funding">Funding</option>
                <option value="funded">Funded</option>
                <option value="ticketing">Ticketing</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Image</CardTitle>
          <CardDescription className="text-slate-400">
            Upload a cover image for your event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-12 text-center opacity-70">
            <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-white mb-2">Image upload chưa nối vào API multipart</p>
            <p className="text-sm text-slate-500">
              Có thể nối thêm FormData sau nếu backend đã hỗ trợ endpoint upload.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Ticket Tiers</CardTitle>
              <CardDescription className="text-slate-400">
                Define different ticket types and pricing
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={addTier}
              variant="outline"
              size="sm"
              className="border-slate-700 hover:bg-slate-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticketTiers.map((tier, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
            >
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-white font-medium">Tier {index + 1}</h4>
                {ticketTiers.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeTier(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`tier-name-${index}`} className="text-slate-300">
                    Tier Name
                  </Label>
                  <Input
                    id={`tier-name-${index}`}
                    placeholder="e.g., VIP, General"
                    value={tier.name}
                    onChange={(e) => updateTierField(index, 'name', e.target.value)}
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor={`tier-price-${index}`} className="text-slate-300">
                    Price (ETH)
                  </Label>
                  <Input
                    id={`tier-price-${index}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={tier.price}
                    onChange={(e) => updateTierField(index, 'price', e.target.value)}
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor={`tier-supply-${index}`} className="text-slate-300">
                    Total Supply
                  </Label>
                  <Input
                    id={`tier-supply-${index}`}
                    type="number"
                    placeholder="100"
                    value={tier.supply}
                    onChange={(e) => updateTierField(index, 'supply', e.target.value)}
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Investment Options</CardTitle>
          <CardDescription className="text-slate-400">
            Funding info required by current backend API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="funding-goal" className="text-slate-300">
                Funding Goal *
              </Label>
              <Input
                id="funding-goal"
                value={fundingGoal}
                onChange={(e) => setFundingGoal(e.target.value)}
                placeholder="5000000000000000000"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="min-stake-required" className="text-slate-300">
                Min Stake Required
              </Label>
              <Input
                id="min-stake-required"
                value={minStakeRequired}
                onChange={(e) => setMinStakeRequired(e.target.value)}
                placeholder="1000000000000000000"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Hiện backend đang dùng số dạng string lớn, ví dụ wei.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 hover:bg-slate-800 text-white"
          onClick={() => navigate('/app/events/my-events')}
        >
          Cancel
        </Button>

        <Button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};