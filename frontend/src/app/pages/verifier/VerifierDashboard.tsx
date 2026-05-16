import React, { useCallback, useEffect, useMemo, useState } from "react";
import QrReader from "react-qr-scanner";
import { useWeb3Auth } from "@web3auth/modal/react";
import { resolveTransactionProvider } from "../../services/providerService";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  QrCode,
  Ticket,
  Users,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useLoading } from "../../components/ui/loadingContext";
import {
  getTicketByTokenId,
  getTickets,
  markTicketAsUsed,
  type ApiTicket,
  verifyTicket,
  useTicketOnChain,
} from "../../services/tickets.service";

interface ApiEventItem {
  _id: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  contractEventId?: string;
  verifiers?: string[];
  venue?: {
    address?: string;
  };
  totalTickets?: number;
}

interface ApiEventsResponse {
  success: boolean;
  data?: {
    docs?: ApiEventItem[];
  };
}

interface EventStatsResponse {
  success: boolean;
  data?: {
    totalTickets?: number;
    soldTickets?: number;
    usedTickets?: number;
    mintedTickets?: number;
    availableTickets?: number;
  };
}

interface CheckInRecord {
  id: string;
  ticketId: string;
  attendeeName: string;
  attendeeWallet: string;
  timestamp: string;
  status: "valid" | "invalid" | "duplicate";
}

interface EventStats {
  totalTickets: number;
  soldTickets: number;
  usedTickets: number;
}

interface TicketQrPayload {
  tokenId: string;
  walletAddress?: string;
  eventId?: string;
}

type ScanResult = string | { text?: string | null } | null;

const EMPTY_STATS: EventStats = {
  totalTickets: 0,
  soldTickets: 0,
  usedTickets: 0,
};

function shortenWallet(wallet?: string): string {
  if (!wallet) return "Unknown";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

function resolveTicketEventId(
  ticket: ApiTicket | null | undefined,
): string | null {
  if (!ticket) return null;
  if (ticket.eventIdRaw) return ticket.eventIdRaw;
  if (typeof ticket.eventId === "string") return ticket.eventId;
  if (typeof ticket.eventId === "object" && ticket.eventId?._id) {
    return ticket.eventId._id;
  }
  return null;
}

function parseTicketQrPayload(rawValue: string): TicketQrPayload {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { tokenId: "" };
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (parsed && typeof parsed === "object" && typeof parsed.tokenId === "string") {
      return {
        tokenId: parsed.tokenId.trim(),
        walletAddress:
          typeof parsed.walletAddress === "string"
            ? parsed.walletAddress.trim()
            : undefined,
        eventId:
          typeof parsed.eventId === "string" ? parsed.eventId.trim() : undefined,
      };
    }
  } catch {
    // Fallback for legacy QR formats.
  }

  const compactParts = trimmed.split(":");
  if (compactParts[0]?.toLowerCase() === "eft1" && compactParts.length >= 3) {
    return {
      tokenId: decodeURIComponent(compactParts[1] || "").trim(),
      eventId: decodeURIComponent(compactParts[2] || "").trim() || undefined,
      walletAddress:
        compactParts.length >= 4
          ? decodeURIComponent(compactParts.slice(3).join(":") || "").trim() || undefined
          : undefined,
    };
  }

  const legacyMatch = trimmed.match(/\/tickets\/verify\/([^/?#]+)/i);
  if (legacyMatch?.[1]) {
    return { tokenId: decodeURIComponent(legacyMatch[1]) };
  }

  return { tokenId: trimmed };
}

function getEventCheckInState(event?: ApiEventItem | null): {
  ready: boolean;
  label: string;
} {
  if (!event) {
    return { ready: false, label: "Select an event to start check-in" };
  }

  if (event.status !== "ongoing") {
    return {
      ready: false,
      label: `Check-in opens when the event status becomes ongoing. Current status: ${event.status || "unknown"}.`,
    };
  }

  const now = Date.now();
  const startTime = event.startDate ? new Date(event.startDate).getTime() : null;
  const endTime = event.endDate ? new Date(event.endDate).getTime() : null;

  if (startTime && Number.isFinite(startTime) && now < startTime) {
    return {
      ready: false,
      label: "This event has not started yet.",
    };
  }

  if (endTime && Number.isFinite(endTime) && now > endTime) {
    return {
      ready: false,
      label: "This event has already ended.",
    };
  }

  return {
    ready: true,
    label: "Check-in is open for this event.",
  };
}

export const VerifierDashboard: React.FC = () => {
  const { user } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [showScanner, setShowScanner] = useState(false);
  const [manualTicketId, setManualTicketId] = useState("");
  const [events, setEvents] = useState<ApiEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingCheckIns, setIsLoadingCheckIns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState<EventStats>(EMPTY_STATS);
  const [usedCheckIns, setUsedCheckIns] = useState<CheckInRecord[]>([]);
  const [manualRecords, setManualRecords] = useState<CheckInRecord[]>([]);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent],
  );

  const eventCheckInState = useMemo(
    () => getEventCheckInState(selectedEventData),
    [selectedEventData],
  );

  const checkInRecords = useMemo(() => {
    const byKey = new Map<string, CheckInRecord>();

    [...manualRecords, ...usedCheckIns].forEach((record) => {
      if (!byKey.has(record.id)) {
        byKey.set(record.id, record);
      }
    });

    return Array.from(byKey.values()).sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [manualRecords, usedCheckIns]);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      setPageError(null);

      try {
        const payload = await api.get<ApiEventsResponse>(
          "/events?limit=100&sortBy=startDate&sortOrder=asc",
        );
        const docs = payload.data?.docs || [];
        const normalizedWallet = user?.walletAddress?.toLowerCase() || "";
        const isAdmin = user?.role === "admin";

        const filteredDocs = isAdmin
          ? docs
          : docs.filter((event) =>
              Array.isArray(event.verifiers)
                ? event.verifiers.some(
                    (wallet) => wallet?.toLowerCase() === normalizedWallet,
                  )
                : false,
            );
        setEvents(filteredDocs);

        if (!selectedEvent && filteredDocs.length > 0) {
          setSelectedEvent(filteredDocs[0]._id);
        } else if (
          selectedEvent &&
          !filteredDocs.some((event) => event._id === selectedEvent)
        ) {
          setSelectedEvent(filteredDocs[0]?._id || "");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load events";
        setPageError(message);
        setEvents([]);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [selectedEvent, user?.role, user?.walletAddress]);

  const loadSelectedEventData = useCallback(async (eventId: string) => {
    if (!eventId) {
      setEventStats(EMPTY_STATS);
      setUsedCheckIns([]);
      return;
    }

    setIsLoadingCheckIns(true);
    setActionError(null);

    try {
      const [statsPayload, usedTicketsPayload] = await Promise.all([
        api.get<EventStatsResponse>(`/tickets/event/${eventId}/stats`),
        getTickets({ eventId, status: "used", page: 1, limit: 100, sort: "-usedAt" }),
      ]);

      setEventStats({
        totalTickets: statsPayload.data?.totalTickets || 0,
        soldTickets: statsPayload.data?.soldTickets || 0,
        usedTickets: statsPayload.data?.usedTickets || 0,
      });

      setUsedCheckIns(
        usedTicketsPayload.docs.map((ticket) => ({
          id: `used-${ticket.tokenId}-${ticket.usedAt || ticket.createdAt || ""}`,
          ticketId: ticket.tokenId,
          attendeeName: "Wallet Holder",
          attendeeWallet: shortenWallet(ticket.currentOwner),
          timestamp:
            ticket.usedAt || ticket.createdAt || new Date().toISOString(),
          status: "valid",
        })),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load event tickets";
      setActionError(message);
      setEventStats(EMPTY_STATS);
      setUsedCheckIns([]);
    } finally {
      setIsLoadingCheckIns(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedEvent) {
      setManualRecords([]);
      setUsedCheckIns([]);
      setEventStats(EMPTY_STATS);
      return;
    }

    setManualRecords([]);
    loadSelectedEventData(selectedEvent);
  }, [selectedEvent, loadSelectedEventData]);

  const createManualRecord = useCallback(
    (
      ticketId: string,
      status: CheckInRecord["status"],
      wallet = "Unknown",
    ): CheckInRecord => ({
      id: `manual-${Date.now()}-${ticketId}`,
      ticketId,
      attendeeName: status === "valid" ? "Verified Attendee" : "Manual Entry",
      attendeeWallet: shortenWallet(wallet),
      timestamp: new Date().toISOString(),
      status,
    }),
    [],
  );

  const stats = [
    {
      title: "Checked In",
      value: eventStats.usedTickets.toString(),
      icon: Users,
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-400",
    },
    {
      title: "Remaining Valid",
      value: Math.max(
        eventStats.soldTickets - eventStats.usedTickets,
        0,
      ).toString(),
      icon: CheckCircle,
      bgColor: "bg-green-500/10",
      textColor: "text-green-400",
    },
    {
      title: "Session Duplicates",
      value: manualRecords
        .filter((record) => record.status === "duplicate")
        .length.toString(),
      icon: AlertCircle,
      bgColor: "bg-yellow-500/10",
      textColor: "text-yellow-400",
    },
    {
      title: "Session Invalid",
      value: manualRecords
        .filter((record) => record.status === "invalid")
        .length.toString(),
      icon: XCircle,
      bgColor: "bg-red-500/10",
      textColor: "text-red-400",
    },
  ];

  const { show: showLoading, hide: hideLoading } = useLoading();

  const checkInByTokenId = useCallback(
    async (
      tokenId: string,
      walletAddressFromQr?: string,
      eventIdFromQr?: string,
    ) => {
      const normalizedTokenId = tokenId.trim();

      if (!normalizedTokenId || !selectedEvent) {
        return;
      }

      if (!eventCheckInState.ready) {
        setActionError(eventCheckInState.label);
        return;
      }

      setIsSubmitting(true);
      setActionError(null);
      showLoading("Processing scan...");

      try {
        if (eventIdFromQr && eventIdFromQr !== selectedEvent) {
          setManualRecords((prev) => [
            createManualRecord(normalizedTokenId, "invalid"),
            ...prev,
          ]);
          return;
        }

        const ticket = await getTicketByTokenId(normalizedTokenId);

        if (!ticket) {
          setManualRecords((prev) => [
            createManualRecord(normalizedTokenId, "invalid"),
            ...prev,
          ]);
          return;
        }

        const ticketEventId = resolveTicketEventId(ticket);
        if (!ticketEventId || ticketEventId !== selectedEvent) {
          setManualRecords((prev) => [
            createManualRecord(
              normalizedTokenId,
              "invalid",
              ticket.currentOwner,
            ),
            ...prev,
          ]);
          return;
        }

        if (ticket.status === "used") {
          setManualRecords((prev) => [
            createManualRecord(
              normalizedTokenId,
              "duplicate",
              ticket.currentOwner,
            ),
            ...prev,
          ]);
          return;
        }

        const verification = await verifyTicket({
          tokenId: normalizedTokenId,
          eventId: selectedEvent,
          walletAddress: walletAddressFromQr?.trim() || undefined,
        });

        if (!verification?.isOwner) {
          setManualRecords((prev) => [
            createManualRecord(
              normalizedTokenId,
              "invalid",
              ticket.currentOwner,
            ),
            ...prev,
          ]);
          return;
        }

        try {
          if (selectedEventData?.contractEventId) {
            const provider = resolveTransactionProvider(web3Auth?.provider);
            if (!provider) {
              throw new Error(
                "Wallet provider is not ready. Please reconnect wallet and try again.",
              );
            }

            const result = await useTicketOnChain(
              provider as any,
              normalizedTokenId,
              user?.walletAddress,
            );

            if (result?.confirmation?.synced || result?.confirmation?.alreadySynced) {
              await loadSelectedEventData(selectedEvent);
            } else {
              throw new Error(
                "On-chain check-in transaction was sent but confirmation did not sync.",
              );
            }
          } else {
            const updatedTicket = await markTicketAsUsed(normalizedTokenId);
            if (!updatedTicket) {
              throw new Error("Off-chain check-in did not return updated ticket data.");
            }

            await loadSelectedEventData(selectedEvent);
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Check-in failed";
          setActionError(message);
          setManualRecords((prev) => [
            createManualRecord(normalizedTokenId, "invalid", ticket.currentOwner),
            ...prev,
          ]);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to verify ticket";
        setActionError(message);
        setManualRecords((prev) => [
          createManualRecord(normalizedTokenId, "invalid"),
          ...prev,
        ]);
      } finally {
        hideLoading();
        setIsSubmitting(false);
      }
    },
    [
      createManualRecord,
      eventCheckInState,
      loadSelectedEventData,
      selectedEvent,
      selectedEventData?.contractEventId,
      user?.walletAddress,
      web3Auth?.provider,
    ],
  );

  const handleScanTicket = () => {
    setScannerError(null);
    setLastScannedValue(null);
    setShowScanner(true);
  };

  const handleManualCheckIn = async () => {
    if (!manualTicketId.trim()) return;
    await checkInByTokenId(manualTicketId);
    setManualTicketId("");
  };

  const handleQRScan = useCallback(
    async (data: ScanResult) => {
      const rawValue =
        typeof data === "string"
          ? data
          : typeof data?.text === "string"
            ? data.text
            : null;

      if (!rawValue || isSubmitting) return;

      const trimmedData = rawValue.trim();
      if (!trimmedData || trimmedData === lastScannedValue) {
        return;
      }

      setLastScannedValue(trimmedData);

      const payload = parseTicketQrPayload(trimmedData);
      if (!payload.tokenId) {
        setScannerError("QR code does not contain a valid ticket ID");
        return;
      }

      setShowScanner(false);
      await checkInByTokenId(
        payload.tokenId,
        payload.walletAddress,
        payload.eventId,
      );
    },
    [checkInByTokenId, isSubmitting, lastScannedValue],
  );

  const handleScannerError = useCallback((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unable to access camera";
    setScannerError(message);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Event Check-In</h1>
          <p className="text-slate-400">
            Scan NFT tickets and manage event entry
          </p>
        </div>
      </div>

      {pageError && (
        <Card className="border-red-800 bg-slate-900">
          <CardContent className="p-4 text-red-300">{pageError}</CardContent>
        </Card>
      )}

      {actionError && (
        <Card className="border-yellow-800 bg-slate-900">
          <CardContent className="p-4 text-yellow-300">{actionError}</CardContent>
        </Card>
      )}

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Select Event</CardTitle>
          <CardDescription className="text-slate-400">
            Choose the event you're managing check-in for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="flex-1 border-slate-700 bg-slate-800 text-white">
                <SelectValue
                  placeholder={
                    isLoadingEvents ? "Loading events..." : "Select an event..."
                  }
                />
              </SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-800">
                {events.map((event) => (
                  <SelectItem
                    key={event._id}
                    value={event._id}
                    className="text-white hover:bg-slate-700"
                  >
                    {event.title || `Event ${event._id.slice(0, 8)}`}
                    {event.startDate
                      ? ` - ${new Date(event.startDate).toLocaleDateString()}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEventData && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>
                  {selectedEventData.startDate
                    ? new Date(selectedEventData.startDate).toLocaleDateString()
                    : "TBA"}
                </span>
                <span className="mx-2">&bull;</span>
                <Ticket className="h-4 w-4" />
                <span>{eventStats.soldTickets} sold</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title} className="border-slate-800 bg-slate-900">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="mb-1 text-sm text-slate-400">{stat.title}</p>
                      <p className="text-3xl font-bold text-white">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bgColor}`}
                    >
                      <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="text-white">Ticket Scanner</CardTitle>
                <CardDescription className="text-slate-400">
                  Scan QR codes for assigned events and process check-in automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleScanTicket}
                  className="h-32 w-full text-lg"
                  disabled={!selectedEvent || isSubmitting || !eventCheckInState.ready}
                >
                  <QrCode className="mr-3 h-8 w-8" />
                  {isSubmitting ? "Processing..." : "Scan QR Code"}
                </Button>


                {!eventCheckInState.ready && (
                  <div className="rounded-lg border border-yellow-700 bg-yellow-500/10 p-3 text-sm text-yellow-300">
                    {eventCheckInState.label}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
              <CardHeader>
                <CardTitle className="text-white">Event Information</CardTitle>
                <CardDescription className="text-slate-400">
                  Current event details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className="font-medium capitalize text-white">
                      {selectedEventData?.status || "unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Event Name</span>
                    <span className="font-medium text-white">
                      {selectedEventData?.title || "Unknown Event"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Date</span>
                    <span className="font-medium text-white">
                      {selectedEventData?.startDate
                        ? new Date(
                            selectedEventData.startDate,
                          ).toLocaleDateString()
                        : "TBA"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location</span>
                    <span className="font-medium text-white">
                      {selectedEventData?.venue?.address || "TBA"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Capacity</span>
                    <span className="font-medium text-white">
                      {selectedEventData?.totalTickets ||
                        eventStats.totalTickets ||
                        "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Sold Tickets</span>
                    <span className="font-medium text-white">
                      {eventStats.soldTickets}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Check-In Rate</span>
                    <span className="font-medium text-green-400">
                      {(selectedEventData?.totalTickets ||
                        eventStats.totalTickets) > 0
                        ? `${Math.round(
                            (eventStats.usedTickets /
                              Number(
                                selectedEventData?.totalTickets ||
                                  eventStats.totalTickets,
                              )) *
                              100,
                          )}%`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Recent Check-Ins</CardTitle>
              <CardDescription className="text-slate-400">
                Latest ticket validations for this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoadingCheckIns ? (
                  <div className="py-8 text-center text-slate-400">
                    Loading check-in data...
                  </div>
                ) : checkInRecords.length > 0 ? (
                  checkInRecords.slice(0, 10).map((record) => (
                    <div
                      key={record.id}
                      className={`rounded-lg border p-4 transition-all ${
                        record.status === "valid"
                          ? "border-green-500/30 bg-green-500/5"
                          : record.status === "duplicate"
                            ? "border-yellow-500/30 bg-yellow-500/5"
                            : "border-red-500/30 bg-red-500/5"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              record.status === "valid"
                                ? "bg-green-500/20"
                                : record.status === "duplicate"
                                  ? "bg-yellow-500/20"
                                  : "bg-red-500/20"
                            }`}
                          >
                            {record.status === "valid" ? (
                              <CheckCircle className="h-5 w-5 text-green-400" />
                            ) : record.status === "duplicate" ? (
                              <AlertCircle className="h-5 w-5 text-yellow-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-white">
                              {record.attendeeName}
                            </h4>
                            <p className="text-sm text-slate-400">
                              {record.ticketId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              record.status === "valid"
                                ? "text-green-400"
                                : record.status === "duplicate"
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }`}
                          >
                            {record.status === "valid"
                              ? "Valid"
                              : record.status === "duplicate"
                                ? "Already Used"
                                : "Invalid"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Wallet: {record.attendeeWallet}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <Clock className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                    <p className="text-slate-400">No check-ins yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Start scanning tickets to see them here
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedEvent && (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-12 text-center">
            <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-600" />
            <h3 className="mb-2 text-xl font-bold text-white">
              {events.length > 0 ? "Select an Event" : "No Managed Event Yet"}
            </h3>
            <p className="mx-auto max-w-md text-slate-400">
              {events.length > 0
                ? "Choose an assigned event from the dropdown above to start managing check-ins and scanning tickets"
                : "This account has no event assignment yet, so there is nothing to scan right now."}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md border-slate-700 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Scan QR Code</DialogTitle>
            <DialogDescription className="text-slate-400">
              Point the camera at the attendee&apos;s ticket QR code
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
              {showScanner && !isSubmitting ? (
                <QrReader
                  delay={150}
                  facingMode="rear"
                  onError={handleScannerError}
                  onScan={handleQRScan}
                  style={{ width: "100%", minHeight: 320, objectFit: "cover" }}
                />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">
                  {isSubmitting ? "Processing scan..." : "Scanner closed"}
                </div>
              )}
            </div>

            {scannerError && (
              <div className="rounded-lg border border-yellow-700 bg-yellow-500/10 p-3 text-sm text-yellow-300">
                {scannerError}
              </div>
            )}

            <p className="text-sm text-slate-500">
              If the camera cannot read the code, you can close this window and manually enter
              `tokenId` below.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
