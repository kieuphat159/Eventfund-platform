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
import { getUserTickets, type ApiTicket } from "../../services/tickets.service";
import { listTicket } from "@/app/services/listings.service";
import { QRCodeCanvas } from "qrcode.react";
import { ethers, formatEther } from "ethers";

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

export const MyTickets: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ApiTicket | null>(null);
  const walletAddress = user?.walletAddress?.trim();
  const [listingTicket, setListingTicket] = useState<ApiTicket | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingLoading, setListingLoading] = useState(false);

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

  const formatEth = (wei: string | bigint | number) => {
    if (!wei || wei === "0" || wei === "0x0") return "0";

    try {
      // formatEther nhận string hoặc bigint
      const ethString = formatEther(wei.toString());

      return parseFloat(ethString)
        .toFixed(3)
        .replace(/\.?0+$/, "");
    } catch (error) {
      return "0";
    }
  };
  // Test thử:
  console.log(formatEth("1500000000000000000")); // "1.5"
  console.log(formatEth("2000000000000000")); // "0.002"
  console.log(formatEth(1000000000000000000n)); // "1" (Hỗ trợ cả BigInt)

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

  return (
    <div className="space-y-6">
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
              {formatEth(totalValue)} ETH
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
                      {formatEth(purchasePrice)} ETH
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
                    className="border-slate-700 hover:bg-slate-800"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 hover:bg-slate-800"
                    onClick={() => downloadTicketQR(ticket)}
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

                <Button
                  className="w-full mt-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  onClick={() => {
                    setListingTicket(ticket);
                    setListingError(null);
                    setListingPrice("");
                  }}
                >
                  List on Marketplace
                </Button>
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

            <input
              type="number"
              placeholder="Enter price (ETH)"
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

                  if (!listingPrice || Number(listingPrice) <= 0) {
                    setListingError("Price must be greater than 0");
                    return;
                  }

                  try {
                    setListingLoading(true);

                    await listTicket({
                      ticketId: listingTicket._id,
                      price: ethers.parseEther(listingPrice).toString(),
                      expiresAt: new Date(
                        Date.now() + 7 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                    });
                    setListingTicket(null);
                    setListingPrice("");
                  } catch (err: any) {
                    setListingError(err.message || "Failed to list ticket");
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
    </div>
  );
};
