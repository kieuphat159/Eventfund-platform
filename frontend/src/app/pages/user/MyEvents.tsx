import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { useWeb3Auth } from "@web3auth/modal/react";
import {
  ArrowUpRight,
  Ban,
  Calendar,
  CircleDollarSign,
  Download,
  Edit,
  Eye,
  MapPin,
  Plus,
  QrCode,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import {
  cancelEventWithWalletFallback,
  deleteEvent,
  getManagedEvents,
  getMyEvents,
  type EventItem,
  type EventStatus,
} from "../../services/events.service";
import { getTickets, type ApiTicket } from "../../services/tickets.service";
import { resolveTransactionProvider } from "../../services/providerService";
import { useAuth } from "../../contexts/AuthContext";
import { useLoading } from "../../components/ui/loadingContext";
import { InsufficientBalanceDialog } from "../../components/shared/InsufficientBalanceDialog";
import {
  getInsufficientBalanceMessage,
  isInsufficientBalanceError,
} from "../../lib/insufficientBalance";

const OWNER_CANCELABLE_STATUSES = new Set<EventStatus>([
  "draft",
  "funding",
  "funded",
  "ticketing",
]);

function formatWei(value?: string | number) {
  try {
    return BigInt(String(value || "0")).toLocaleString();
  } catch {
    return "0";
  }
}

function buildTicketQrPayload(ticket: ApiTicket, eventId: string) {
  return `eft1:${String(ticket.tokenId).trim()}:${eventId.trim()}`;
}

function getTicketQrCanvasId(ticket: ApiTicket) {
  const rawId = String(ticket._id || ticket.tokenId || "unknown");
  return `managed-ticket-qr-${rawId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function downloadTicketQR(ticket: ApiTicket) {
  const canvas = document.getElementById(
    getTicketQrCanvasId(ticket),
  ) as HTMLCanvasElement | null;
  if (!canvas) return;

  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = `ticket-${ticket.tokenId}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getTicketStatusBadgeVariant(status?: ApiTicket["status"]) {
  switch (status) {
    case "sold":
      return "default";
    case "used":
      return "secondary";
    case "minted":
      return "outline";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function getTicketHolderLabel(ticket: ApiTicket) {
  if (ticket.status === "minted") {
    return "Organizer inventory";
  }

  return ticket.currentOwner || "Unknown";
}

export const MyEvents: React.FC = () => {
  const navigate = useNavigate();
  const { user, connectWallet } = useAuth() as any;
  const { web3Auth } = useWeb3Auth();
  const { show: showLoading, hide: hideLoading } = useLoading();
  const isVerifierView = Boolean(
    user?.role === "verifier" || user?.role === "admin",
  );

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  const [ticketDialogEvent, setTicketDialogEvent] = useState<EventItem | null>(
    null,
  );
  const [selectedQrTicket, setSelectedQrTicket] = useState<ApiTicket | null>(
    null,
  );
  const [eventTickets, setEventTickets] = useState<ApiTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const [insufficientBalanceMessage, setInsufficientBalanceMessage] =
    useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user?.walletAddress) {
        setEvents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = isVerifierView
          ? await getManagedEvents(user.walletAddress)
          : await getMyEvents(user.walletAddress);
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [isVerifierView, user?.walletAddress]);

  const handleDelete = async (event: EventItem) => {
    const eventId = event._id || event.id;
    if (!eventId) return;

    const ok = window.confirm(
      `Delete "${event.title || "Untitled event"}"?\n\nOnly draft events should be deleted because the backend currently limits deletion to draft records.`,
    );
    if (!ok) return;

    try {
      setDeletingId(eventId);
      showLoading("Deleting event...");
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => (e._id || e.id) !== eventId));
    } catch (err: any) {
      alert(
        err?.response?.data?.message || err?.message || "Failed to delete event",
      );
    } finally {
      setDeletingId("");
      hideLoading();
    }
  };

  const handleCancel = async (event: EventItem) => {
    const eventId = event._id || event.id;
    if (!eventId) return;

    const ok = window.confirm(
      `Are you sure you want to cancel the event "${event.title || "Untitled event"}"?\n\nThe event will be moved to the cancelled state according to the backend flow.`,
    );
    if (!ok) return;

    try {
      setCancellingId(eventId);

      if (!web3Auth?.provider) {
        await connectWallet();
        alert(
          "Wallet connected. Please press Cancel Event again to sign the cancellation transaction with the organizer wallet.",
        );
        return;
      }

      const updated = await cancelEventWithWalletFallback(
        resolveTransactionProvider(web3Auth?.provider),
        eventId,
        { status: "cancelled" },
        user?.walletAddress,
        user?.smartAccountAddress,
      );

      if (!updated) {
        throw new Error("Unable to cancel the event");
      }

      setEvents((prev) =>
        prev.map((item) =>
          (item._id || item.id) === eventId ? updated : item,
        ),
      );
    } catch (err: any) {
      if (isInsufficientBalanceError(err)) {
        setInsufficientBalanceMessage(getInsufficientBalanceMessage(err));
      }
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to cancel event",
      );
    } finally {
      setCancellingId("");
      hideLoading();
    }
  };

  const openTicketDialog = async (event: EventItem) => {
    const eventId = event._id || event.id;
    if (!eventId) return;

    setTicketDialogEvent(event);
    setSelectedQrTicket(null);
    setEventTickets([]);
    setTicketsError("");
    setTicketsLoading(true);

    try {
      const payload = await getTickets({
        eventId,
        page: 1,
        limit: 100,
        sort: "-createdAt",
      });
      setEventTickets(payload.docs || []);
      setSelectedQrTicket((payload.docs || [])[0] || null);
    } catch (err) {
      setTicketsError(
        err instanceof Error ? err.message : "Failed to load event tickets",
      );
    } finally {
      setTicketsLoading(false);
    }
  };

  const stats = useMemo(
    () => [
      {
        label: isVerifierView ? "Managed Events" : "Total Events",
        value: events.length.toString(),
      },
      {
        label: "Ongoing",
        value: events
          .filter((event) => event.status === "ongoing")
          .length.toString(),
      },
      {
        label: "Total Tickets Sold",
        value: events
          .reduce((sum, event) => sum + (event.ticketsSold || 0), 0)
          .toString(),
      },
      {
        label: isVerifierView ? "Used Tickets" : "Funding Raised",
        value: isVerifierView
          ? events
              .reduce((sum, event) => sum + (event.totalTicketsUsed || 0), 0)
              .toString()
          : events
              .reduce(
                (sum, event) => sum + Number(event.currentFunding || 0),
                0,
              )
              .toString(),
      },
    ],
    [events, isVerifierView],
  );

  if (loading) {
    return (
      <div className="text-white">
        {isVerifierView
          ? "Loading managed events..."
          : "Loading your events..."}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <InsufficientBalanceDialog
        open={!!insufficientBalanceMessage}
        message={insufficientBalanceMessage}
        onClose={() => setInsufficientBalanceMessage("")}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
            {isVerifierView ? "Managed Events" : "My Events"}
          </h1>
          <p className="text-slate-400">
            {isVerifierView
              ? "Events where you are assigned as verifier"
              : "Events you've created and organized"}
          </p>
        </div>

        {!isVerifierView && (
          <Button
            className="bg-gradient-to-r from-cyan-600 to-emerald-600 text-white hover:from-cyan-500 hover:to-emerald-500"
            asChild
          >
            <Link to="/app/events/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="border-slate-800 bg-slate-900/90 transition-colors hover:border-cyan-400/40"
          >
            <CardContent className="p-6">
              <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
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
                className="border-slate-800 bg-slate-900/90 transition-colors hover:border-cyan-400/40"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center space-x-3">
                        <h3 className="text-xl font-semibold text-white">
                          {event.title || "Untitled event"}
                        </h3>
                        <StatusBadge
                          status={(event.status as never) || "draft"}
                        />
                      </div>
                      <p className="text-slate-400">
                        {event.description || "No description"}
                      </p>
                    </div>

                    {!isVerifierView && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-slate-700 text-slate-200 hover:bg-slate-800"
                          onClick={() =>
                            navigate(`/app/events/edit/${eventId}`)
                          }
                          disabled={!eventId}
                          title="Edit event"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className="border-red-600 text-red-400 hover:bg-red-900/20 disabled:opacity-50"
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
                          <Ban className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className="border-red-600 text-red-400 hover:bg-red-900/20 disabled:opacity-50"
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
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 grid gap-4 md:grid-cols-3">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Calendar className="h-4 w-4" />
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
                      <MapPin className="h-4 w-4" />
                      <span>{event.venue?.address || "Unknown location"}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400">
                      <Users className="h-4 w-4" />
                      <span>{totalTickets} tickets available</span>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                        <Ticket className="h-3.5 w-3.5 text-cyan-300" />
                        Tickets sold
                      </div>
                      <p className="text-lg font-semibold text-white">
                        {event.ticketsSold || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                        <CircleDollarSign className="h-3.5 w-3.5 text-emerald-300" />
                        {isVerifierView ? "Checked in" : "Funding raised"}
                      </div>
                      <p className="text-lg font-semibold text-white">
                        {isVerifierView
                          ? event.totalTicketsUsed || 0
                          : `${formatWei(event.currentFunding)} wei`}
                      </p>
                    </div>
                  </div>

                  {(event.ticketTiers || []).length > 0 && (
                    <div className="grid gap-4 border-t border-slate-800 pt-4 md:grid-cols-3">
                      {event.ticketTiers.map((tier, index) => (
                        <div
                          key={`${eventId}-tier-${index}`}
                          className="rounded-lg bg-slate-800/50 p-3"
                        >
                          <p className="mb-1 text-sm text-slate-400">
                            {tier.name}
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {tier.price} wei
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {tier.totalSupply || 0} available
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                    <div className="text-sm text-slate-500">
                      Created:{" "}
                      {event.createdAt
                        ? new Date(event.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-slate-700 text-white hover:bg-slate-800"
                        onClick={() => openTicketDialog(event)}
                        disabled={!eventId}
                      >
                        <QrCode className="mr-1 h-4 w-4" />
                        Ticket QR
                      </Button>

                      <Button
                        variant="outline"
                        className="border-slate-700 text-white hover:bg-slate-800"
                        asChild
                      >
                        <Link
                          to={
                            isVerifierView
                              ? "/app/verifier/dashboard"
                              : `/events/${eventId}`
                          }
                        >
                          <ArrowUpRight className="mr-1 h-4 w-4" />
                          {isVerifierView ? "Open Check-In" : "View Dashboard"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-12 text-center">
              <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-700" />
              <h3 className="mb-2 text-xl font-semibold text-white">
                {isVerifierView ? "No managed events yet" : "No events yet"}
              </h3>
              <p className="mb-6 text-slate-400">
                {isVerifierView
                  ? "You have not been assigned to any event yet."
                  : "Create your first event to get started"}
              </p>
              {!isVerifierView && (
                <Button
                  className="bg-gradient-to-r from-cyan-600 to-emerald-600 text-white hover:from-cyan-500 hover:to-emerald-500"
                  asChild
                >
                  <Link to="/app/events/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Event
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={!!ticketDialogEvent}
        onOpenChange={(open) => {
          if (!open) {
            setTicketDialogEvent(null);
            setSelectedQrTicket(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>
              Ticket QR - {ticketDialogEvent?.title || "Selected Event"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Select an event ticket to view QR and test verifier scan flow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              {ticketsLoading ? (
                <div className="py-10 text-center text-slate-400">
                  Loading tickets...
                </div>
              ) : ticketsError ? (
                <div className="py-10 text-center text-red-400">
                  {ticketsError}
                </div>
              ) : eventTickets.length > 0 ? (
                <div className="space-y-3">
                  {eventTickets.map((ticket) => (
                    <button
                      key={ticket._id || ticket.tokenId}
                      type="button"
                      onClick={() => setSelectedQrTicket(ticket)}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                        selectedQrTicket?.tokenId === ticket.tokenId
                          ? "border-cyan-400/50 bg-cyan-500/10"
                          : "border-slate-800 bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            #{ticket.tokenId}
                          </span>
                          <Badge
                            variant={getTicketStatusBadgeVariant(ticket.status)}
                            className="uppercase"
                          >
                            {ticket.status || "unknown"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          Holder: {getTicketHolderLabel(ticket)}
                        </p>
                        <p className="text-sm text-slate-500">
                          Price: {formatWei(ticket.originalPrice)} wei
                        </p>
                      </div>
                      <Eye className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400">
                  This event does not have tickets to create QR.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              {selectedQrTicket && ticketDialogEvent?._id ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      Ticket #{selectedQrTicket.tokenId}
                    </h4>
                    <p className="text-sm text-slate-400">
                      Holder: {getTicketHolderLabel(selectedQrTicket)}
                    </p>
                  </div>

                  <div className="flex justify-center rounded-xl bg-white p-4">
                    <QRCodeCanvas
                      id={getTicketQrCanvasId(selectedQrTicket)}
                      value={buildTicketQrPayload(
                        selectedQrTicket,
                        ticketDialogEvent._id,
                      )}
                      size={280}
                      level="L"
                      bgColor="#ffffff"
                      fgColor="#111111"
                      includeMargin
                    />
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
                    {buildTicketQrPayload(
                      selectedQrTicket,
                      ticketDialogEvent._id,
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => downloadTicketQR(selectedQrTicket)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400">
                  Select a ticket on the left to view QR.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
