import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  Tag,
  TrendingUp,
  User,
  Wallet,
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
import { StatusBadge } from "../../components/StatusBadge";
import {
  assignEventVerifierOnChain,
  getAdminEventById,
  getAdminEventInvestments,
  getVerifierUsers,
  type AdminEventInvestmentsData,
  type AdminUserItem,
  type EventItem,
} from "../../services/events.service";
import { calculatePercentage, formatIntegerWithUnit } from "../../lib/utils";
import { useLoading } from "../../components/ui/loadingContext";

export const AdminEventDetail: React.FC = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [investmentData, setInvestmentData] =
    useState<AdminEventInvestmentsData | null>(null);
  const [verifierUsers, setVerifierUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifierWallet, setVerifierWallet] = useState("");
  const [loadingVerifiers, setLoadingVerifiers] = useState(false);
  const [assigningVerifierOnChain, setAssigningVerifierOnChain] =
    useState(false);
  const [assignOnChainError, setAssignOnChainError] = useState("");
  const [assignOnChainSuccess, setAssignOnChainSuccess] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setError("Invalid event id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadingVerifiers(true);
        setError("");

        loadingCtx.show("Loading event details...");

        const [eventData, investments, verifierOptions] = await Promise.all([
          getAdminEventById(id),
          getAdminEventInvestments(id, {
            limit: 10,
            sort: "-contributionAmount",
          }),
          getVerifierUsers(),
        ]);

        if (!eventData) {
          setError("Event not found");
          return;
        }

        setEvent(eventData);
        setInvestmentData(investments);
        setVerifierUsers(
          verifierOptions.filter((item) => item.isActive !== false),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load event details",
        );
      } finally {
        setLoading(false);
        setLoadingVerifiers(false);
        loadingCtx.hide();
      }
    };

    fetchEvent();
  }, [id]);

  const fundingProgress = useMemo(() => {
    return Math.min(
      calculatePercentage(event?.currentFunding, event?.fundingGoal, 1),
      100,
    );
  }, [event?.currentFunding, event?.fundingGoal]);

  const investmentMode =
    event?.investmentEnabled === false ? "Self-funded" : "Investment-enabled";

  const assignedVerifiers = useMemo(
    () => new Set((event?.verifiers || []).map((wallet) => wallet.toLowerCase())),
    [event?.verifiers],
  );

  const availableVerifierUsers = useMemo(
    () =>
      verifierUsers.filter(
        (verifier) =>
          !assignedVerifiers.has(verifier.walletAddress.toLowerCase()),
      ),
    [assignedVerifiers, verifierUsers],
  );

  const verifierMap = useMemo(
    () =>
      new Map(
        verifierUsers.map((verifier) => [
          verifier.walletAddress.toLowerCase(),
          verifier,
        ]),
      ),
    [verifierUsers],
  );

  const loadingCtx = useLoading();

  const [searchTerm, setSearchTerm] = useState("");

  const isLikelyAddress = (s: string) => /^0x[a-fA-F0-9]{8,}$/.test(s.trim());

  const filteredAvailableVerifierUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return availableVerifierUsers;
    return availableVerifierUsers.filter((verifier) => {
      const identity = (verifier.username || verifier.email || "").toLowerCase();
      const wallet = (verifier.walletAddress || "").toLowerCase();
      return identity.includes(q) || wallet.includes(q);
    });
  }, [availableVerifierUsers, searchTerm]);

  const formatVerifierOption = (verifier: AdminUserItem) => {
    const identity = verifier.username || verifier.email || "Unnamed verifier";
    return `${identity} - ${verifier.walletAddress}`;
  };

  useEffect(() => {
    if (!verifierWallet && availableVerifierUsers.length > 0) {
      setVerifierWallet(availableVerifierUsers[0].walletAddress.toLowerCase());
      return;
    }

    // If the current verifierWallet is not in available options, only replace it
    // when it doesn't look like a manual wallet address. This preserves typed
    // addresses that admins paste in the search box.
    if (
      verifierWallet &&
      !availableVerifierUsers.some(
        (verifier) =>
          verifier.walletAddress.toLowerCase() === verifierWallet.toLowerCase(),
      ) &&
      !isLikelyAddress(verifierWallet)
    ) {
      setVerifierWallet(
        availableVerifierUsers[0]?.walletAddress.toLowerCase() || "",
      );
    }
  }, [availableVerifierUsers, verifierWallet]);

  const handleAssignVerifierOnChain = async () => {
    const eventId = event?._id || event?.id;
    if (!eventId) {
      setAssignOnChainError("Invalid event id.");
      return;
    }

    const normalizedWallet = verifierWallet.trim().toLowerCase();
    if (!normalizedWallet) {
      setAssignOnChainError("Please select a verifier.");
      return;
    }

    const MIN_FAKE_MS = 700;
    const start = Date.now();

    try {
      setAssigningVerifierOnChain(true);
      setAssignOnChainError("");
      setAssignOnChainSuccess("");
      loadingCtx.show("Assigning verifier on-chain...");

      const updatedEvent = await assignEventVerifierOnChain(
        eventId,
        normalizedWallet,
      );
      if (!updatedEvent) {
        throw new Error("Assign verifier on-chain returned no data.");
      }

      // ensure minimum fake loading duration for UX
      const elapsed = Date.now() - start;
      if (elapsed < MIN_FAKE_MS) {
        await new Promise((res) => setTimeout(res, MIN_FAKE_MS - elapsed));
      }

      setEvent(updatedEvent);
      setVerifierWallet("");
      setAssignOnChainSuccess("Verifier assigned on-chain successfully.");
    } catch (err) {
      setAssignOnChainError(
        err instanceof Error ? err.message : "Failed to assign verifier on-chain.",
      );
    } finally {
      loadingCtx.hide();
      setAssigningVerifierOnChain(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading event details...</div>;
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <div className="text-red-400">{error || "Event not found"}</div>
        <Link to="/admin/events">
          <Button
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  const investorRows = investmentData?.docs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/events"
            className="mb-3 inline-flex items-center text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Link>
          <h1 className="mb-2 text-3xl font-bold text-white">
            {event.title || "Untitled event"}
          </h1>
          <p className="text-slate-400">
            Admin view for event operations and investment oversight
          </p>
        </div>

        <Link to={`/admin/events/edit/${event._id || event.id}`}>
          <Button className="bg-blue-600 text-white hover:bg-blue-700">
            Edit Event
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="mb-1 text-sm text-slate-400">Current Funding</p>
            <p className="text-2xl font-bold text-white">
              {formatIntegerWithUnit(event.currentFunding, "wei")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="mb-1 text-sm text-slate-400">Funding Goal</p>
            <p className="text-2xl font-bold text-white">
              {formatIntegerWithUnit(event.fundingGoal, "wei")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="mb-1 text-sm text-slate-400">Investors</p>
            <p className="text-2xl font-bold text-white">
              {investmentData?.summary?.totalInvestors ??
                event.adminSummary?.investorCount ??
                0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="mb-1 text-sm text-slate-400">Funding Progress</p>
            <p className="text-2xl font-bold text-white">
              {fundingProgress.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Overview</CardTitle>
              <CardDescription className="text-slate-400">
                General information about this event
              </CardDescription>
            </div>

            <StatusBadge status={(event.status as any) || "draft"} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-300">
              Description
            </h3>
            <p className="leading-relaxed text-slate-400">
              {event.description || "No description available"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center space-x-2 text-slate-300">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Start Date</span>
              </div>
              <p className="text-slate-400">
                {event.startDate
                  ? new Date(event.startDate).toLocaleString()
                  : "No date"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center space-x-2 text-slate-300">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Venue</span>
              </div>
              <p className="text-slate-400">
                {event.venue?.address || "Unknown location"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center space-x-2 text-slate-300">
                <User className="h-4 w-4" />
                <span className="font-medium">Organizer</span>
              </div>
              <p className="break-all text-slate-400">
                {event.organizer || event.organizerWallet || "Unknown organizer"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center space-x-2 text-slate-300">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Organizer Stake / Capital</span>
              </div>
              <p className="text-slate-400">
                {formatIntegerWithUnit(event.minStakeRequired, "wei")}{" "}
                {event.investmentEnabled === false
                  ? "organizer capital"
                  : "locked organizer stake"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {typeof event.totalTickets === "number"
                  ? `${event.totalTickets} tickets planned`
                  : `From ${event.ticketTiers?.[0]?.price ?? 0} wei ticket price`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Mode: {investmentMode}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center space-x-2 text-slate-300">
                <Tag className="h-4 w-4" />
                <span className="font-medium">Category</span>
              </div>
              <p className="text-slate-400">
                {event.category || "Uncategorized"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center space-x-2 text-slate-300">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Created At</span>
              </div>
              <p className="text-slate-400">
                {event.createdAt
                  ? new Date(event.createdAt).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <div className="inline-flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span>Funding progress</span>
              </div>
              <span>{fundingProgress.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                style={{ width: `${fundingProgress}%` }}
              />
            </div>
          </div>

          {event.ticketTiers && event.ticketTiers.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                Ticket Tiers
              </h3>
              <div className="space-y-3">
                {event.ticketTiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {tier.name || `Tier ${index + 1}`}
                      </p>
                      <p className="text-sm text-slate-400">
                        Supply: {tier.totalSupply ?? "N/A"}
                      </p>
                      {tier.benefits && tier.benefits.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          Benefits: {tier.benefits.join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="font-semibold text-white">
                      {tier.price ?? 0} wei
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Investors</CardTitle>
          <CardDescription className="text-slate-400">
            Top share holders and capital allocation for this event
          </CardDescription>
        </CardHeader>
        <CardContent>
          {investorRows.length === 0 ? (
            <div className="text-slate-400">
              No investments recorded for this event yet.
            </div>
          ) : (
            <div className="space-y-3">
              {investorRows.map((investment) => (
                <div
                  key={investment._id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="inline-flex items-center gap-2 text-white">
                      <Wallet className="h-4 w-4 text-cyan-400" />
                      <span className="break-all font-medium">
                        {investment.contributor || "Unknown investor"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Joined{" "}
                      {investment.createdAt
                        ? new Date(investment.createdAt).toLocaleString()
                        : "Unknown"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:w-auto">
                    <div>
                      <p className="text-xs text-slate-500">Contribution</p>
                      <p className="text-sm font-semibold text-white">
                        {formatIntegerWithUnit(
                          investment.contributionAmount ?? investment.amount,
                          "wei",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Share</p>
                      <p className="text-sm font-semibold text-emerald-400">
                        {Number(investment.sharePercentage || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Verifier Assignment</CardTitle>
          <CardDescription className="text-slate-400">
            Choose from active accounts that already have verifier role
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <input
                value={searchTerm}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchTerm(v);
                  setVerifierWallet(v.trim().toLowerCase());
                }}
                placeholder={
                  loadingVerifiers
                    ? "Loading verifier accounts..."
                    : "Enter wallet address"
                }
                className="w-full rounded border border-slate-700 bg-slate-800 text-white px-3 py-2"
              />

              <div className="mt-2">
                <Select
                  value={verifierWallet}
                  onValueChange={setVerifierWallet}
                  disabled={loadingVerifiers || filteredAvailableVerifierUsers.length === 0}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                    <SelectValue
                      placeholder={
                        searchTerm
                          ? `Showing ${filteredAvailableVerifierUsers.length} result(s)`
                          : filteredAvailableVerifierUsers.length > 0
                            ? "Select verifier account"
                            : "No unassigned verifier account available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    {filteredAvailableVerifierUsers.map((verifier) => (
                      <SelectItem
                        key={verifier.walletAddress}
                        value={verifier.walletAddress.toLowerCase()}
                        className="text-white hover:bg-slate-700"
                      >
                        {formatVerifierOption(verifier)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleAssignVerifierOnChain}
              disabled={
                assigningVerifierOnChain ||
                !verifierWallet ||
                !event.contractEventId
              }
              variant="outline"
              className="border-cyan-600 text-cyan-300 hover:bg-cyan-950/40 hover:text-cyan-200"
              title={
                event.contractEventId
                  ? "Assign verifier on-chain"
                  : "Event is not synced to chain yet"
              }
            >
              {assigningVerifierOnChain ? "On-chain..." : "Assign"}
            </Button>
          </div>

          {assignOnChainError && (
            <p className="text-sm text-red-400">{assignOnChainError}</p>
          )}
          {assignOnChainSuccess && (
            <p className="text-sm text-emerald-400">{assignOnChainSuccess}</p>
          )}

          {event.contractEventId ? (
            <p className="text-sm text-cyan-300">
              This event is on-chain, so verifier assignment is handled only
              on-chain.
            </p>
          ) : (
            <p className="text-sm text-yellow-300">
              Sync this event on-chain first before assigning verifiers.
            </p>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>On-chain Event ID</span>
              <span className="break-all font-medium text-white">
                {event.contractEventId || "Not synced yet"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="mb-3 text-sm font-medium text-slate-300">
              Current Verifiers
            </p>

            {Array.isArray(event.verifiers) && event.verifiers.length > 0 ? (
              <div className="space-y-2">
                {event.verifiers.map((wallet) => {
                  const verifier = verifierMap.get(wallet.toLowerCase());

                  return (
                    <div
                      key={wallet}
                      className="rounded-md bg-slate-900/70 px-3 py-2 text-sm text-slate-300"
                    >
                      <p className="font-medium text-white">
                        {verifier?.username ||
                          verifier?.email ||
                          "Verifier account"}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-400">
                        {wallet}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No verifier assigned yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEventDetail;
