import React from 'react';
import { useParams, useNavigate, Link } from 'react-router';
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
  TrendingUp,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { mockMarketplaceListings, mockEvents } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';

export const TicketDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = React.useState(0);
  const [copiedAddress, setCopiedAddress] = React.useState(false);

  // Find the listing
  const listing = mockMarketplaceListings.find((l) => l.id === id);
  
  // Find the related event for additional details
  const event = mockEvents.find((e) => e.title === listing?.eventName);

  if (!listing || !event) {
    return (
      <div className="min-h-screen bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AlertCircle className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Listing Not Found</h2>
          <p className="text-slate-400 mb-6">The ticket listing you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/marketplace')} className="bg-gradient-to-r from-purple-600 to-blue-600">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  // Gallery images (main image + additional placeholder images)
  const galleryImages = [
    listing.image,
    'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
  ];

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleBuyNow = () => {
    if (user?.role === 'public') {
      alert('Please connect your wallet to purchase tickets');
    } else {
      alert('Purchase functionality would be integrated with smart contract here');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/marketplace')}
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
                src={galleryImages[selectedImage]}
                alt={listing.eventName}
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
                      ? 'border-purple-500 ring-2 ring-purple-500/20'
                      : 'border-slate-800 hover:border-slate-700'
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
                  <p className="text-sm text-white font-medium">{new Date(event.date).toLocaleDateString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 text-center">
                  <MapPin className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 mb-1">Location</p>
                  <p className="text-sm text-white font-medium">{event.location}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Side - Details */}
          <div className="space-y-6">
            {/* Title & Category */}
            <div>
              <Badge className="bg-purple-600/10 text-purple-400 border-purple-500/20 mb-3">
                {event.category}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {listing.eventName}
              </h1>
              <p className="text-slate-400">Verified event on EventChain</p>
            </div>

            {/* Ticket Type */}
            <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Ticket Type</p>
                    <p className="text-xl font-bold text-white">{listing.tier}</p>
                  </div>
                  <Ticket className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            {/* Price */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-5">
                <p className="text-sm text-slate-500 mb-2">Current Price</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold text-purple-400">{listing.price}</span>
                  <span className="text-xl text-slate-400">ETH</span>
                  <span className="text-sm text-slate-500 ml-2">
                    (≈ ${(listing.price * 2400).toFixed(2)} USD)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>12% below floor price</span>
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
                    {new Date(event.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">8:00 PM EST</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="w-5 h-5 text-orange-400" />
                    <p className="text-xs text-slate-500">Location</p>
                  </div>
                  <p className="text-sm text-white font-medium">{event.location}</p>
                  <p className="text-xs text-slate-400 mt-1">View on Map</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Ticket className="w-5 h-5 text-green-400" />
                    <p className="text-xs text-slate-500">Remaining</p>
                  </div>
                  <p className="text-sm text-white font-medium">1 of 1</p>
                  <p className="text-xs text-slate-400 mt-1">Unique NFT Ticket</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <p className="text-xs text-slate-500">Listed</p>
                  </div>
                  <p className="text-sm text-white font-medium">2 days ago</p>
                  <p className="text-xs text-slate-400 mt-1">Mar 7, 2026</p>
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
                        {listing.seller.slice(0, 12)}...{listing.seller.slice(-8)}
                      </p>
                      <p className="text-xs text-slate-500">18 sales • 100% positive</p>
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

            {/* Action Buttons */}
            <div className="space-y-3">
              {user?.role === 'public' ? (
                <Button
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-base font-semibold"
                  onClick={handleBuyNow}
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Connect Wallet to Buy
                </Button>
              ) : (
                <Button
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-base font-semibold"
                  onClick={handleBuyNow}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Buy Now for {listing.price} ETH
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-12 border-slate-800 text-white hover:bg-slate-800"
              >
                Make Offer
              </Button>
            </div>

            {/* Security Notice */}
            <Card className="bg-blue-900/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white font-medium mb-1">Secure Transaction</p>
                    <p className="text-xs text-slate-400">
                      All transactions are secured by smart contracts on the Ethereum blockchain.
                      Your purchase is protected by EventChain's buyer guarantee.
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
                <p className="text-slate-300 leading-relaxed mb-4">{event.description}</p>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Experience an unforgettable event that combines cutting-edge technology with world-class
                  entertainment. This exclusive ticket grants you access to all main stage performances,
                  interactive exhibits, and networking opportunities with industry leaders.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge className="bg-purple-600/10 text-purple-400 border-purple-500/20">
                    Live Performance
                  </Badge>
                  <Badge className="bg-blue-600/10 text-blue-400 border-blue-500/20">
                    Networking
                  </Badge>
                  <Badge className="bg-green-600/10 text-green-400 border-green-500/20">
                    NFT Collectible
                  </Badge>
                  <Badge className="bg-orange-600/10 text-orange-400 border-orange-500/20">
                    Food & Drinks
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
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-white">
                      {event.organizer.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">{event.organizer}</h3>
                      <Badge className="bg-green-600/10 text-green-400 border-green-500/20">
                        <BadgeCheck className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                      Professional event organizer with 50+ successful events on EventChain
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-white font-semibold">4.9</span>
                        <span className="text-slate-500"> / 5.0 rating</span>
                      </div>
                      <div className="text-slate-500">•</div>
                      <div className="text-slate-400">2,500+ attendees</div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">Organizer Wallet</p>
                  <div className="flex items-center justify-between bg-slate-950 rounded-lg p-3">
                    <code className="text-sm text-slate-300 font-mono">
                      {event.organizerWallet}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyAddress(event.organizerWallet)}
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
                      <p className="text-xs text-slate-500 mb-1">Contract Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-purple-400 font-mono">
                          0x7a250d...5392
                        </code>
                        <a
                          href="#"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Token Standard</p>
                      <p className="text-sm text-white">ERC-721</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Token ID</p>
                      <p className="text-sm text-white">#10847</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Network</p>
                      <p className="text-sm text-white">Ethereum Mainnet</p>
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
                          This ticket is issued through EventChain's audited smart contracts,
                          ensuring authenticity and secure ownership transfer.
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
                      <p className="text-sm text-white font-medium">Transferable</p>
                      <p className="text-xs text-slate-400">
                        This ticket can be resold or transferred to another wallet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">5% Royalty Fee</p>
                      <p className="text-xs text-slate-400">
                        Organizer receives 5% of resale price to support the event
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">No Price Cap</p>
                      <p className="text-xs text-slate-400">
                        Tickets can be resold at any price determined by market demand
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white font-medium">Event Entry Deadline</p>
                      <p className="text-xs text-slate-400">
                        Ticket must be in your wallet 24 hours before event to guarantee entry
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
                <h3 className="text-lg font-bold text-white mb-4">Ticket Benefits</h3>
                <ul className="space-y-3">
                  {event.ticketTiers
                    .find((t) => t.name === listing.tier)
                    ?.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-300">{benefit}</span>
                      </li>
                    ))}
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">Digital collectible NFT</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">Resale rights included</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Price History */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Price History</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Original Price</span>
                    <span className="text-sm text-white font-medium">0.5 ETH</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Floor Price</span>
                    <span className="text-sm text-white font-medium">0.68 ETH</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Last Sale</span>
                    <span className="text-sm text-white font-medium">0.55 ETH</span>
                  </div>
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Current Listing</span>
                      <span className="text-sm text-purple-400 font-bold">{listing.price} ETH</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading Activity */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Trading Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">24h Volume</span>
                    <span className="text-white font-medium">12.4 ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">7d Volume</span>
                    <span className="text-white font-medium">89.2 ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Total Sales</span>
                    <span className="text-white font-medium">247</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Owners</span>
                    <span className="text-white font-medium">156</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Related Listings */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Similar Tickets</h3>
                  <Link
                    to="/marketplace"
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {mockMarketplaceListings
                    .filter((l) => l.id !== id)
                    .slice(0, 2)
                    .map((item) => (
                      <Link
                        key={item.id}
                        to={`/tickets/${item.id}`}
                        className="flex gap-3 p-3 rounded-lg bg-slate-950 hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700"
                      >
                        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                          <ImageWithFallback
                            src={item.image}
                            alt={item.eventName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate mb-1">
                            {item.eventName}
                          </p>
                          <p className="text-xs text-slate-500 mb-2">{item.tier}</p>
                          <p className="text-sm text-purple-400 font-bold">{item.price} ETH</p>
                        </div>
                      </Link>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};