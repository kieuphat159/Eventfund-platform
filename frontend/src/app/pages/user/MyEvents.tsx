import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3Auth } from "@web3auth/modal/react";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Ban,
  Edit,
  Trash2,
  CircleDollarSign,
  Ticket,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import {
  cancelEventWithWalletFallback,
  deleteEvent,
  getMyEvents,
  type EventItem,
  type EventStatus,
} from "../../services/events.service";
import { useAuth } from "../../contexts/AuthContext";

const OWNER_CANCELABLE_STATUSES = new Set<EventStatus>([
  "draft",
  "funding",
  "funded",
  "ticketing",
]);

export const MyEvents: React.FC = () => {
  const navigate = useNavigate();
  const { user, connectWallet } = useAuth() as any;
  const { web3Auth } = useWeb3Auth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string>("");
  const [cancellingId, setCancellingId] = useState<string>("");

  const fetchEvents = async () => {
    if (!user?.walletAddress) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getMyEvents(user.walletAddress);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user?.walletAddress]);

  const handleDelete = async (event: EventItem) => {
    const eventId = event._id || event.id;
    if (!eventId) return;

    const ok = window.confirm(
      `Bạn có chắc muốn xoá sự kiện "${event.title || "Untitled event"}" không?\n\nChỉ nên xoá draft vì backend đang giới hạn xoá draft only.`,
    );
    if (!ok) return;

    try {
      setDeletingId(eventId);
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => (e._id || e.id) !== eventId));
    } catch (err: any) {
      alert(
        err?.response?.data?.message || err?.message || "Xoá sự kiện thất bại",
      );
    } finally {
      setDeletingId("");
    }
  };

  const handleCancel = async (event: EventItem) => {
    const eventId = event._id || event.id;
    if (!eventId) return;

    const ok = window.confirm(
      `Bạn có chắc muốn hủy sự kiện "${event.title || "Untitled event"}" không?\n\nEvent sẽ được chuyển sang trạng thái cancelled theo flow backend hiện tại.`,
    );
    if (!ok) return;

    try {
      setCancellingId(eventId);
      if (!web3Auth?.provider) {
        await connectWallet();
        alert(
          "Ví đã được kết nối. Vui lòng bấm Cancel Event thêm một lần nữa để ký giao dịch hủy bằng ví organizer.",
        );
        return;
      }

      const updated = await cancelEventWithWalletFallback(
        web3Auth?.provider as
          | {
              request: (args: {
                method: string;
                params?: unknown[];
              }) => Promise<unknown>;
            }
          | undefined,
        eventId,
        { status: "cancelled" },
        user?.walletAddress,
        user?.smartAccountAddress,
      );
      if (!updated) {
        throw new Error("Không thể hủy sự kiện");
      }

      setEvents((prev) =>
        prev.map((item) => ((item._id || item.id) === eventId ? updated : item)),
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Hủy sự kiện thất bại",
      );
    } finally {
      setCancellingId("");
    }
  };

  const stats = [
    { label: "Total Events", value: events.length.toString() },
    {
      label: "Draft",
      value: events.filter((e) => e.status === "draft").length.toString(),
    },
    {
      label: "Total Tickets Sold",
      value: events
        .reduce((sum, e) => sum + (e.ticketsSold || 0), 0)
        .toString(),
    },
    {
      label: "Funding Raised",
      value: events
        .reduce((sum, e) => sum + Number(e.currentFunding || 0), 0)
        .toString(),
    },
  ];

  if (loading) return <div className="text-white">Loading your events...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            My Events
          </h1>
          <p className="text-slate-400">Events you've created and organized</p>
        </div>
        <Button
          className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white"
          asChild
        >
          <Link to="/app/events/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="bg-slate-900/90 border-slate-800 hover:border-cyan-400/40 transition-colors"
          >
            <CardContent className="p-6">
              <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {events.length > 0 ? (
          events.map((event) => {
            const eventId = event._id || event.id || "";
            const totalTickets =
              typeof event.totalTickets === "number"
                ? event.totalTickets
                : (event.ticketTiers || []).reduce(
                    (sum, tier) => sum + (tier.totalSupply || 0),
                    0,
                  );

            const canDelete = (event.status || "draft") === "draft";
            const canCancel = OWNER_CANCELABLE_STATUSES.has(
              (event.status as EventStatus) || "draft",
            );

            return (
              <Card
                key={eventId}
                className="bg-slate-900/90 border-slate-800 hover:border-cyan-400/40 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">
                          {event.title || "Untitled event"}
                        </h3>
                        <StatusBadge
                          status={(event.status as any) || "draft"}
                        />
                      </div>
                      <p className="text-slate-400">
                        {event.description || "No description"}
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-slate-700 hover:bg-slate-800 text-slate-200"
                        onClick={() => navigate(`/app/events/edit/${eventId}`)}
                        disabled={!eventId}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="border-red-600 hover:bg-red-900/20 text-red-400 disabled:opacity-50"
                        onClick={() => handleCancel(event)}
                        disabled={
                          !eventId || !canCancel || cancellingId === eventId
                        }
                        title={
                          canCancel
                            ? "Cancel event"
                            : "This event can no longer be cancelled"
                        }
                      >
                        <Ban className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="border-red-600 hover:bg-red-900/20 text-red-400 disabled:opacity-50"
                        onClick={() => handleDelete(event)}
                        disabled={
                          !eventId || !canDelete || deletingId === eventId
                        }
                        title={
                          canDelete
                            ? "Delete event"
                            : "Only draft events can be deleted"
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {event.startDate
                          ? new Date(event.startDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "No date"}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400">
                      <MapPin className="w-4 h-4" />
                      <span>{event.venue?.address || "Unknown location"}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span>{totalTickets} tickets available</span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
                        <Ticket className="w-3.5 h-3.5 text-cyan-300" />
                        Tickets sold
                      </div>
                      <p className="text-lg font-semibold text-white">
                        {event.ticketsSold || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
                        <CircleDollarSign className="w-3.5 h-3.5 text-emerald-300" />
                        Funding raised
                      </div>
                      <p className="text-lg font-semibold text-white">
                        {Number(event.currentFunding || 0).toLocaleString()} wei
                      </p>
                    </div>
                  </div>

                  {(event.ticketTiers || []).length > 0 && (
                    <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                      {event.ticketTiers!.map((tier, index) => (
                        <div
                          key={index}
                          className="bg-slate-800/50 rounded-lg p-3"
                        >
                          <p className="text-sm text-slate-400 mb-1">
                            {tier.name}
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {tier.price} wei
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {tier.totalSupply || 0} available
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      Created:{" "}
                      {event.createdAt
                        ? new Date(event.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-red-600 hover:bg-red-900/20 text-red-300 disabled:opacity-50"
                        onClick={() => handleCancel(event)}
                        disabled={
                          !eventId || !canCancel || cancellingId === eventId
                        }
                      >
                        {cancellingId === eventId ? "Cancelling..." : "Cancel Event"}
                      </Button>

                      <Button
                        variant="outline"
                        className="border-slate-700 hover:bg-slate-800 text-white"
                        onClick={() => navigate(`/app/events/edit/${eventId}`)}
                        disabled={!eventId}
                      >
                        Edit Event
                      </Button>

                      <Button
                        variant="outline"
                        className="border-slate-700 hover:bg-slate-800 text-white"
                        asChild
                      >
                        <Link to={`/events/${eventId}`}>
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                          View Dashboard
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                No events yet
              </h3>
              <p className="text-slate-400 mb-6">
                Create your first event to get started
              </p>
              <Button
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white"
                asChild
              >
                <Link to="/app/events/create">
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
