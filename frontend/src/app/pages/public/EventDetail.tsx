import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { useAuth } from "../../contexts/AuthContext";
import { getEventById, type EventItem } from "../../services/events.service";
import { investInEvent } from "../../services/investment.service";

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connectWallet, user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState<number>(0);
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
        const minStake = Number(data?.minStakeRequired ?? 0);
        setInvestmentAmount(minStake > 0 ? minStake : 1);
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

  const isInvestable =
    event?.status === "funding" && Number(event?.fundingGoal ?? 0) > 0;

  const coverImage = event?.imageUrls?.[0] || "";

  const handleInvest = async () => {
    if (!user?.walletAddress) {
      await connectWallet();
      return;
    }

    if (!event?._id) return;

    setInvestError("");
    setInvestSuccess("");
    setInvesting(true);
    try {
      await investInEvent(event._id, investmentAmount);
      setInvestSuccess("Investment successful. Refreshing event data...");
      const refreshedEvent = await getEventById(event._id);
      setEvent(refreshedEvent);
    } catch (err) {
      setInvestError(err instanceof Error ? err.message : "Investment failed");
    } finally {
      setInvesting(false);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading event...</div>;
  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!event) return <div className="p-8 text-white">Event not found</div>;

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="aspect-video rounded-xl overflow-hidden">
            <ImageWithFallback
              src={coverImage}
              alt={event.title || "Event image"}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white mb-4">
              {event.title}
            </h1>
            <p className="text-lg text-slate-400 mb-6">{event.description}</p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-3 text-slate-300">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>
                  {event.startDate
                    ? new Date(event.startDate).toLocaleDateString()
                    : "No date"}
                </span>
              </div>

              <div className="flex items-center space-x-3 text-slate-300">
                <Clock className="w-5 h-5 text-purple-400" />
                <span>
                  {event.startDate
                    ? new Date(event.startDate).toLocaleTimeString()
                    : "No time"}
                </span>
              </div>

              <div className="flex items-center space-x-3 text-slate-300">
                <MapPin className="w-5 h-5 text-purple-400" />
                <span>{event.venue?.address || "Unknown location"}</span>
              </div>

              <div className="flex items-center space-x-3 text-slate-300">
                <Users className="w-5 h-5 text-purple-400" />
                <span>{totalTickets} tickets available</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-400 mb-1">Organized by</p>
              <code className="text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded">
                {event.organizer ||
                  event.organizerWallet ||
                  "Unknown organizer"}
              </code>
            </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Ticket Tiers</h2>

            {(event.ticketTiers || []).length > 0 ? (
              <div className="grid md:grid-cols-3 gap-6">
                {(event.ticketTiers || []).map((tier, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        {tier.name || `Tier ${index + 1}`}
                      </h3>
                      <Ticket className="w-5 h-5 text-purple-400" />
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
                          <span className="text-purple-400 mr-2">✓</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <Button onClick={connectWallet} className="w-full">
                      Purchase Ticket
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">No ticket tiers configured.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">
                    Investment Opportunity
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Invest in this event and earn returns based on ticket sales
                    and event success.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">
                    Investment amount
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={investmentAmount}
                    onChange={(e) =>
                      setInvestmentAmount(Number(e.target.value))
                    }
                    className="w-full"
                  />
                  {isInvestable && event?.minStakeRequired ? (
                    <p className="text-xs text-slate-500 mt-2">
                      Minimum stake: {event.minStakeRequired} units
                    </p>
                  ) : null}
                </div>

                <Button
                  onClick={handleInvest}
                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                  disabled={investing || !isInvestable}
                >
                  {user?.walletAddress
                    ? investing
                      ? "Investing..."
                      : "Invest in Event"
                    : "Connect Wallet to Invest"}
                </Button>
              </div>

              {investError ? (
                <div className="text-sm text-red-400">{investError}</div>
              ) : null}
              {investSuccess ? (
                <div className="text-sm text-green-300">{investSuccess}</div>
              ) : null}

              {!isInvestable ? (
                <div className="text-sm text-slate-400">
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
