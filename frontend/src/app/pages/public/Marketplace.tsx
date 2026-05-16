import React from "react";
import {
  ShoppingCart,
  Search,
  SlidersHorizontal,
  X,
  Calendar,
  Ticket,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Slider } from "../../components/ui/slider";
import { Card, CardContent } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { listingService, ApiListing } from "../../services/listings.service";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { logger } from "../../lib/logger";

const formatWei = (value?: string | number | bigint) => {
  try {
    return BigInt(String(value ?? "0")).toLocaleString();
  } catch {
    return "0";
  }
};

export const Marketplace: React.FC = () => {
  const [showFilters, setShowFilters] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [priceLimit, setPriceLimit] = React.useState([10]);
  const [appliedPriceLimit, setAppliedPriceLimit] = React.useState(10);
  const [selectedTicketType, setSelectedTicketType] = React.useState("all");
  const [selectedDate, setSelectedDate] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("newest");
  const [listings, setListings] = React.useState<ApiListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const sliderMax = 10;
  const selectedMaxPrice = priceLimit[0] ?? sliderMax;
  const sliderProgress = (selectedMaxPrice / sliderMax) * 100;

  React.useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);

        const sortMap: Record<string, { sortBy: string; sortOrder: "asc" | "desc" }> = {
          newest: { sortBy: "listedAt", sortOrder: "desc" },
          "price-low": { sortBy: "price", sortOrder: "asc" },
          "price-high": { sortBy: "price", sortOrder: "desc" },
        };

        const res = await listingService.getAll({
          page: 1,
          limit: 20,
          maxPrice: ethers.parseEther(appliedPriceLimit.toString()).toString(),
          ...sortMap[sortBy],
        });

        setListings(res.docs);
      } catch (err) {
        logger.error("marketplace", "Failed to load listings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [appliedPriceLimit, sortBy]);

  const clearFilters = () => {
    setSearchQuery("");
    setPriceLimit([sliderMax]);
    setAppliedPriceLimit(sliderMax);
    setSelectedTicketType("all");
    setSelectedDate("all");
    setSortBy("newest");
  };

  const activeFiltersCount = [
    searchQuery !== "",
    appliedPriceLimit !== sliderMax,
    selectedTicketType !== "all",
    selectedDate !== "all",
  ].filter(Boolean).length;

  const filteredListings = listings.filter((listing) => {
    const eventTitle = listing.eventId?.title?.toLowerCase() || "";
    const matchesSearch = eventTitle.includes(searchQuery.toLowerCase());
    const ticketType = listing.ticketId?.ticketType;
    const matchesTicketType =
      selectedTicketType === "all" ? true : ticketType === selectedTicketType;

    return matchesSearch && matchesTicketType;
  });

  return (
    <div className="min-h-screen bg-slate-950 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.2),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,1),_rgba(17,24,39,0.96))] p-5 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm uppercase tracking-[0.28em] text-cyan-300/80">
                Secondary Market
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                Discover verified NFT ticket listings
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                Browse live resale opportunities, compare prices quickly, and
                purchase blockchain-backed tickets with a cleaner mobile-first
                experience.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Live listings
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {listings.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Filters active
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {activeFiltersCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by event name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 border-slate-800 bg-slate-900 pl-10 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="md:w-64">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-12 border-slate-800 bg-slate-900 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-white">
                  <SelectItem value="newest">New Listings</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="h-12 border-slate-800 text-white hover:bg-slate-800"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-purple-600 text-white">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <Card className="border-slate-800 bg-slate-900">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="flex items-center text-lg font-semibold text-white">
                    <SlidersHorizontal className="mr-2 h-5 w-5 text-purple-400" />
                    Filter Options
                  </h3>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="self-start text-slate-400 hover:text-white"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-3 xl:col-span-2">
                    <Label className="font-medium text-slate-300">
                      Max Price (ETH)
                    </Label>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="relative px-2 pt-8">
                        <div
                          className="pointer-events-none absolute top-0 z-10 min-w-[88px] -translate-x-1/2 rounded-full border border-cyan-400/30 bg-slate-900 px-3 py-1.5 text-center text-sm font-semibold leading-none text-cyan-200 shadow-lg"
                          style={{ left: `calc(${sliderProgress}% * 0.96 + 8px)` }}
                        >
                          {selectedMaxPrice.toFixed(2)} ETH
                        </div>
                      </div>
                      <Slider
                        min={0}
                        max={sliderMax}
                        step={0.01}
                        value={priceLimit}
                        onValueChange={setPriceLimit}
                        onValueCommit={(value) =>
                          setAppliedPriceLimit(value[0] ?? sliderMax)
                        }
                        className="w-full"
                      />
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                        <span>0.00 ETH</span>
                        <span>{sliderMax.toFixed(2)} ETH</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center font-medium text-slate-300">
                      <Calendar className="mr-2 h-4 w-4 text-blue-400" />
                      Event Date
                    </Label>
                    <Select value={selectedDate} onValueChange={setSelectedDate}>
                      <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-800 text-white">
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="tomorrow">Tomorrow</SelectItem>
                        <SelectItem value="this-week">This Week</SelectItem>
                        <SelectItem value="this-month">This Month</SelectItem>
                        <SelectItem value="next-month">Next Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center font-medium text-slate-300">
                      <Ticket className="mr-2 h-4 w-4 text-green-400" />
                      Ticket Type
                    </Label>
                    <Select
                      value={selectedTicketType}
                      onValueChange={setSelectedTicketType}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-800 text-white">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="early-bird">Early Bird</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <div className="mt-6 space-y-3">
                    <Label className="font-medium text-slate-300">
                      Active Filters
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {searchQuery && (
                        <Badge className="border-purple-500/20 bg-purple-600/10 text-purple-400">
                          Search: {searchQuery}
                        </Badge>
                      )}
                      {appliedPriceLimit !== sliderMax && (
                        <Badge className="border-green-500/20 bg-green-600/10 text-green-400">
                          Up to {appliedPriceLimit.toFixed(2)} ETH
                        </Badge>
                      )}
                      {selectedTicketType !== "all" && (
                        <Badge className="border-blue-500/20 bg-blue-600/10 text-blue-400">
                          {selectedTicketType}
                        </Badge>
                      )}
                      {selectedDate !== "all" && (
                        <Badge className="border-cyan-500/20 bg-cyan-600/10 text-cyan-400">
                          {selectedDate}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-400">
              Showing{" "}
              <span className="font-semibold text-white">
                {filteredListings.length}
              </span>{" "}
              listings
            </p>
            {activeFiltersCount > 0 && (
              <p className="text-sm text-slate-500">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""} applied
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`marketplace-skeleton-${index}`}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90"
                >
                  <div className="aspect-video animate-pulse bg-slate-800" />
                  <div className="space-y-4 p-5 sm:p-6">
                    <div className="h-6 w-3/4 animate-pulse rounded bg-slate-800" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-slate-800" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="w-1/2 space-y-2">
                        <div className="h-3 w-16 animate-pulse rounded bg-slate-800" />
                        <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
                      </div>
                      <div className="w-24 space-y-2">
                        <div className="ml-auto h-3 w-10 animate-pulse rounded bg-slate-800" />
                        <div className="ml-auto h-6 w-20 animate-pulse rounded bg-slate-800" />
                      </div>
                    </div>
                    <div className="h-10 w-full animate-pulse rounded bg-slate-800" />
                  </div>
                </div>
              ))
            : filteredListings.map((listing) => {
            const listingId = listing.id || listing._id;
            const eventTitle = listing.eventId?.title || "Untitled event";
            const eventImage =
              listing.eventId?.imageUrls?.[0] || "/placeholder.png";
            const ticketType =
              listing.ticketId?.ticketType || "Unknown ticket type";
            const seller = listing.seller || "Unknown seller";

            return (
              <Link
                key={listingId}
                to={`/tickets/${listingId}`}
                className="cursor-pointer overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 transition-all hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10"
              >
                <div className="relative aspect-video overflow-hidden">
                  <ImageWithFallback
                    src={eventImage}
                    alt={eventTitle}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 flex items-center space-x-1 rounded-full bg-purple-600 px-2 py-1 text-xs text-white">
                    <Zap className="h-3 w-3" />
                    <span>For Sale</span>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <h3 className="mb-1 text-lg font-semibold text-white">
                    {eventTitle}
                  </h3>
                  <p className="mb-4 text-sm text-slate-400">{ticketType}</p>

                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="mb-1 text-xs text-slate-500">Seller</p>
                      <p className="break-all text-sm font-mono text-slate-300">
                        {seller.length > 14
                          ? `${seller.slice(0, 10)}...${seller.slice(-4)}`
                          : seller}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="mb-1 text-xs text-slate-500">Price</p>
                      <p className="text-xl font-bold text-purple-400">
                        {formatWei(listing.price)} wei
                      </p>
                    </div>
                  </div>

                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                  >
                    <span>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Buy Now
                    </span>
                  </Button>
                </div>
              </Link>
            );
          })}
        </div>

        {!loading && filteredListings.length === 0 && (
          <div className="py-20 text-center">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-slate-700" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No listings found
            </h3>
            <p className="text-slate-400">
              Try adjusting your filters or check back later for new listings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
