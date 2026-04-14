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
import { investInEvent } from "../../services/investment.service";
import { calculatePercentage, formatIntegerWithUnit } from "../../lib/utils";

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connectWallet, user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState("1");
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState("");
  const [investSuccess, setInvestSuccess] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError("");
        const data = await getEventById(id);
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const totalTickets = useMemo(() => {
    if (typeof event?.totalTickets === "number") return event.totalTickets;
    return (event?.ticketTiers || []).reduce(
      (sum, tier) => sum + (tier.totalSupply || 0),
      0,
    );
  }, [event]);

  const eventId = event?._id || event?.id || "";
  const fundingProgress = Math.min(
    calculatePercentage(event?.currentFunding, event?.fundingGoal, 1),
    100,
  );
  const isInvestable =
    event?.status === "funding" && String(event?.fundingGoal || "0") !== "0";

  const coverImage = event?.imageUrls?.[0] || "";
  const eventDate = event?.startDate ? new Date(event.startDate) : null;
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

  const handleInvest = async () => {
    if (!user?.walletAddress) {
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

    setInvestError("");
    setInvestSuccess("");
    setInvesting(true);

    try {
      await investInEvent(eventId, investmentAmount.trim());
      setInvestSuccess("Contribution recorded. Refreshing event data...");
      const refreshedEvent = await getEventById(eventId);
      setEvent(refreshedEvent);
    } catch (err) {
      setInvestError(err instanceof Error ? err.message : "Investment failed");
    } finally {
      setInvesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-12 w-2/3 rounded-xl bg-slate-800" />
          <div className="h-[280px] rounded-2xl bg-slate-900" />
          <div className="grid md:grid-cols-3 gap-4">
            <div className="h-36 rounded-xl bg-slate-900" />
            <div className="h-36 rounded-xl bg-slate-900" />
            <div className="h-36 rounded-xl bg-slate-900" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/40 bg-red-950/30 p-6 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-200">
          Event not found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative grid lg:grid-cols-2 gap-8">
            <div className="aspect-video rounded-2xl overflow-hidden border border-slate-800">
              <ImageWithFallback
                src={coverImage}
                alt={event.title || "Event image"}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <StatusBadge status={event.status || "draft"} />
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                  {totalTickets} total tickets
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">
                {event.title}
              </h1>
              <p className="text-slate-300 text-base leading-7 mb-6">
                {event.description || "No event description available."}
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-slate-300">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
                    <Calendar className="w-4 h-4 text-cyan-300" />
                    Date
                  </div>
                  <div className="font-medium">{formatDate(eventDate)}</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-slate-300">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
                    <Clock className="w-4 h-4 text-cyan-300" />
                    Time
                  </div>
                  <div className="font-medium">{formatTime(eventDate)}</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-slate-300 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
                    <MapPin className="w-4 h-4 text-emerald-300" />
                    Venue
                  </div>
                  <div className="font-medium">
                    {event.venue?.address || "Unknown location"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-slate-300 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
                    <Users className="w-4 h-4 text-emerald-300" />
                    Organizer
                  </div>
                  <code className="text-xs sm:text-sm text-slate-200 break-all">
                    {event.organizer ||
                      event.organizerWallet ||
                      "Unknown organizer"}
                  </code>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span className="inline-flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-300" />
                    Funding progress
                  </span>
                  <span className="font-medium">
                    {fundingProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300"
                    style={{ width: `${fundingProgress}%` }}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-400">
                  <span>
                    Raised:{" "}
                    {formatIntegerWithUnit(event?.currentFunding, "wei")}
                  </span>
                  <span>
                    Goal: {formatIntegerWithUnit(event?.fundingGoal, "wei")}
                  </span>
                  <span>
                    Min stake:{" "}
                    {formatIntegerWithUnit(event?.minStakeRequired, "wei")}
                  </span>
                  {fundingDeadline ? (
                    <span>Deadline: {formatDate(fundingDeadline)}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

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
                        {tier.price ?? 0} ETH
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        {tier.totalSupply || 0} available
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
                      onClick={connectWallet}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                    >
                      {user?.walletAddress ? "Buy Ticket" : "Connect Wallet"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">No ticket tiers configured.</div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-900/20 via-cyan-900/15 to-amber-900/20">
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
                    className="w-full border-slate-700 bg-slate-900"
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
    </div>
  );
};
