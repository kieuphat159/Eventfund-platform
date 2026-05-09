import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, MapPin, Upload, Plus } from "lucide-react";
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
import { StatusBadge } from "../../components/StatusBadge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../../components/ui/alert-dialog";
import {
  completeEventWithWalletFallback,
  getEventById,
  updateEvent,
  type EventItem,
  type EventStatus,
  type Eip1193Provider,
} from "../../services/events.service";
import { useAuth } from "../../contexts/AuthContext";
import { useLoading } from "../../components/ui/loadingContext";
import { useWeb3Auth } from "@web3auth/modal/react";

type TicketTierForm = {
  name: string;
  price: string;
  supply: string;
};

const OWNER_FORWARD_STATUS_OPTIONS: Partial<Record<EventStatus, EventStatus[]>> = {
  ticketing: ["ongoing"],
  ongoing: ["completed"],
};

const OWNER_CANCELABLE_STATUSES = new Set<EventStatus>([
  "draft",
  "funding",
  "funded",
  "ticketing",
]);

const toDateInputValue = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const toTimeInputValue = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const isPositiveWeiInteger = (value: string) => {
  const trimmed = value.trim();
  return /^[0-9]+$/.test(trimmed) && BigInt(trimmed) > 0n;
};

export const EditEvent: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, connectWallet } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const { show: showLoading, hide: hideLoading } = useLoading();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [fundingGoal, setFundingGoal] = useState("");
  const [minStakeRequired, setMinStakeRequired] = useState("");
  const [status, setStatus] = useState<EventStatus>("draft");
  const [ticketTiers, setTicketTiers] = useState<TicketTierForm[]>([
    { name: "General", price: "", supply: "" },
  ]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = () => {
    topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        if (!id) {
          setError("Event id was not found.");
          return;
        }

        setLoading(true);
        setError("");
        // show global loader
        showLoading("Loading event...");

        const data = await getEventById(id);
        if (!data) {
          setError("Event not found.");
          return;
        }

        setEventData(data);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setDate(toDateInputValue(data.startDate));
        setTime(toTimeInputValue(data.startDate));
        setLocation(data.venue?.address || "");
        setCategory(data.category || "");
        setFundingGoal(data.fundingGoal != null ? String(data.fundingGoal) : "");
        setMinStakeRequired(
          data.minStakeRequired != null ? String(data.minStakeRequired) : "",
        );
        setStatus((data.status as EventStatus) || "draft");

        if (data.ticketTiers?.length) {
          setTicketTiers(
            data.ticketTiers.map((tier) => ({
              name: tier.name || "",
              price: tier.price != null ? String(tier.price) : "",
              supply: tier.totalSupply != null ? String(tier.totalSupply) : "",
            })),
          );
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load event data.",
        );
      } finally {
        setLoading(false);
        hideLoading();
      }
    };

    fetchEvent();
  }, [id]);

  useEffect(() => {
    if (error || success) {
      scrollToTop();
    }
  }, [error, success]);

  const addTier = () => {
    // no-op in view-only mode
    return;
  };

  const removeTier = (index: number) => {
    // no-op in view-only mode
    return;
  };

  const updateTierField = (
    index: number,
    field: "name" | "price" | "supply",
    value: string,
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

  const currentStatus = (eventData?.status as EventStatus) || "draft";
  const allowedForwardStatuses =
    OWNER_FORWARD_STATUS_OPTIONS[currentStatus] || [];
  const canOwnerAdvanceStatus = allowedForwardStatuses.length > 0;
  const canOwnerCancel = OWNER_CANCELABLE_STATUSES.has(currentStatus);
  const canOwnerChangeStatus = canOwnerAdvanceStatus || canOwnerCancel;

  const handleSubmit = async () => {
    try {
      setError("");
      setSuccess("");

      if (!id) {
        setError("Missing event id.");
        return;
      }

      if (!title.trim()) {
        setError("Please enter an event title.");
        return;
      }

      if (!description.trim()) {
        setError("Please enter an event description.");
        return;
      }

      if (!date || !time) {
        setError("Please choose an event date and time.");
        return;
      }

      // Only allow updating title, description, location, category in this view
      if (!location.trim()) {
        setError("Please enter a location.");
        return;
      }

      if (!category) {
        setError("Please choose a category.");
        return;
      }

      const normalizedTiers = ticketTiers
        .filter((tier) => tier.name.trim() && tier.price !== "" && tier.supply !== "")
        .map((tier) => ({
          name: tier.name.trim(),
          price: Number(tier.price),
          totalSupply: Number(tier.supply),
        }));

      if (!normalizedTiers.length) {
        setError("Please add at least one valid ticket tier.");
        return;
      }

      const updated = await updateEvent(id, updatePayload);

      if (hasInvalidTier) {
        setError("Ticket price or supply is invalid.");
        return;
      }

      setSuccess("Event updated successfully");
      setEventData(updated);
      setStatus((updated.status as EventStatus) || status);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update event",
      );
    } finally {
      setSubmitting(false);
      hideLoading();
    }
  };

      const start = buildStartDate();
      if (!start) {
        setError("The event start time is invalid.");
        return;
      }

      // confirmation handled by modal trigger; proceed when called

      const fundingDeadline = eventData?.fundingDeadline
        ? new Date(eventData.fundingDeadline)
        : new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

      if (!fundingGoal.trim()) {
        setError("Please enter a funding goal.");
        return;
      }

      const provider = web3Auth?.provider as Eip1193Provider | undefined;
      if (!provider?.request) {
        setError(
          "Wallet provider is not ready. Please reconnect wallet and try again.",
        );
        return;
      }

      const updated = await updateEvent(id, {
        title: title.trim(),
        description: description.trim(),
        category,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        fundingGoal: fundingGoal.trim(),
        minStakeRequired: minStakeRequired.trim() || "0",
        fundingDeadline: fundingDeadline.toISOString(),
        totalTickets,
        venue: { address: location.trim() },
        ticketTiers: normalizedTiers,
        ...(status !== currentStatus ? { status } : {}),
      });

      if (!updated) {
        setError("Failed to update event.");
        return;
      }

      setSuccess("Event updated successfully.");
      setEventData(updated);
      setStatus((updated.status as EventStatus) || "completed");
      setSuccess("Event completed successfully");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "An error occurred while updating the event.",
      );
    } finally {
      setCompleting(false);
      hideLoading();
    }
  };


  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div ref={topAnchorRef} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Edit Event</h1>
          <p className="text-slate-400">Update your event information</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="border-slate-700 text-white hover:bg-slate-800"
          onClick={() => navigate("/app/events/my-events")}
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

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Event Details</CardTitle>
          <CardDescription className="text-slate-400">
            Organizer can cancel eligible events here, and can still move the
            status forward once ticketing has started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Current workflow status
                </p>
                <p className="text-xs text-slate-400">
                  You can cancel events in `draft`, `funding`, `funded`, or
                  `ticketing`. Once funding is settled, you can move a funded
                  event to `ticketing`, then advance to `ongoing` and
                  `completed`.
                </p>
              </div>
              <StatusBadge status={currentStatus as string} />
            </div>
          </div>

          <div>
            <Label htmlFor="title" className="text-white">
              Event Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event name"
              className="mt-1.5 border-slate-700 bg-slate-800 text-white"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-white">
              Description *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your event..."
              className="mt-1.5 min-h-[120px] border-slate-700 bg-slate-800 text-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="start-date" className="text-white">
                Event Start Date
              </Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="start-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-slate-700 bg-slate-800 pl-10 text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="start-time" className="text-white">
                Event Start Time
              </Label>
              <Input
                id="start-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 border-slate-700 bg-slate-800 text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="end-date" className="text-white">
                Event End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={toDateInputValue(eventData?.endDate)}
                disabled
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="end-time" className="text-white">
                Event End Time
              </Label>
              <Input
                id="end-time"
                type="time"
                value={toTimeInputValue(eventData?.endDate)}
                disabled
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ticketing-start" className="text-white">
                Ticketing Start Date
              </Label>
              <Input
                id="ticketing-start"
                type="date"
                value={toDateInputValue(eventData?.ticketingStartAt)}
                disabled
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="ticketing-end" className="text-white">
                Ticketing End Date
              </Label>
              <Input
                id="ticketing-end"
                type="date"
                value={toDateInputValue(eventData?.ticketingEndAt)}
                disabled
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          {eventData?.investmentEnabled !== false ? (
            <div className="grid md:grid-cols-1 gap-4">
              <div>
                <Label htmlFor="funding-deadline" className="text-white">
                  Funding Deadline
                </Label>
                <Input
                  id="funding-deadline"
                  type="date"
                  value={toDateInputValue(eventData?.fundingDeadline)}
                  disabled
                  className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="location" className="text-white">
              Location *
            </Label>
            <div className="relative mt-1.5">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter venue or address"
                className="border-slate-700 bg-slate-800 pl-10 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category" className="text-white">
              Category *
            </Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white"
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
            <Label htmlFor="status" className="text-white">
              Progress Status
            </Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              disabled={!canOwnerAdvanceStatus}
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white disabled:opacity-60"
            >
              <option value={currentStatus}>{currentStatus}</option>
              {allowedForwardStatuses.map((nextStatus) => (
                <option key={nextStatus} value={nextStatus}>
                  {nextStatus}
                </option>
              ))}
              {canOwnerCancel && currentStatus !== "cancelled" && (
                <option value="cancelled">cancelled</option>
              )}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {canOwnerAdvanceStatus
                ? "You can only advance to the next workflow step, not move backward."
                : "You cannot change the workflow status at this stage."}
            </p>
            {status === "cancelled" && currentStatus !== "cancelled" && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Event will be submitted according to the existing cancellation flow of the backend. If the event
                is in `ticketing` status, the system will process it according to the corresponding ticketing cancellation
                branch.
              </div>
            )}
            {(currentStatus === "ticketing" || currentStatus === "ongoing") && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <p>
                  When eligible, the organizer's wallet can mark the event as completed to trigger
                  on-chain completion and release revenue.
                </p>
                <>
                  <Button
                    type="button"
                    onClick={() => setShowConfirmOpen(true)}
                    disabled={submitting || completing}
                    className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  >
                    {completing ? "Completing..." : "Mark as Completed"}
                  </Button>

                  {/* Confirmation modal */}
                  <AlertDialog open={showConfirmOpen} onOpenChange={setShowConfirmOpen}>
                    <AlertDialogContent className="max-w-md border-slate-700 bg-slate-900">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Confirm Completion</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          Are you sure you want to complete this event? The system will trigger on-chain completion and release revenue.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            setShowConfirmOpen(false);
                            await handleCompleteEvent();
                          }}
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Event Image</CardTitle>
          <CardDescription className="text-slate-400">
            Upload a cover image for your event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-slate-700 p-8 text-center opacity-70 sm:p-12">
            <Upload className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="mb-2 text-white">
              Image upload is not connected to the multipart API yet.
            </p>
            <p className="text-sm text-slate-500">
              It can be wired with `FormData` later once the backend upload
              endpoint is ready.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              className="border-slate-700 text-white hover:bg-slate-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticketTiers.map((tier, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h4 className="font-medium text-white">Tier {index + 1}</h4>
                {ticketTiers.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeTier(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor={`tier-name-${index}`} className="text-slate-300">
                    Tier Name
                  </Label>
                  <Input
                    id={`tier-name-${index}`}
                    placeholder="e.g., VIP, General"
                    value={tier.name}
                    onChange={(e) => updateTierField(index, "name", e.target.value)}
                    className="mt-1.5 border-slate-700 bg-slate-800 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor={`tier-price-${index}`} className="text-slate-300">
                    Price (ETH)
                  </Label>
                  <Input
                    id={`tier-price-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g., 1000000000000000"
                    value={tier.price}
                    onChange={(e) => updateTierField(index, "price", e.target.value)}
                    className="mt-1.5 border-slate-700 bg-slate-800 text-white"
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
                    onChange={(e) => updateTierField(index, "supply", e.target.value)}
                    className="mt-1.5 border-slate-700 bg-slate-800 text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Investment Options</CardTitle>
          <CardDescription className="text-slate-400">
            Funding info required by the investment architecture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="funding-goal" className="text-slate-300">
                Funding Goal *
              </Label>
              <Input
                id="funding-goal"
                value={fundingGoal}
                disabled
                placeholder="5000000000000000000"
                className="mt-1.5 border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div>
              <Label htmlFor="min-stake-required" className="text-slate-300">
                Minimum Organizer Stake
              </Label>
              <Input
                id="min-stake-required"
                value={minStakeRequired}
                disabled
                placeholder="1000000000000000000"
                className="mt-1.5 border-slate-700 bg-slate-800 text-white"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            The backend stores funding fields as integer strings in wei. This
            value represents the event creator stake, not the minimum donor
            contribution.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 text-white hover:bg-slate-800"
          onClick={() => navigate("/app/events/my-events")}
        >
          Cancel
        </Button>

        <Button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="px-8 text-white disabled:opacity-50 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
