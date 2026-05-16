import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Calendar,
  CircleDollarSign,
  Clock,
  Gauge,
  MapPin,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusBadge } from "../../components/StatusBadge";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { useAuth } from "../../contexts/AuthContext";
import { getEventById, type EventItem } from "../../services/events.service";
import {
  investInEventOnChain,
} from "../../services/investment.service";
import {
  getTicketStats,
  getTickets,
  purchaseTicket,
  type ApiTicket,
  type EventTicketStats,
} from "../../services/tickets.service";
import { useWeb3Auth } from "@web3auth/modal/react";
import { resolveTransactionProvider } from "../../services/providerService";
import { calculatePercentage, formatIntegerWithUnit } from "../../lib/utils";
import { InsufficientBalanceDialog } from "../../components/shared/InsufficientBalanceDialog";
import {
  getInsufficientBalanceMessage,
  isInsufficientBalanceError,
} from "../../lib/insufficientBalance";

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connectWallet, user } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState("1");
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState("");
  const [investSuccess, setInvestSuccess] = useState("");
  const [buying, setBuying] = useState(false);
  const [buyPopup, setBuyPopup] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [ticketStats, setTicketStats] = useState<EventTicketStats | null>(null);
  const [eventTickets, setEventTickets] = useState<ApiTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [purchaseConfirmTier, setPurchaseConfirmTier] = useState<string | null>(
    null,
  );
  const [insufficientBalanceMessage, setInsufficientBalanceMessage] =
    useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (!buyPopup) return;

    const timeoutId = window.setTimeout(() => {
      setBuyPopup(null);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [buyPopup]);

  const showBuyPopup = (type: "success" | "error", message: string) => {
    setBuyPopup({ type, message });
  };

  const loadTicketData = async (targetEventId: string) => {
    setLoadingTickets(true);
    try {
      const [stats, tickets] = await Promise.all([
        getTicketStats(targetEventId),
        getTickets({
          eventId: targetEventId,
          page: 1,
          limit: 50,
          sort: "-createdAt",
        }),
      ]);

      setTicketStats(stats);
      setEventTickets(tickets.docs || []);
    } catch {
      setTicketStats(null);
      setEventTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError("");
        const data = await getEventById(id);
        setEvent(data);
        if (data?._id && (data.status === "ticketing" || data.status === "ongoing")) {
          await loadTicketData(data._id);
        } else {
          setTicketStats(null);
          setEventTickets([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [event?._id]);

  const totalTickets = useMemo(() => {
    if (typeof event?.totalTickets === "number") return event.totalTickets;
    return (event?.ticketTiers || []).reduce(
      (sum, tier) => sum + (tier.totalSupply || 0),
      0,
    );
  }, [event]);

  const eventId = event?._id || event?.id || "";
  const availableTickets = ticketStats?.availableTickets ?? null;
  const trackedTickets = ticketStats?.totalTickets ?? totalTickets;
  const ticketingOpen = event?.status === "ticketing" || event?.status === "ongoing";
  const fundingProgress = Math.min(
    calculatePercentage(event?.currentFunding, event?.fundingGoal, 1),
    100,
  );
  const investmentMode =
    event?.investmentEnabled === false ? "Self-funded" : "Investment-enabled";
  const isInvestable =
    event?.status === "funding" && String(event?.fundingGoal || "0") !== "0";
  const isTicketPurchasable =
    event?.status === "ticketing" || event?.status === "ongoing";
  const minInvestmentAmount = String(event?.minInvestmentAmount || "0");

  const coverImage = event?.imageUrls?.[0] || "";
  const galleryImages = useMemo(() => {
    const images = event?.imageUrls?.filter(Boolean) || [];
    return images.length > 0 ? images : coverImage ? [coverImage] : [];
  }, [event?.imageUrls, coverImage]);
  const selectedGalleryImage =
    galleryImages[selectedImageIndex] || galleryImages[0] || "";
  const eventDate = event?.startDate ? new Date(event.startDate) : null;
  const eventEndDate = event?.endDate ? new Date(event.endDate) : null;
  const ticketingStartDate = event?.ticketingStartAt
    ? new Date(event.ticketingStartAt)
    : null;
  const ticketingEndDate = event?.ticketingEndAt
    ? new Date(event.ticketingEndAt)
    : null;
  const fundingDeadline = event?.fundingDeadline
    ? new Date(event.fundingDeadline)
    : null;

  const quickAmounts = [
    "10000000000000000",
    "50000000000000000",
    "100000000000000000",
  ];

  const formatDate = (value: Date | null) => {
    if (!value) return "No date";
    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (value: Date | null) => {
    if (!value) return "No time";
    return value.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTicketHolderLabel = (ticket: ApiTicket) => {
    if (ticket.status === "minted") {
      return "Organizer inventory";
    }

    return ticket.currentOwner || "-";
  };

  const handleShowPreviousImage = () => {
    if (galleryImages.length <= 1) return;
    setSelectedImageIndex((current) =>
      current === 0 ? galleryImages.length - 1 : current - 1,
    );
  };

  const handleShowNextImage = () => {
    if (galleryImages.length <= 1) return;
    setSelectedImageIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1,
    );
  };

  const handleInvest = async () => {
    if (!user?.walletAddress && !user?.smartAccountAddress) {
      await connectWallet();
      return;
    }

    if (!eventId) return;
    if (
      !/^[0-9]+$/.test(investmentAmount.trim()) ||
      investmentAmount.trim() === "0"
    ) {
      setInvestError("Contribution amount must be a positive integer string.");
      return;
    }

    if (
      /^[0-9]+$/.test(minInvestmentAmount) &&
      minInvestmentAmount !== "0" &&
      BigInt(investmentAmount.trim()) < BigInt(minInvestmentAmount)
    ) {
      setInvestError(
        `Contribution amount must be at least ${minInvestmentAmount} wei.`,
      );
      return;
    }

    setInvestError("");
    setInvestSuccess("");
    setInvesting(true);

    try {
      const provider = resolveTransactionProvider(web3Auth?.provider);
      if (!provider?.request) {
        throw new Error(
          "Wallet provider is not ready. Please reconnect wallet and try again.",
        );
      }

      const result = await investInEventOnChain(
        provider,
        eventId,
        investmentAmount.trim(),
        user.walletAddress || user.smartAccountAddress,
      );
      setInvestSuccess(`Investment successful`);
      const refreshedEvent = await getEventById(eventId);
      setEvent(refreshedEvent);
    } catch (err) {
      if (isInsufficientBalanceError(err)) {
        setInsufficientBalanceMessage(getInsufficientBalanceMessage(err));
      }
      setInvestError(err instanceof Error ? err.message : "Investment failed");
    } finally {
      setInvesting(false);
    }
  };

  const handlePurchaseTicket = async () => {
    if (!event?._id) return;

    if (!user?.walletAddress) {
      try {
        await connectWallet();
        showBuyPopup(
          "success",
          "Wallet connected. Please click Purchase Ticket again to continue.",
        );
      } catch (err) {
        showBuyPopup(
          "error",
          err instanceof Error ? err.message : "Failed to connect wallet",
        );
      }
      return;
    }

    const provider = resolveTransactionProvider(web3Auth?.provider);

    if (!provider?.request) {
      showBuyPopup(
        "error",
        "Wallet provider is not ready. Please reconnect wallet and try again.",
      );
      return;
    }

    setBuying(true);
    try {
      const result = await purchaseTicket(
        provider,
        { eventId: event._id },
        user.walletAddress,
      );
      showBuyPopup("success", "Ticket purchase successful");

      const refreshedEvent = await getEventById(event._id);
      setEvent(refreshedEvent);
      await loadTicketData(event._id);
    } catch (err) {
      if (isInsufficientBalanceError(err)) {
        setInsufficientBalanceMessage(getInsufficientBalanceMessage(err));
      }
      showBuyPopup(
        "error",
        err instanceof Error ? err.message : "Ticket purchase failed",
      );
    } finally {
      setBuying(false);
      setPurchaseConfirmTier(null);
    }
  };

  const handlePurchaseClick = async (tierName?: string) => {
    if (!isTicketPurchasable) {
      showBuyPopup(
        "error",
        "Ticket sales are not open for this event yet.",
      );
      return;
    }

    if (!user?.walletAddress) {
      try {
        await connectWallet();
        showBuyPopup(
          "success",
          "Wallet connected. Please click Purchase Ticket again to continue.",
        );
      } catch (err) {
        showBuyPopup(
          "error",
          err instanceof Error ? err.message : "Failed to connect wallet",
        );
      }
      return;
    }

    setPurchaseConfirmTier(tierName || "this ticket");
  };


  if (error) return <div className="p-8 text-red-400">{error}</div>;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 grid gap-8 xl:grid-cols-[1.2fr_1fr]">
            <div className="aspect-[16/10] sm:aspect-video animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
            <div className="grid gap-4">
              <div className="h-6 w-32 animate-pulse rounded bg-slate-800" />
              <div className="h-12 w-4/5 animate-pulse rounded bg-slate-800" />
              <div className="h-24 animate-pulse rounded-2xl bg-slate-900/70" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-20 animate-pulse rounded-xl bg-slate-900/70" />
                <div className="h-20 animate-pulse rounded-xl bg-slate-900/70" />
                <div className="h-20 animate-pulse rounded-xl bg-slate-900/70 sm:col-span-2" />
              </div>
            </div>
          </div>

          <div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        </div>
      </div>
    );
  }

  if (!event) return <div className="p-8 text-white">Event not found</div>;

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <InsufficientBalanceDialog
        open={!!insufficientBalanceMessage}
        message={insufficientBalanceMessage}
        onClose={() => setInsufficientBalanceMessage("")}
      />

      {buyPopup && (
        <div className="fixed top-4 right-4 z-[60]">
          <div
            className={`min-w-[260px] max-w-[360px] rounded-lg border px-4 py-3 text-sm shadow-lg ${
              buyPopup.type === "success"
                ? "bg-emerald-900/95 border-emerald-600 text-emerald-100"
                : "bg-red-900/95 border-red-600 text-red-100"
            }`}
          >
            {buyPopup.message}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <StatusBadge status={event.status || "draft"} />
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              {availableTickets ?? totalTickets} available / {trackedTickets} tracked
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              Investment Mode: {investmentMode}
            </span>
          </div>

          <h1 className="bg-gradient-to-r from-purple-400 via-blue-300 to-cyan-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            {event.description || "No event description available."}
          </p>
        </div>

        <div className="mb-6 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/60 shadow-2xl shadow-cyan-950/20">
          <div className="relative aspect-[16/9]">
            {galleryImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={handleShowPreviousImage}
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:border-cyan-400 hover:text-cyan-200"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={handleShowNextImage}
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:border-cyan-400 hover:text-cyan-200"
                >
                  Next
                </button>
              </>
            ) : null}

            <ImageWithFallback
              src={selectedGalleryImage}
              alt={event.title || "Event image"}
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-300">
                  Event Gallery
                </div>
                <div className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  {selectedImageIndex + 1} / {galleryImages.length}
                </div>
              </div>

              {galleryImages.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {galleryImages.map((imageUrl, index) => {
                    const active = index === selectedImageIndex;
                    return (
                      <button
                        key={`${imageUrl}-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`group relative h-14 w-20 flex-none overflow-hidden rounded-xl border transition-all duration-200 sm:h-16 sm:w-24 ${
                          active
                            ? "border-cyan-400 ring-2 ring-cyan-400/30"
                            : "border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        <ImageWithFallback
                          src={imageUrl}
                          alt={`${event.title || "Event"} gallery ${index + 1}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <div className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                          {index + 1}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                <Calendar className="h-4 w-4 text-cyan-300" />
                Schedule
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Event Date</div>
                  <div className="mt-2 text-lg font-semibold text-white">{formatDate(eventDate)}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatTime(eventDate)}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">End Time</div>
                  <div className="mt-2 text-lg font-semibold text-white">{formatDate(eventEndDate)}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatTime(eventEndDate)}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Ticketing Opens</div>
                  <div className="mt-2 text-lg font-semibold text-white">{formatDate(ticketingStartDate)}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatTime(ticketingStartDate)}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Ticketing Closes</div>
                  <div className="mt-2 text-lg font-semibold text-white">{formatDate(ticketingEndDate)}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatTime(ticketingEndDate)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                <MapPin className="h-4 w-4 text-emerald-300" />
                Venue & Organizer
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Venue</div>
                  <div className="text-base font-semibold text-white">
                    {event.venue?.address || "Unknown location"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <Users className="h-4 w-4 text-emerald-300" />
                    Organizer
                  </div>
                  <code className="text-xs break-all text-slate-200 sm:text-sm">
                    {event.organizer || event.organizerWallet || "Unknown organizer"}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {event?.investmentEnabled !== false ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-300" />
                  Funding progress
                </span>
                <span className="font-medium">{fundingProgress.toFixed(1)}%</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300"
                  style={{ width: `${fundingProgress}%` }}
                />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                <div className="min-w-[180px] rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Raised</div>
                  <div className="mt-2 font-semibold text-white">{formatIntegerWithUnit(event?.currentFunding, "wei")}</div>
                </div>
                <div className="min-w-[180px] rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Goal</div>
                  <div className="mt-2 font-semibold text-white">{formatIntegerWithUnit(event?.fundingGoal, "wei")}</div>
                </div>
                <div className="min-w-[180px] rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Min Stake</div>
                  <div className="mt-2 font-semibold text-white">{formatIntegerWithUnit(event?.minStakeRequired, "wei")}</div>
                </div>
                <div className="min-w-[180px] rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Mode</div>
                  <div className="mt-2 font-semibold text-white">{investmentMode}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Ticket Tiers
            </h2>

            {(event.ticketTiers || []).length > 0 ? (
              <div className="grid md:grid-cols-3 gap-6">
                {(event.ticketTiers || []).map((tier, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 transition-colors hover:border-cyan-400/40"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        {tier.name || `Tier ${index + 1}`}
                      </h3>
                      <Ticket className="w-5 h-5 text-cyan-300" />
                    </div>

                    <div className="mb-4">
                      <p className="text-3xl font-bold text-white">
                        {tier.price ?? 0} wei
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        {availableTickets !== null
                          ? `${availableTickets} remaining (overall)`
                          : `${tier.totalSupply || 0} configured`}
                      </p>
                    </div>

                    <ul className="space-y-2 mb-6 text-sm text-slate-400">
                      {(tier.benefits || []).map((benefit, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-emerald-300 mr-2">✓</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handlePurchaseClick(tier.name)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                      disabled={
                        buying || availableTickets === 0 || !isTicketPurchasable
                      }
                    >
                      {!isTicketPurchasable
                        ? "Sales Not Open"
                        : availableTickets === 0
                        ? "Sold Out"
                        : buying
                          ? "Processing..."
                          : user?.walletAddress
                            ? "Buy Ticket"
                            : "Connect Wallet"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">No ticket tiers configured.</div>
            )}
          </CardContent>
        </Card>


        <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-900/20 via-cyan-900/15 to-amber-900/20 mt-2">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Investment Opportunity
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Contribute capital to this event and receive a revenue share
                    position once funding succeeds.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">
                    Contribution amount (wei)
                  </label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={investmentAmount}
                    onChange={(e) =>
                      setInvestmentAmount(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full border-slate-700 bg-slate-900 text-white"
                    placeholder="1000000000000000000"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
                        onClick={() => setInvestmentAmount(amount)}
                      >
                        {formatIntegerWithUnit(amount, "wei")}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    Organizer stake is configured separately. This input is for
                    donator contribution only.
                    {minInvestmentAmount !== "0"
                      ? ` Minimum investment: ${formatIntegerWithUnit(minInvestmentAmount, "wei")}.`
                      : ""}
                  </p>
                </div>

                <Button
                  onClick={handleInvest}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white w-full sm:w-auto"
                  disabled={investing || !isInvestable}
                >
                  <CircleDollarSign className="w-4 h-4 mr-2" />
                  {user?.walletAddress
                    ? investing
                      ? "Submitting..."
                      : "Contribute to Event"
                    : "Connect Wallet to Contribute"}
                </Button>
              </div>

              {investError ? (
                <div className="text-sm text-red-400">{investError}</div>
              ) : null}
              {investSuccess ? (
                <div className="text-sm text-green-300">{investSuccess}</div>
              ) : null}

              {!isInvestable ? (
                <div className="text-sm text-amber-200/80">
                  This event is not currently open for investment.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {purchaseConfirmTier && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-[340px]">
            <h3 className="text-white mb-2 font-semibold">Confirm Purchase</h3>
            <p className="text-slate-300 text-sm mb-4">
              Do you want to purchase{" "}
              <span className="font-semibold">{purchaseConfirmTier}</span>{" "}
              now?
            </p>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={buying}
                onClick={handlePurchaseTicket}
              >
                {buying ? "Purchasing..." : "Confirm"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={buying}
                onClick={() => setPurchaseConfirmTier(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
