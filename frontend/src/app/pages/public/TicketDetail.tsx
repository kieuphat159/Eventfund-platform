import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  Wallet,
  ShoppingCart,
  Clock,
  Shield,
  Users,
  BadgeCheck,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { useAuth } from "../../contexts/AuthContext";
import { useWeb3Auth } from "@web3auth/modal/react";
import {
  listingService,
  type ApiEvent,
  type ApiListing,
  type ApiTicket,
  type BuyListingProgressStage,
} from "../../services/listings.service";

type ListingEvent = ApiEvent & {
  venue?: {
    address: string;
  };
  description?: string;
  contractEventId?: string;
  network?: string;
};

type ListingTicket = ApiTicket & {
  transferHistory?: unknown[];
  metadataUri?: string;
};

const formatTicketType = (type?: string) => {
  if (!type) return "Standard";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

type BuyUiStage =
  | "idle"
  | "preparing"
  | "awaitingWallet"
  | "waitingChain"
  | "syncingBackend";

const BUY_STAGE_MESSAGE: Record<Exclude<BuyUiStage, "idle">, string> = {
  preparing: "Preparing purchase transaction...",
  awaitingWallet: "Waiting for wallet confirmation...",
  waitingChain: "Transaction submitted. Waiting on-chain confirmation...",
  syncingBackend: "Syncing purchase state with backend...",
};

const WEI_PER_ETH = 1_000_000_000_000_000_000n;

const parseWei = (value?: string | number | bigint) => {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
};

const formatWei = (value?: string | number | bigint) => {
  try {
    return BigInt(String(value ?? "0")).toLocaleString();
  } catch {
    return "0";
  }
};

const formatEthApprox = (value?: string | number | bigint, decimals = 6) => {
  const wei = parseWei(value);
  const whole = wei / WEI_PER_ETH;
  const fraction = wei % WEI_PER_ETH;

  if (fraction === 0n) {
    return whole.toString();
  }

  const rawFraction = fraction.toString().padStart(18, "0");
  const trimmedFraction = rawFraction.slice(0, decimals).replace(/0+$/, "");

  return trimmedFraction ? `${whole.toString()}.${trimmedFraction}` : whole.toString();
};

const getListingStatusLabel = (status?: string) => {
  switch (status) {
    case "active":
      return "Active Listing";
    case "sold":
      return "Sold";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return "Listing";
  }
};

export const TicketDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, connectWallet } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const [selectedImage, setSelectedImage] = React.useState(0);
  const [copiedAddress, setCopiedAddress] = React.useState(false);

  const [listing, setListing] = React.useState<ApiListing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [buying, setBuying] = React.useState(false);
  const [buyStage, setBuyStage] = React.useState<BuyUiStage>("idle");
  const [activeTxHash, setActiveTxHash] = React.useState<string | null>(null);
  const [showBuyConfirm, setShowBuyConfirm] = React.useState(false);
  const [buyPopup, setBuyPopup] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (!buyPopup) return;

    const timeoutId = window.setTimeout(() => {
      setBuyPopup(null);
    }, 7000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [buyPopup]);

  const showListingPopup = (type: "success" | "error", message: string) => {
    setBuyPopup({ type, message });
  };

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await listingService.getById(id!);
        setListing(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }
  const event: ListingEvent | null =
    listing && typeof listing.eventId === "object"
      ? (listing.eventId as ListingEvent)
      : null;
  const ticket: ListingTicket | null =
    listing && typeof listing.ticketId === "object"
      ? (listing.ticketId as ListingTicket)
      : null;
  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AlertCircle className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Listing Not Found
          </h2>
          <p className="text-slate-400 mb-6">
            The ticket listing you're looking for doesn't exist.
          </p>
          <Button
            onClick={() => navigate("/marketplace")}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const shortenAddress = (address?: string) => {
    if (!address) return "Unknown";
    if (address.length <= 14) return address;
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  };

  const getRelativeTime = (dateIso?: string) => {
    if (!dateIso) return "N/A";

    const target = new Date(dateIso).getTime();
    if (Number.isNaN(target)) return "N/A";

    const diffMs = Date.now() - target;
    if (diffMs < 0) return "Just now";

    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const listingPriceWei = parseWei(listing.price);
  const maxPriceWei = parseWei(listing.maxPrice);
  const originalPriceWei = parseWei(ticket?.originalPrice);
  const remainingCapWei =
    maxPriceWei > listingPriceWei ? maxPriceWei - listingPriceWei : 0n;
  const marketDiffLabel =
    maxPriceWei > 0n
      ? listingPriceWei <= maxPriceWei
        ? `${formatWei(remainingCapWei)} wei remaining before hitting the resale cap`
        : `${formatWei(listingPriceWei - maxPriceWei)} wei above resale cap`
      : "Live listing price from marketplace";
  const eventDate = event?.startDate ? new Date(event.startDate) : null;
  const listedAtDate = listing.listedAt ? new Date(listing.listedAt) : null;
  const expiresAtDate = listing.expiresAt ? new Date(listing.expiresAt) : null;
  const transferCount = ticket?.transferHistory?.length ?? 0;
  const listingStatusLabel = getListingStatusLabel(listing.status);
  const txExplorerUrl = listing.txHash
    ? `https://sepolia.etherscan.io/tx/${listing.txHash}`
    : "#";
  const activeTxExplorerUrl = activeTxHash
    ? `https://sepolia.etherscan.io/tx/${activeTxHash}`
    : null;

  // Gallery images

  const galleryImages = event?.imageUrls?.length ? event.imageUrls : [];

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleBuyNow = async () => {
    if (!user?.walletAddress) {
      try {
        await connectWallet();
        showListingPopup(
          "success",
          "Wallet connected. Please click Buy Now again to continue.",
        );
      } catch (err) {
        showListingPopup(
          "error",
          err instanceof Error ? err.message : "Failed to connect wallet",
        );
      }
      return;
    }

    setShowBuyConfirm(true);
  };

  const handleConfirmBuy = async () => {
    if (!listing?._id || !user?.walletAddress) {
      showListingPopup("error", "Missing listing or wallet information");
      return;
    }

    const provider = web3Auth?.provider as
      | {
          request: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
        }
      | undefined;

    if (!provider?.request) {
      showListingPopup(
        "error",
        "Wallet provider is not ready. Please reconnect wallet and try again.",
      );
      return;
    }

    setBuying(true);
    setBuyStage("preparing");
    setActiveTxHash(null);
    try {
      const result = await listingService.buy(
        provider,
        listing._id,
        user.walletAddress,
        (stage: BuyListingProgressStage, txHash?: string) => {
          if (txHash) setActiveTxHash(txHash);
          if (stage === "preparing_intent") setBuyStage("preparing");
          if (stage === "awaiting_wallet_confirmation")
            setBuyStage("awaitingWallet");
          if (stage === "waiting_onchain_confirmation")
            setBuyStage("waitingChain");
          if (stage === "syncing_backend") setBuyStage("syncingBackend");
        },
      );
      showListingPopup("success", `Purchase successful. Tx: ${result.txHash}`);

      const refreshed = await listingService.getById(listing._id);
      setListing(refreshed);
      setShowBuyConfirm(false);
    } catch (err) {
      showListingPopup(
        "error",
        err instanceof Error ? err.message : "Failed to purchase ticket",
      );
    } finally {
      setBuying(false);
      setBuyStage("idle");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 py-8">
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

      {buying && buyStage !== "idle" && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 mt-0.5 text-cyan-300 animate-spin" />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">
                  Processing Purchase
                </h3>
                <p className="text-sm text-slate-300">
                  {BUY_STAGE_MESSAGE[buyStage]}
                </p>
                {activeTxHash && activeTxExplorerUrl ? (
                  <a
                    href={activeTxExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 mt-3"
                  >
                    View transaction on Sepolia
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/marketplace")}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Left Side - Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
              <ImageWithFallback
                src={galleryImages[selectedImage] || ""}
                alt={event?.title || "Event image"}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Gallery Thumbnails */}
            <div className="grid grid-cols-4 gap-3">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === idx
                      ? "border-purple-500 ring-2 ring-purple-500/20"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <ImageWithFallback
                    src={img}
                    alt={`Gallery ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Quick Info Cards - Mobile Only */}
            <div className="lg:hidden grid grid-cols-2 gap-3">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 text-center">
                  <Calendar className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 mb-1">Event Date</p>
                  <p className="text-sm text-white font-medium">
                    {eventDate ? eventDate.toLocaleDateString() : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 text-center">
                  <MapPin className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 mb-1">Location</p>
                  <p className="text-sm text-white font-medium">
                    {event?.venue?.address || "N/A"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Side - Details */}
          <div className="space-y-6">
            {/* Title & Category */}
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge className="bg-purple-600/10 text-purple-400 border-purple-500/20">
                  {event?.contractEventId || event?.status || "On-chain event"}
                </Badge>
                <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-400/20">
                  {listingStatusLabel}
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {event?.title || `Ticket ${listing.tokenId}`}
              </h1>
              <p className="text-slate-400">
                Marketplace purchase for ticket #{ticket?.tokenId || listing.tokenId}
              </p>
            </div>

            {/* Ticket Type */}
            <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Ticket Type</p>
                    <p className="text-xl font-bold text-white">
                      {formatTicketType(ticket?.ticketType)}
                    </p>
                  </div>
                  <Ticket className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            {/* Purchase Summary */}
            <Card className="overflow-hidden border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                  <Sparkles className="h-4 w-4" />
                  Purchase Summary
                </div>
              </div>
              <CardContent className="p-0">
                <div className="px-5 py-5">
                  <p className="mb-2 text-sm text-slate-400">Current Listing Price</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="text-4xl font-bold text-white">
                      {formatWei(listingPriceWei)}
                    </span>
                    <span className="text-lg text-purple-300">wei</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Approx. {formatEthApprox(listingPriceWei)} ETH on-chain
                  </p>
                </div>
                <div className="grid gap-px bg-slate-800 sm:grid-cols-3">
                  <div className="bg-slate-900 px-5 py-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Original Mint
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {formatWei(originalPriceWei)} wei
                    </p>
                  </div>
                  <div className="bg-slate-900 px-5 py-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Resale Cap
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {formatWei(maxPriceWei)} wei
                    </p>
                  </div>
                  <div className="bg-slate-900 px-5 py-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Cap Headroom
                    </p>
                    <p className="text-lg font-semibold text-emerald-300">
                      {formatWei(remainingCapWei)} wei
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-800 px-5 py-4 text-sm text-emerald-300">
                  {marketDiffLabel}
                </div>
              </CardContent>
            </Card>

            {/* Event Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <p className="text-xs text-slate-500">Date & Time</p>
                  </div>
                  <p className="text-sm text-white font-medium">
                    {eventDate?.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }) || "N/A"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {eventDate?.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }) || "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="w-5 h-5 text-orange-400" />
                    <p className="text-xs text-slate-500">Location</p>
                  </div>
                  <p className="text-sm text-white font-medium">
                    {event?.venue?.address || "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Ticket className="w-5 h-5 text-green-400" />
                    <p className="text-xs text-slate-500">Remaining</p>
                  </div>
                  <p className="text-sm text-white font-medium">1 of 1</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {ticket?.tokenId || listing.tokenId}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <p className="text-xs text-slate-500">Listed</p>
                  </div>
                  <p className="text-sm text-white font-medium">
                    {getRelativeTime(listing.listedAt)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {listedAtDate?.toLocaleString() || "N/A"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Seller Info */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500">Seller</p>
                  <Badge className="bg-green-600/10 text-green-400 border-green-500/20">
                    <BadgeCheck className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-mono">
                        {shortenAddress(listing.seller)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Listed {getRelativeTime(listing.listedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyAddress(listing.seller)}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedAddress ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Action */}
            <Card className="border-slate-800 bg-slate-900/90">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-sm text-slate-500">Ready to buy</p>
                    <p className="text-lg font-semibold text-white">
                      Ticket #{ticket?.tokenId || listing.tokenId} for {formatWei(listingPriceWei)} wei
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-400/20">
                    {listingStatusLabel}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Wallet
                    </p>
                    <p className="text-sm text-slate-300">
                      {user?.walletAddress
                        ? shortenAddress(user.walletAddress)
                        : "Connect wallet to continue"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Settlement
                    </p>
                    <p className="text-sm text-slate-300">
                      Ownership transfers after the transaction is confirmed on-chain.
                    </p>
                  </div>
                </div>

                {!user?.walletAddress ? (
                  <Button
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-base font-semibold"
                    onClick={handleBuyNow}
                    disabled={buying}
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect Wallet to Buy
                  </Button>
                ) : (
                  <Button
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-base font-semibold"
                    onClick={handleBuyNow}
                    disabled={buying}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {buying
                      ? "Processing purchase..."
                      : `Buy Now for ${formatWei(listingPriceWei)} wei`}
                  </Button>
                )}

                <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 px-3 py-2">
                    1. Review ticket and price
                  </div>
                  <div className="rounded-lg border border-slate-800 px-3 py-2">
                    2. Confirm in wallet
                  </div>
                  <div className="rounded-lg border border-slate-800 px-3 py-2">
                    3. Wait for chain sync
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="bg-blue-900/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white font-medium mb-1">
                      Secure Transaction
                    </p>
                    <p className="text-xs text-slate-400">
                      All transactions are secured by smart contracts on the
                      Ethereum blockchain. Your purchase is protected by
                      EventChain's buyer guarantee.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Below Section - Tabs/Details */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Description */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-purple-400" />
                  Event Description
                </h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  {event?.description || "No event description available."}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge className="bg-purple-600/10 text-purple-400 border-purple-500/20">
                    {ticket?.ticketType || "Ticket"}
                  </Badge>
                  <Badge className="bg-blue-600/10 text-blue-400 border-blue-500/20">
                    {event?.status || "Event"}
                  </Badge>
                  <Badge className="bg-green-600/10 text-green-400 border-green-500/20">
                    NFT Collectible
                  </Badge>
                  <Badge className="bg-orange-600/10 text-orange-400 border-orange-500/20">
                    {event?.contractEventId || "On-chain"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Organizer Information */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-400" />
                  Organizer Information
                </h2>
                <div className="flex items-start gap-4 mb-4">
                  {/* <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-white">
                      {listing?.organizer.charAt(0)}
                    </span>
                  </div> */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {event?.title || "Event Organizer"}
                      </h3>
                      <Badge className="bg-green-600/10 text-green-400 border-green-500/20">
                        <BadgeCheck className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                      Organizer and ticket ownership are verified on-chain for
                      this listing.
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-white font-semibold">
                          {transferCount}
                        </span>
                        <span className="text-slate-500"> transfers</span>
                      </div>
                      <div className="text-slate-500">•</div>
                      <div className="text-slate-400">
                        Status: {ticket?.status || listing.status}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">
                    Organizer Wallet
                  </p>
                  <div className="flex items-center justify-between bg-slate-950 rounded-lg p-3">
                    <code className="text-sm text-slate-300 font-mono">
                      {listing.seller}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyAddress(listing.seller)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smart Contract Details */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-green-400" />
                  Smart Contract Details
                </h2>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        Listing Tx Hash
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-purple-400 font-mono">
                          {listing.txHash
                            ? `${listing.txHash.slice(0, 12)}...${listing.txHash.slice(-8)}`
                            : "N/A"}
                        </code>
                        <a
                          href={txExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        Token Standard
                      </p>
                      <p className="text-sm text-white">ERC-721</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Token ID</p>
                      <p className="text-sm text-white">
                        {ticket?.tokenId || listing.tokenId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Network</p>
                      <p className="text-sm text-white">
                        {event?.network || "Ethereum"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-white font-medium mb-1">
                          Verified Smart Contract
                        </p>
                        <p className="text-xs text-slate-400">
                          This ticket is issued through EventChain's audited
                          smart contracts, ensuring authenticity and secure
                          ownership transfer.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Resale Rules */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-orange-400" />
                  Ticket Resale Rules
                </h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">
                        Transferable
                      </p>
                      <p className="text-xs text-slate-400">
                        This ticket can be transferred on-chain after a successful marketplace settlement.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">
                        Resale Cap Enforced
                      </p>
                      <p className="text-xs text-slate-400">
                        This listing cannot exceed {formatWei(maxPriceWei)} wei based on the original mint price.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">
                        Buyer Receives NFT
                      </p>
                      <p className="text-xs text-slate-400">
                        Ownership updates to the buyer wallet after the purchase transaction is confirmed.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">
                        Listing Availability
                      </p>
                      <p className="text-xs text-slate-400">
                        Purchase succeeds only while the listing remains active and unsold.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Ticket Benefits */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Ticket Benefits
                </h3>

                <ul className="space-y-3">
                  {[
                    `${ticket?.ticketType || "Standard"} ticket access`,
                    `Token: ${ticket?.tokenId || listing.tokenId}`,
                    `Listing status: ${listing.status}`,
                    `Expires: ${expiresAtDate?.toLocaleDateString() || "No expiry"}`,
                    `Metadata: ${ticket?.metadataUri || "Unavailable"}`,
                  ].map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Listing Snapshot */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Listing Snapshot
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Original Price
                    </span>
                    <span className="text-sm text-white font-medium">
                      {originalPriceWei > 0n
                        ? `${formatWei(originalPriceWei)} wei`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Resale Cap</span>
                    <span className="text-sm text-white font-medium">
                      {maxPriceWei > 0n ? `${formatWei(maxPriceWei)} wei` : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Listed At</span>
                    <span className="text-sm text-white font-medium">
                      {listedAtDate?.toLocaleString() || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Expires At</span>
                    <span className="text-sm text-white font-medium">
                      {expiresAtDate?.toLocaleString() || "No expiry"}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Current Listing
                      </span>
                      <span className="text-sm text-purple-400 font-bold">
                        {formatWei(listingPriceWei)} wei
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Flow */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  Purchase Flow
                </h3>
                <div className="space-y-3">
                  {[
                    "Backend prepares a buy intent for the active listing.",
                    "Buyer confirms the purchase transaction in wallet.",
                    "Marketplace contract transfers the NFT ownership.",
                    "Backend syncs listing status and ticket owner after the tx is mined.",
                  ].map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/15 text-xs font-semibold text-purple-300">
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-300">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Related Listings */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Similar Tickets
                  </h3>
                  <Link
                    to="/marketplace"
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {[listing].map((item) => (
                    <Link
                      key={item._id}
                      to={`/tickets/${item._id}`}
                      className="flex gap-3 p-3 rounded-lg bg-slate-950 hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <ImageWithFallback
                          src={item.eventId?.imageUrls?.[0]}
                          alt={item.eventId?.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate mb-1">
                          {event?.title}
                        </p>

                        <p className="text-xs text-slate-500 mb-2">
                          {ticket?.ticketType}
                        </p>

                        <p className="text-sm text-purple-400 font-bold">
                          {formatWei(item.price)} wei
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showBuyConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-[360px]">
            <h3 className="text-white mb-2 font-semibold">Confirm Purchase</h3>
            <p className="text-slate-300 text-sm mb-4">
              You are about to buy ticket{" "}
              <span className="font-semibold">#{listing.tokenId}</span> for{" "}
              <span className="font-semibold">
                {formatWei(listingPriceWei)} wei
              </span>
              .
            </p>

            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span>Event</span>
                <span className="text-white">{event?.title || "Untitled event"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-slate-400">
                <span>Ticket type</span>
                <span className="text-white">
                  {formatTicketType(ticket?.ticketType)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-slate-400">
                <span>Seller</span>
                <span className="text-white">{shortenAddress(listing.seller)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={buying}
                onClick={handleConfirmBuy}
              >
                {buying ? "Purchasing..." : "Confirm"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={buying}
                onClick={() => setShowBuyConfirm(false)}
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
