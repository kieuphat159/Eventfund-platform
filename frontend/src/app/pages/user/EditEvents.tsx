import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, MapPin, Upload, Plus } from "lucide-react";
import { useWeb3Auth } from "@web3auth/modal/react";
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
  getEventById,
  updateEvent,
  type EventItem,
  type EventStatus,
} from "../../services/events.service";
import {
  completeEventOnChainWithWallet,
  type Eip1193Provider,
} from "../../services/events.service";
import { useAuth } from "../../contexts/AuthContext";
import { useLoading } from "../../components/ui/loadingContext";

type TicketTierForm = {
  name: string;
  price: string;
  supply: string;
};

const OWNER_FORWARD_STATUS_OPTIONS: Partial<
  Record<EventStatus, EventStatus[]>
> = {
  funded: ["ticketing"],
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
  const [completing, setCompleting] = useState(false);

  const [ticketTiers, setTicketTiers] = useState<TicketTierForm[]>([
    { name: "General", price: "", supply: "" },
  ]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = () => {
    topAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        if (!id) {
          setError("Event ID not found");
          return;
        }

        setLoading(true);
        setError("");
        // show global loader
        showLoading("Loading event...");

        const data = await getEventById(id);

        if (!data) {
          setError("Event not found");
          return;
        }

        setEventData(data);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setDate(toDateInputValue(data.startDate));
        setTime(toTimeInputValue(data.startDate));
        setLocation(data.venue?.address || "");
        setCategory(data.category || "");
        setFundingGoal(
          data.fundingGoal != null ? String(data.fundingGoal) : "",
        );
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
            "Failed to load event data",
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
        setError("Missing event id");
        return;
      }

      if (!title.trim()) {
        setError("Please enter event title");
        return;
      }

      if (!description.trim()) {
        setError("Please enter event description");
        return;
      }

      // Only allow updating title, description, location, category in this view
      if (!location.trim()) {
        setError("Please enter the location");
        return;
      }

      if (!category) {
        setError("Please select a category");
        return;
      }

      if (
        status === "completed" &&
        currentStatus !== "completed" &&
        !window.confirm(
          "Bạn có chắc muốn hoàn tất sự kiện này không?\n\nHệ thống sẽ cần ký ví organizer để gọi on-chain completion và release revenue.",
        )
      ) {
        return;
      }

      setSubmitting(true);
      showLoading("Saving changes...");
      const updatePayload = {
        title: title.trim(),
        description: description.trim(),
        category,
        venue: {
          address: location.trim(),
        },
      };

      const updated = await updateEvent(id, updatePayload);

      if (!updated) {
        setError("Cập nhật sự kiện thất bại");
        return;
      }

      setSuccess("Cập nhật sự kiện thành công");
      setEventData(updated);
      setStatus((updated.status as EventStatus) || status);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Có lỗi xảy ra khi cập nhật sự kiện",
      );
    } finally {
      setSubmitting(false);
      hideLoading();
    }
  };

  const handleCompleteOnChain = async () => {
    if (!id || !eventData?._id) {
      setError("Missing event id");
      return;
    }

    if (
      currentStatus !== "ongoing" &&
      currentStatus !== "ticketing" &&
      currentStatus !== "completed"
    ) {
      setError(
        "Event must be ticketing, ongoing, or already completed locally before syncing on-chain",
      );
      return;
    }

    try {
      setCompleting(true);
      setError("");
      setSuccess("");
      showLoading("Completing event on-chain...");

      const provider = web3Auth?.provider as Eip1193Provider | undefined;
      if (!provider?.request) {
        await connectWallet();
        setSuccess(
          "Wallet connected. Please press the button again to sign with the organizer wallet.",
        );
        return;
      }

      const updated = await completeEventOnChainWithWallet(
        provider,
        id,
        user?.walletAddress,
        user?.smartAccountAddress,
      );

      if (!updated) {
        throw new Error("Unable to complete event on-chain");
      }

      setEventData(updated);
      setStatus((updated.status as EventStatus) || "completed");
      setSuccess(
        "Event completed on-chain successfully. Revenue release has been submitted as well.",
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to complete event on-chain",
      );
    } finally {
      setCompleting(false);
      hideLoading();
    }
  };

  const canSyncCompletionOnChain =
    currentStatus === "ongoing" ||
    currentStatus === "ticketing" ||
    currentStatus === "completed";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div ref={topAnchorRef} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Edit Event</h1>
          <p className="text-slate-400">Update your event information</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="border-slate-700 hover:bg-slate-800 text-white"
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

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Details</CardTitle>
          <CardDescription className="text-slate-400">
            Organizer can cancel eligible events here, and can still move the
            status forward once ticketing has started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
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
              <StatusBadge status={currentStatus as any} />
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
              className="mt-1.5 bg-slate-800 border-slate-700 text-white"
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
              className="mt-1.5 bg-slate-800 border-slate-700 text-white min-h-[120px]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date" className="text-white">
                Event Start Date
              </Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="start-date"
                  type="date"
                  value={toDateInputValue(eventData?.startDate)}
                  disabled
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
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
                value={toTimeInputValue(eventData?.startDate)}
                disabled
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
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

          <div className="grid md:grid-cols-1 gap-4">
            <div>
              <Label htmlFor="category" className="text-white">
                Category *
              </Label>
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
          </div>

          <div>
            <Label htmlFor="status" className="text-white">
              Progress Status
            </Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              disabled
              className="mt-1.5 w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-white text-sm disabled:opacity-60"
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
              Trạng thái chỉ hiển thị, không thể chỉnh sửa từ đây.
            </p>
            {status === "cancelled" && currentStatus !== "cancelled" && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Event sẽ được gửi theo flow hủy hiện có của backend. Nếu event
                đang ở `ticketing`, hệ thống sẽ xử lý theo nhánh hủy ticketing
                tương ứng.
              </div>
            )}
            {status === "completed" && currentStatus !== "completed" && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Khi hoàn tất event, organizer wallet sẽ ký 2 giao dịch on-chain:
                đánh dấu `completed` và `release revenue` để hệ thống chia tiền.
              </div>
            )}
            {canSyncCompletionOnChain && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handleCompleteOnChain()}
                  disabled={completing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {completing
                    ? "Completing..."
                    : currentStatus === "completed"
                      ? "Sync on-chain completion"
                      : "Complete on"}
                </Button>
              </div>
            )}
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
            <p className="text-white mb-2">
              Image upload chưa nối vào API multipart
            </p>
            <p className="text-sm text-slate-500">
              Có thể nối thêm FormData sau nếu backend đã hỗ trợ endpoint
              upload.
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
              disabled
              className="border-slate-700 text-white disabled:opacity-50"
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
                {/* tier editing is view-only; remove delete control */}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label
                    htmlFor={`tier-name-${index}`}
                    className="text-slate-300"
                  >
                    Tier Name
                  </Label>
                  <Input
                    id={`tier-name-${index}`}
                    placeholder="e.g., VIP, General"
                    value={tier.name}
                    disabled
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`tier-price-${index}`}
                    className="text-slate-300"
                  >
                    Price (wei)
                  </Label>
                  <Input
                    id={`tier-price-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g., 1000000000000000"
                    value={tier.price}
                    disabled
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`tier-supply-${index}`}
                    className="text-slate-300"
                  >
                    Total Supply
                  </Label>
                  <Input
                    id={`tier-supply-${index}`}
                    type="number"
                    placeholder="100"
                    value={tier.supply}
                    disabled
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
            Funding info required by the investment architecture
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
                disabled
                placeholder="5000000000000000000"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
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
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Backend đang lưu funding fields dạng integer string theo wei. Đây là
            mức stake của event creator, không phải mức góp tối thiểu của
            donator.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 hover:bg-slate-800 text-white"
          onClick={() => navigate("/app/events/my-events")}
        >
          Cancel
        </Button>

        <Button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
