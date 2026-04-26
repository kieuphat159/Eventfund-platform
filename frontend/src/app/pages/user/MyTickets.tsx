import React, { useEffect, useMemo, useState } from "react";
import {
  Ticket,
  QrCode,
  Download,
  Share2,
  Calendar,
  MapPin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../contexts/AuthContext";
import {
  claimTicketRefundOnChain,
  getUserTickets,
  type ApiTicket,
} from "../../services/tickets.service";
import {
  cancelListingOnchain,
  getListings,
  listTicketOnchain,
} from "@/app/services/listings.service";
import { QRCodeCanvas } from "qrcode.react";
import { useWeb3Auth } from "@web3auth/modal/react";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const buildQR = (ticket: ApiTicket) => {
  return `http://localhost:3000/tickets/verify/${ticket.tokenId}`;
};

const getTicketQrCanvasId = (ticket: ApiTicket) => {
  const rawId = String(ticket._id || ticket.tokenId || "unknown");
  return `ticket-qr-${rawId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
};

const formatTicketType = (type?: string) => {
  if (!type) return "Standard";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const isPositiveWeiInteger = (value: string) => {
  const trimmed = value.trim();
  return /^[0-9]+$/.test(trimmed) && BigInt(trimmed) > 0n;
};

export const MyTickets: React.FC = () => {
  const { user, connectWallet } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const [listingPopup, setListingPopup] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ApiTicket | null>(null);
  const walletAddress = user?.walletAddress?.trim();
  const [listingTicket, setListingTicket] = useState<ApiTicket | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [cancelTicket, setCancelTicket] = useState<ApiTicket | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [refundingTokenId, setRefundingTokenId] = useState<string | null>(null);

  useEffect(() => {
    if (!listingPopup) return;

    const timeoutId = window.setTimeout(() => {
      setListingPopup(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [listingPopup]);

  const showListingPopup = (type: "success" | "error", message: string) => {
    setListingPopup({ type, message });
  };

  useEffect(() => {
    const fetchTickets = async () => {
      if (!walletAddress) {
        setTickets([]);
        setError(null);
        return;
      }

      if (!ETH_ADDRESS_REGEX.test(walletAddress)) {
        setTickets([]);
        setError("Wallet address is invalid. Please reconnect wallet.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getUserTickets(walletAddress);
        setTickets(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load tickets";
        setTickets([]);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [walletAddress]);

  const upcomingEventsCount = useMemo(() => {
    const now = Date.now();
    return tickets.filter((ticket) => {
      const event =
        typeof ticket.eventId === "object" ? ticket.eventId : undefined;
      if (!event?.startDate) {
        return false;
      }
      return new Date(event.startDate).getTime() > now;
    }).length;
  }, [tickets]);

  const totalValue = useMemo(() => {
    return tickets.reduce(
      (sum, ticket) => sum + BigInt(ticket.originalPrice || "0"),
      0n, // 0n là khởi tạo kiểu BigInt
    );
  }, [tickets]);

  const downloadTicketQR = (ticket: ApiTicket) => {
    const canvasId = getTicketQrCanvasId(ticket);
    const canvas = document.getElementById(
      canvasId,
    ) as HTMLCanvasElement | null;

    if (!canvas) {
      return;
    }

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticket-${ticket.tokenId}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resolveActiveListingIdByTicket = async (ticket: ApiTicket) => {
    const ticketId = ticket._id;

    if (!ticketId) return null;

    let page = 1;
    const limit = 100;
    let totalPages = 1;

    while (page <= totalPages) {
      const payload = await getListings({ status: "active", page, limit });
      const matchedListing = payload.docs.find((listing) => {
        if (!listing.ticketId) return false;

        if (typeof listing.ticketId === "string") {
          return listing.ticketId === ticketId;
        }

        return listing.ticketId._id === ticketId;
      });

      if (matchedListing?._id) {
        return matchedListing._id;
      }

      totalPages = payload.totalPages || 1;
      page += 1;
    }

    return null;
  };

  const formatWei = (wei: string | bigint | number) => {
    try {
      return BigInt(String(wei || "0")).toLocaleString();
    } catch {
      return "0";
    }
  };

  const walletProvider = web3Auth?.provider as
    | {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      }
    | undefined;

  const refreshTickets = async () => {
    if (!walletAddress || !ETH_ADDRESS_REGEX.test(walletAddress)) {
      return;
    }

    const data = await getUserTickets(walletAddress);
    setTickets(data);
  };

  const handleClaimRefund = async (ticket: ApiTicket) => {
    try {
      if (!user?.walletAddress) {
        await connectWallet();
        showListingPopup(
          "success",
          "Wallet connected. Please click Claim Refund again to continue.",
        );
        return;
      }

      if (!walletProvider?.request) {
        throw new Error(
          "Wallet provider is not ready. Please reconnect wallet and try again.",
        );
      }

      setRefundingTokenId(ticket.tokenId);
      const result = await claimTicketRefundOnChain(
        walletProvider,
        ticket.tokenId,
        user.walletAddress,
      );

      setTickets((prev) =>
        prev.map((item) =>
          item.tokenId === ticket.tokenId
            ? result.confirmation?.ticket || { ...item, status: "refunded" }
            : item,
        ),
      );
      await refreshTickets();
      showListingPopup(
        "success",
        `Refund claimed successfully. Tx: ${result.txHash}`,
      );
    } catch (error) {
      showListingPopup(
        "error",
        error instanceof Error ? error.message : "Refund claim failed",
      );
    } finally {
      setRefundingTokenId(null);
    }
  };

  return (
    <div className="space-y-6">
      {listingPopup && (
        <div className="fixed top-4 right-4 z-[60]">
          <div
            className={`min-w-[260px] max-w-[340px] rounded-lg border px-4 py-3 text-sm shadow-lg ${
              listingPopup.type === "success"
                ? "bg-emerald-900/95 border-emerald-600 text-emerald-100"
                : "bg-red-900/95 border-red-600 text-red-100"
            }`}
          >
            {listingPopup.message}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My NFT Tickets</h1>
        <p className="text-slate-400">Your digital tickets stored as NFTs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Total Tickets</p>
            <p className="text-3xl font-bold text-white">{tickets.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Upcoming Events</p>
            <p className="text-3xl font-bold text-white">
              {upcomingEventsCount}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-1">Total Value</p>
            <p className="text-3xl font-bold text-white">
              {formatWei(totalValue)} wei
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-slate-300">
            Loading tickets...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-slate-900 border-red-800">
          <CardContent className="p-6 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Tickets Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {tickets.map((ticket) => {
          const event =
            typeof ticket.eventId === "object" ? ticket.eventId : undefined;
          const eventName = event?.title || "Unknown Event";
          const eventDate = event?.startDate;
          const venue =
            [event?.venue?.name, event?.venue?.address]
              .filter(Boolean)
              .join(" - ") || "Unknown venue";
          const purchasePrice = ticket.originalPrice || "0";
          const canClaimRefund =
            ticket.status === "sold" && event?.status === "cancelled";

          return (
            <Card
              key={ticket._id || ticket.tokenId}
              className="bg-slate-900 border-slate-800 overflow-hidden"
            >
              <div className="relative">
                <div className="absolute top-4 right-4 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">
                  #{ticket.tokenId}
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-blue-600 h-32 flex items-center justify-center">
                  <Ticket className="w-16 h-16 text-white opacity-50" />
                </div>
              </div>

              <CardHeader>
                <CardTitle className="text-white">{eventName}</CardTitle>
                <CardDescription className="text-slate-400">
                  {formatTicketType(ticket.ticketType) || "Standard"}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">
                      {eventDate
                        ? new Date(eventDate).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "TBD"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{venue}</span>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">
                      Purchase Price
                    </span>
                    <span className="text-sm font-semibold text-purple-400">
                      {formatWei(purchasePrice)} wei
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="hidden">
                    <QRCodeCanvas
                      id={getTicketQrCanvasId(ticket)}
                      value={buildQR(ticket)}
                      size={800}
                      includeMargin
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={Boolean(ticket.isListed)}
                    onClick={() => {
                      if (ticket.isListed) return;
                      setSelectedTicket(ticket);
                    }}
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={Boolean(ticket.isListed)}
                    onClick={() => {
                      if (ticket.isListed) return;
                      downloadTicketQR(ticket);
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 hover:bg-slate-800"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>

                {canClaimRefund ? (
                  <Button
                    className="w-full mt-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                    disabled={refundingTokenId === ticket.tokenId}
                    onClick={() => void handleClaimRefund(ticket)}
                  >
                    {refundingTokenId === ticket.tokenId
                      ? "Claiming Refund..."
                      : "Claim Refund"}
                  </Button>
                ) : (
                  <Button
                    className={`w-full mt-3 text-white ${
                      ticket.isListed
                        ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
                        : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    }`}
                    onClick={() => {
                      if (ticket.isListed) {
                        setCancelTicket(ticket);
                        return;
                      }

                      setListingTicket(ticket);
                      setListingError(null);
                      setListingPrice("");
                    }}
                  >
                    {ticket.isListed ? "Cancel Listing" : "List on Marketplace"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {!isLoading && tickets.length === 0 && !error && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <Ticket className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No tickets yet
            </h3>
            <p className="text-slate-400 mb-6">
              Purchase your first NFT ticket to get started
            </p>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
              Browse Events
            </Button>
          </CardContent>
        </Card>
      )}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 text-center w-[300px]">
            <h3 className="text-white mb-4 font-semibold">
              Ticket #{selectedTicket.tokenId}
            </h3>

            <div className="flex justify-center items-center">
              <QRCodeCanvas value={buildQR(selectedTicket)} size={200} />
            </div>

            <p className="text-slate-400 text-xs mt-3">Scan to verify ticket</p>

            <Button
              className="mt-4 w-full"
              onClick={() => setSelectedTicket(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
      {listingTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-[320px]">
            <h3 className="text-white mb-4 font-semibold">
              List Ticket #{listingTicket.tokenId}
            </h3>

            {(() => {
              const originalPriceWei = BigInt(listingTicket.originalPrice || "0");
              const maxAllowedWei = (originalPriceWei * 150n) / 100n;
              return (
                <div className="mb-3 rounded-md border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300">
                  <p>Original price: {formatWei(originalPriceWei)} wei</p>
                  <p>
                    Max resale (150% cap): {formatWei(maxAllowedWei)} wei
                  </p>
                </div>
              );
            })()}

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter price (wei)"
              value={listingPrice}
              onChange={(e) => setListingPrice(e.target.value)}
              className="w-full mb-4 p-2 rounded bg-slate-800 text-white border border-slate-700"
            />
            {listingError && (
              <p className="text-red-400 text-sm mb-3">{listingError}</p>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={listingLoading}
                onClick={async () => {
                  setListingError(null);

                  if (!isPositiveWeiInteger(listingPrice)) {
                    setListingError("Price must be a positive integer in wei");
                    showListingPopup(
                      "error",
                      "Listing failed: price must be a positive integer in wei.",
                    );
                    return;
                  }

                  const normalizedPriceWei = listingPrice.trim();
                  const originalPriceWei = BigInt(listingTicket.originalPrice || "0");
                  const maxAllowedWei = (originalPriceWei * 150n) / 100n;
                  if (BigInt(normalizedPriceWei) > maxAllowedWei) {
                    const message = `Price exceeds maximum allowed (${maxAllowedWei.toString()} wei)`;
                    setListingError(message);
                    showListingPopup("error", `Listing failed: ${message}`);
                    return;
                  }

                  try {
                    if (!user?.walletAddress) {
                      await connectWallet();
                      showListingPopup(
                        "success",
                        "Wallet connected. Please click Confirm again.",
                      );
                      return;
                    }

                    if (!walletProvider?.request) {
                      throw new Error(
                        "Wallet provider is not ready. Please reconnect wallet and try again.",
                      );
                    }

                    if (!listingTicket._id) {
                      throw new Error("Ticket ID is missing");
                    }

                    setListingLoading(true);

                    const result = await listTicketOnchain(
                      walletProvider,
                      {
                        ticketId: listingTicket._id,
                        price: normalizedPriceWei,
                      },
                      user.walletAddress,
                    );
                    showListingPopup(
                      "success",
                      `Ticket listed on-chain. Tx: ${result.txHash}`,
                    );
                    setTickets((prevTickets) =>
                      prevTickets.map((ticket) =>
                        ticket._id === listingTicket._id
                          ? { ...ticket, isListed: true }
                          : ticket,
                      ),
                    );
                    setListingTicket(null);
                    setListingPrice("");
                  } catch (err: any) {
                    const message = err?.message || "Failed to list ticket";
                    setListingError(message);
                    showListingPopup("error", `Listing failed: ${message}`);
                  } finally {
                    setListingLoading(false);
                  }
                }}
              >
                {listingLoading ? "Listing..." : "Confirm"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setListingTicket(null);
                  setListingPrice("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {cancelTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-[340px]">
            <h3 className="text-white mb-2 font-semibold">Cancel Listing</h3>
            <p className="text-slate-300 text-sm mb-4">
              Are you sure you want to cancel listing for ticket #
              {cancelTicket.tokenId}?
            </p>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={cancelLoading}
                onClick={async () => {
                  try {
                    if (!user?.walletAddress) {
                      await connectWallet();
                      showListingPopup(
                        "success",
                        "Wallet connected. Please click Confirm again.",
                      );
                      return;
                    }

                    if (!walletProvider?.request) {
                      throw new Error(
                        "Wallet provider is not ready. Please reconnect wallet and try again.",
                      );
                    }

                    setCancelLoading(true);

                    const listingId =
                      await resolveActiveListingIdByTicket(cancelTicket);

                    if (!listingId) {
                      throw new Error("Listing not found");
                    }

                    const result = await cancelListingOnchain(
                      walletProvider,
                      listingId,
                      user.walletAddress,
                    );

                    setTickets((prevTickets) =>
                      prevTickets.map((ticket) =>
                        ticket._id === cancelTicket._id
                          ? { ...ticket, isListed: false }
                          : ticket,
                      ),
                    );
                    showListingPopup(
                      "success",
                      `Cancelled on-chain listing for ticket #${cancelTicket.tokenId}. Tx: ${result.txHash}`,
                    );
                    setCancelTicket(null);
                  } catch (err: any) {
                    const message = err?.message || "Failed to cancel listing";
                    showListingPopup("error", `Cancel failed: ${message}`);
                  } finally {
                    setCancelLoading(false);
                  }
                }}
              >
                {cancelLoading ? "Cancelling..." : "Confirm"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={cancelLoading}
                onClick={() => setCancelTicket(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
