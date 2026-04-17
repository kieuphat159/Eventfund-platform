import React from "react";
import {
  ShoppingCart,
  Zap,
  Search,
  SlidersHorizontal,
  X,
  Calendar,
  Ticket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { ethers } from "ethers";

export const Marketplace: React.FC = () => {
  const [showFilters, setShowFilters] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [priceRange, setPriceRange] = React.useState([0.01, 10]); // UI
  const [appliedPriceRange, setAppliedPriceRange] = React.useState([0.01, 10]); // dùng gọi API
  const [selectedTicketType, setSelectedTicketType] = React.useState("all");
  const [selectedDate, setSelectedDate] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("newest");

  const [listings, setListings] = React.useState<ApiListing[]>([]);
  console.log("Fetched listings:", listings);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);

        const sortMap: Record<string, any> = {
          newest: { sortBy: "listedAt", sortOrder: "desc" },
          "price-low": { sortBy: "price", sortOrder: "asc" },
          "price-high": { sortBy: "price", sortOrder: "desc" },
        };

        const res = await listingService.getAll({
          page: 1,
          limit: 20,
          minPrice: ethers
            .parseEther(appliedPriceRange[0].toString())
            .toString(),
          maxPrice: ethers
            .parseEther(appliedPriceRange[1].toString())
            .toString(),
          ...sortMap[sortBy],
        });

        setListings(res.docs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [appliedPriceRange, sortBy]);

  const clearFilters = () => {
    setSearchQuery("");
    setPriceRange([0, 10]);
    setSelectedTicketType("all");
    setSelectedDate("all");
    setSortBy("newest");
  };

  const activeFiltersCount = [
    searchQuery !== "",
    priceRange[0] !== 0.01 || priceRange[1] !== 10,
    selectedTicketType !== "all",
    selectedDate !== "all",
  ].filter(Boolean).length;
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="text-white p-10 text-center">Loading marketplace...</div>
    );
  }

  const filteredListings = listings.filter((listing) => {
    const eventTitle = listing.eventId?.title?.toLowerCase() || "";
    const matchesSearch = eventTitle.includes(searchQuery.toLowerCase());

    const ticketType = listing.ticketId?.ticketType;
    const matchesTicketType =
      selectedTicketType === "all" ? true : ticketType === selectedTicketType;

    return matchesSearch && matchesTicketType;
  });

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            NFT Ticket Marketplace
          </h1>
          <p className="text-slate-400">
            Buy and sell event tickets securely on the blockchain
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-8 space-y-4">
          {/* Search Bar and Toggle Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by event name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 h-12"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="md:w-64">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-slate-900 border-slate-800 text-white h-12">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="newest">New Listings</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Filters Button */}
            <Button
              variant="outline"
              className="border-slate-800 text-white hover:bg-slate-800 h-12"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-purple-600 text-white">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <SlidersHorizontal className="w-5 h-5 mr-2 text-purple-400" />
                    Filter Options
                  </h3>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Price Range Slider */}
                  <div className="space-y-3">
                    <Label className="text-slate-300 font-medium">
                      Price Range (ETH)
                    </Label>
                    <div className="pt-2">
                      <Slider
                        min={0.01}
                        max={10}
                        step={0.01}
                        value={priceRange}
                        onValueChange={setPriceRange} // kéo mượt
                        onValueCommit={(value) => setAppliedPriceRange(value)} // thả chuột mới call
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">
                        {priceRange[0].toFixed(2)} ETH
                      </span>
                      <span className="text-slate-400">
                        {priceRange[1].toFixed(2)} ETH
                      </span>
                    </div>
                  </div>

                  {/* Event Date */}
                  <div className="space-y-3">
                    <Label className="text-slate-300 font-medium flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                      Event Date
                    </Label>
                    <Select
                      value={selectedDate}
                      onValueChange={setSelectedDate}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="tomorrow">Tomorrow</SelectItem>
                        <SelectItem value="this-week">This Week</SelectItem>
                        <SelectItem value="this-month">This Month</SelectItem>
                        <SelectItem value="next-month">Next Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ticket Type */}
                  <div className="space-y-3">
                    <Label className="text-slate-300 font-medium flex items-center">
                      <Ticket className="w-4 h-4 mr-2 text-green-400" />
                      Ticket Type
                    </Label>
                    <Select
                      value={selectedTicketType}
                      onValueChange={setSelectedTicketType}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="early-bird">Early Bird</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Active Filters Display */}
                  {activeFiltersCount > 0 && (
                    <div className="space-y-3">
                      <Label className="text-slate-300 font-medium">
                        Active Filters
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {searchQuery && (
                          <Badge className="bg-purple-600/10 text-purple-400 border-purple-500/20">
                            Search: {searchQuery}
                          </Badge>
                        )}
                        {(priceRange[0] !== 0 || priceRange[1] !== 10) && (
                          <Badge className="bg-green-600/10 text-green-400 border-green-500/20">
                            {priceRange[0]}-{priceRange[1]} ETH
                          </Badge>
                        )}
                        {selectedTicketType !== "all" && (
                          <Badge className="bg-blue-600/10 text-blue-400 border-blue-500/20">
                            {selectedTicketType}
                          </Badge>
                        )}
                        {selectedDate !== "all" && (
                          <Badge className="bg-cyan-600/10 text-cyan-400 border-cyan-500/20">
                            {selectedDate}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-slate-400">
              Showing{" "}
              <span className="text-white font-semibold">
                {listings.length}
              </span>{" "}
              listings
            </p>
            {activeFiltersCount > 0 && (
              <p className="text-sm text-slate-500">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}{" "}
                applied
              </p>
            )}
          </div>
        </div>

        {/* Marketplace Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => {
            const listingId = listing.id || listing._id;
            const eventTitle = listing.eventId?.title || "Untitled event";
            const eventImage = listing.eventId?.imageUrls?.[0] || "/placeholder.png";
            const ticketType = listing.ticketId?.ticketType || "Unknown ticket type";
            const seller = listing.seller || "Unknown seller";

            let formattedPrice = "0";
            try {
              formattedPrice = ethers.formatEther(listing.price || "0");
            } catch {
              formattedPrice = "0";
            }

            return (
              <div
                key={listingId}
                onClick={() => navigate(`/tickets/${listingId}`)}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer"
              >
                <div className="aspect-video overflow-hidden relative">
                  <ImageWithFallback
                    src={eventImage}
                    alt={eventTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                    <Zap className="w-3 h-3" />
                    <span>For Sale</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {eventTitle}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    {ticketType}
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Seller</p>
                      <p className="text-sm text-slate-300 font-mono">
                        {seller.length > 14
                          ? `${seller.slice(0, 10)}...${seller.slice(-4)}`
                          : seller}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Price</p>
                      <p className="text-xl font-bold text-purple-400">
                        {formattedPrice} ETH
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/tickets/${listingId}`);
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Buy Now
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State Placeholder */}
        {filteredListings.length === 0 && (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No listings found
            </h3>
            <p className="text-slate-400">
              Try adjusting your filters or check back later for new listings
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
