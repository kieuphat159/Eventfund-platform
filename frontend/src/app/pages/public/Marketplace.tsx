import React from "react";
import {
  ShoppingCart,
  Zap,
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Calendar,
  Ticket,
} from "lucide-react";
import { useNavigate } from "react-router";
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

export const Marketplace: React.FC = () => {
  const [showFilters, setShowFilters] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [priceRange, setPriceRange] = React.useState([0, 10]);
  const [selectedTicketType, setSelectedTicketType] = React.useState("all");
  const [selectedLocation, setSelectedLocation] = React.useState("all");
  const [selectedAvailability, setSelectedAvailability] = React.useState("all");
  const [selectedDate, setSelectedDate] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("newest");

  const [listings, setListings] = React.useState<ApiListing[]>([]);
  console.log("Fetched listings:", listings);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await listingService.getAll();
        setListings(res.docs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  const clearFilters = () => {
    setSearchQuery("");
    setPriceRange([0, 10]);
    setSelectedTicketType("all");
    setSelectedLocation("all");
    setSelectedAvailability("all");
    setSelectedDate("all");
    setSortBy("newest");
  };

  const activeFiltersCount = [
    searchQuery !== "",
    priceRange[0] !== 0 || priceRange[1] !== 10,
    selectedTicketType !== "all",
    selectedLocation !== "all",
    selectedAvailability !== "all",
    selectedDate !== "all",
  ].filter(Boolean).length;
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="text-white p-10 text-center">Loading marketplace...</div>
    );
  }

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
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="newest">New Listings</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Popular Events</SelectItem>
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
                        min={0}
                        max={10}
                        step={0.1}
                        value={priceRange}
                        onValueChange={setPriceRange}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">
                        {priceRange[0].toFixed(1)} ETH
                      </span>
                      <span className="text-slate-400">
                        {priceRange[1].toFixed(1)} ETH
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
                      <SelectContent className="bg-slate-800 border-slate-700">
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
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="general">
                          General Admission
                        </SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="early-bird">Early Bird</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location */}
                  <div className="space-y-3">
                    <Label className="text-slate-300 font-medium flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-orange-400" />
                      Location
                    </Label>
                    <Select
                      value={selectedLocation}
                      onValueChange={setSelectedLocation}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all">All Locations</SelectItem>
                        <SelectItem value="new-york">New York, NY</SelectItem>
                        <SelectItem value="los-angeles">
                          Los Angeles, CA
                        </SelectItem>
                        <SelectItem value="san-francisco">
                          San Francisco, CA
                        </SelectItem>
                        <SelectItem value="miami">Miami, FL</SelectItem>
                        <SelectItem value="chicago">Chicago, IL</SelectItem>
                        <SelectItem value="austin">Austin, TX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Availability */}
                  <div className="space-y-3">
                    <Label className="text-slate-300 font-medium">
                      Availability
                    </Label>
                    <Select
                      value={selectedAvailability}
                      onValueChange={setSelectedAvailability}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all">All Tickets</SelectItem>
                        <SelectItem value="available">Available Now</SelectItem>
                        <SelectItem value="low-stock">Low Stock</SelectItem>
                        <SelectItem value="last-chance">Last Chance</SelectItem>
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
                        {selectedLocation !== "all" && (
                          <Badge className="bg-orange-600/10 text-orange-400 border-orange-500/20">
                            {selectedLocation}
                          </Badge>
                        )}
                        {selectedDate !== "all" && (
                          <Badge className="bg-cyan-600/10 text-cyan-400 border-cyan-500/20">
                            {selectedDate}
                          </Badge>
                        )}
                        {selectedAvailability !== "all" && (
                          <Badge className="bg-pink-600/10 text-pink-400 border-pink-500/20">
                            {selectedAvailability}
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
          {listings.map((listing) => (
            <div
              key={listing.id}
              onClick={() => navigate(`/tickets/${listing.id}`)}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer"
            >
              <div className="aspect-video overflow-hidden relative">
                <ImageWithFallback
                  src={listing.eventId.imageUrls[0] || "/placeholder.png"}
                  alt={listing.eventId.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>For Sale</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {listing.eventId.title}
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  {listing.ticketId.ticketType}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Seller</p>
                    <p className="text-sm text-slate-300 font-mono">
                      {listing.seller.slice(0, 10)}...{listing.seller.slice(-4)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Price</p>
                    <p className="text-xl font-bold text-purple-400">
                      {listing.price} ETH
                    </p>
                  </div>
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/tickets/${listing.id}`);
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Buy Now
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State Placeholder */}
        {listings.length === 0 && (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No listings available
            </h3>
            <p className="text-slate-400">
              Check back later for new ticket listings
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
