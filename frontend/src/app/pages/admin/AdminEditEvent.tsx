import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  getAdminEventById,
  updateAdminEvent,
  updateAdminEventStatus,
  type EventStatus,
} from "../../services/events.service";

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

type TicketTierForm = {
  name: string;
  price: string;
  supply: string;
};

const isPositiveWeiInteger = (value: string) => {
  const trimmed = value.trim();
  return /^[0-9]+$/.test(trimmed) && BigInt(trimmed) > 0n;
};

export const AdminEditEvent: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentStatus, setCurrentStatus] = useState<EventStatus>('draft');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    status: 'draft' as EventStatus,
    startDate: '',
    endDate: '',
    fundingGoal: '',
    minStakeRequired: '',
    fundingDeadline: '',
    venueName: '',
    venueAddress: '',
    quantity: '1',
    ticketType: '0',
  });
  const [ticketTiers, setTicketTiers] = useState<TicketTierForm[]>([
    { name: "", price: "", supply: "" },
  ]);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = () => {
    topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setError("Invalid event id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const foundEvent = await getAdminEventById(id);

        if (!foundEvent) {
          setError("Event not found");
          return;
        }

        setFormData({
          title: foundEvent.title || '',
          description: foundEvent.description || '',
          category: foundEvent.category || '',
          status: EVENT_STATUSES.includes((foundEvent.status || 'draft') as EventStatus)
            ? (foundEvent.status as EventStatus)
            : 'draft',
          startDate: foundEvent.startDate
            ? new Date(foundEvent.startDate).toISOString().slice(0, 16)
            : "",
          endDate: foundEvent.endDate
            ? new Date(foundEvent.endDate).toISOString().slice(0, 16)
            : '',
          fundingGoal:
            foundEvent.fundingGoal != null ? String(foundEvent.fundingGoal) : '',
          minStakeRequired:
            foundEvent.minStakeRequired != null
              ? String(foundEvent.minStakeRequired)
              : '',
          fundingDeadline: foundEvent.fundingDeadline
            ? new Date(foundEvent.fundingDeadline).toISOString().slice(0, 16)
            : '',
          venueName: foundEvent.venue?.name || '',
          venueAddress: foundEvent.venue?.address || '',
          quantity: String(foundEvent.totalTickets && foundEvent.totalTickets > 0 ? foundEvent.totalTickets : 1),
          ticketType: '0',
        });
        setCurrentStatus((foundEvent.status as EventStatus) || 'draft');
        setTicketTiers(
          foundEvent.ticketTiers?.length
            ? foundEvent.ticketTiers.map((tier) => ({
                name: tier.name || "",
                price: tier.price != null ? String(tier.price) : "",
                supply:
                  tier.totalSupply != null ? String(tier.totalSupply) : "",
              }))
            : [{ name: "", price: "", supply: "" }],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  useEffect(() => {
    if (error || success) {
      scrollToTop();
    }
  }, [error, success]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateTier = (
    index: number,
    field: keyof TicketTierForm,
    value: string,
  ) => {
    setTicketTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addTier = () => {
    setTicketTiers((prev) => [...prev, { name: "", price: "", supply: "" }]);
  };

  const removeTier = (index: number) => {
    setTicketTiers((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
      setError("Invalid event id");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const quantity = Number(formData.quantity);
      const ticketType = Number(formData.ticketType);

      if (formData.status === 'ticketing') {
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('Quantity must be a positive integer for ticketing status');
        }
      }

      const filledTiers = ticketTiers
        .filter(
          (tier) => tier.name.trim() && tier.price !== "" && tier.supply !== "",
        );
      const normalizedTiers = filledTiers.map((tier) => ({
        name: tier.name.trim(),
        price: Number.parseInt(tier.price.trim(), 10),
        totalSupply: Number(tier.supply),
      }));

      let resolvedStatus = currentStatus;
      if (formData.status !== currentStatus) {
        const statusResult = await updateAdminEventStatus(id, formData.status, {
          quantity: formData.status === 'ticketing' ? quantity : undefined,
          ticketType: formData.status === 'ticketing' ? ticketType : undefined,
        });
        resolvedStatus = (statusResult?.status as EventStatus) || formData.status;
      }

      if (!normalizedTiers.length) {
        setError("At least one valid ticket tier is required");
        return;
      }

      const hasInvalidTier = normalizedTiers.some(
        (_tier, index) =>
          !isPositiveWeiInteger(filledTiers[index]?.price || "") ||
          Number.isNaN(normalizedTiers[index]?.totalSupply) ||
          !Number.isInteger(normalizedTiers[index]?.totalSupply) ||
          normalizedTiers[index]?.totalSupply <= 0,
      );
      if (hasInvalidTier) {
        setError("Tier price (wei) and supply must be positive integers");
        return;
      }

      if (!formData.startDate || !formData.endDate) {
        setError("Start date and end date are required");
        return;
      }

      if (!formData.venueAddress.trim()) {
        setError("Venue address is required");
        return;
      }

      const totalTickets = normalizedTiers.reduce(
        (sum, tier) => sum + tier.totalSupply,
        0,
      );

      await updateAdminEvent(id, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        fundingGoal: formData.fundingGoal || "0",
        minStakeRequired: formData.minStakeRequired || "0",
        fundingDeadline: formData.fundingDeadline
          ? new Date(formData.fundingDeadline).toISOString()
          : undefined,
        venue: {
          address: formData.venueAddress,
        },
        totalTickets,
        ticketTiers: normalizedTiers,
      });

      setSuccess("Event updated successfully");
      setCurrentStatus(resolvedStatus);
      setFormData((prev) => ({ ...prev, status: resolvedStatus }));
      navigate(`/admin/events/${id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update event status",
      );
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
          <Button
            variant="outline"
            className="border-slate-600 hover:bg-slate-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div ref={topAnchorRef} />
      <div>
        <Link
          to={`/admin/events/${id}`}
          className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Details
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Edit Event</h1>
        <p className="text-slate-400">
          Admin can update operational details and funding configuration
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Information</CardTitle>
          <CardDescription className="text-slate-400">
            Manage the full event payload from the admin panel.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="text-sm text-red-400">{error}</div>}
            {success && (
              <div className="text-sm text-emerald-400">{success}</div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Event title"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                placeholder="Event description"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Category"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange("status", value)}
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
                <p className="text-xs text-slate-500">
                  `cancelled` is for manual admin/organizer cancellation. `failed`
                  is for terminal auto-failure cases such as ticket sales not
                  meeting threshold.
                </p>
              </div>
            </div>

            {formData.status === 'ticketing' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Mint Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="e.g. 10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Ticket Type</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.ticketType}
                    onChange={(e) => handleChange('ticketType', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => handleChange("startDate", e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
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
                    onChange={(e) => handleChange("endDate", e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Funding Goal</Label>
                <Input
                  value={formData.fundingGoal}
                  onChange={(e) => handleChange("fundingGoal", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">
                  Minimum Organizer Stake
                </Label>
                <Input
                  value={formData.minStakeRequired}
                  onChange={(e) =>
                    handleChange("minStakeRequired", e.target.value)
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Funding Deadline</Label>
                <Input
                  type="datetime-local"
                  value={formData.fundingDeadline}
                  onChange={(e) =>
                    handleChange("fundingDeadline", e.target.value)
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Funding values are stored as integer strings in wei. The stake
              field here represents organizer collateral, not the donor minimum.
            </p>

            <div className="space-y-2">
              <Label className="text-slate-300">Venue Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={formData.venueAddress}
                  onChange={(e) => handleChange("venueAddress", e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  placeholder="Venue address"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300">Ticket Tiers</Label>
                  <p className="text-sm text-slate-500 mt-1">
                    Admin can tune supply and pricing here (price unit: wei).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-600 hover:bg-slate-700 text-white"
                  onClick={addTier}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tier
                </Button>
              </div>

              {ticketTiers.map((tier, index) => (
                <div
                  key={index}
                  className="grid md:grid-cols-[1fr_160px_160px_auto] gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                >
                  <Input
                    value={tier.name}
                    onChange={(e) => updateTier(index, "name", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Tier name"
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tier.price}
                    onChange={(e) => updateTier(index, "price", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Price (wei)"
                  />
                  <Input
                    type="number"
                    value={tier.supply}
                    onChange={(e) =>
                      updateTier(index, "supply", e.target.value)
                    }
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Supply"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-900/20"
                    onClick={() => removeTier(index)}
                    disabled={ticketTiers.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
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
                {saving ? "Saving..." : "Save Event"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEditEvent;
