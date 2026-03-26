import React from 'react';
import { Link } from 'react-router';
import { Wallet, Ticket, TrendingUp, Shield, ArrowRight, Zap } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { mockEvents } from '../../data/mockData';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';

export const Home: React.FC = () => {
  const { connectWallet, isLoading } = useAuth();

  const features = [
    {
      icon: Ticket,
      title: 'NFT Tickets',
      description: 'Own your tickets as unique NFTs with verifiable authenticity.',
    },
    {
      icon: TrendingUp,
      title: 'Invest in Events',
      description: 'Support events and earn returns based on their success.',
    },
    {
      icon: Shield,
      title: 'Secure Marketplace',
      description: 'Buy and sell tickets safely on our blockchain-powered marketplace.',
    },
  ];

  const steps = [
    { number: '01', title: 'Connect Wallet', description: 'Link your Web3 wallet to get started' },
    { number: '02', title: 'Explore Events', description: 'Browse upcoming events and ticket tiers' },
    { number: '03', title: 'Purchase NFT Tickets', description: 'Buy tickets as unique NFTs' },
    { number: '04', title: 'Trade or Invest', description: 'Resell tickets or invest in events' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Gradient Orbs Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large Purple Orb - Top Left */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />

          {/* Large Blue Orb - Top Right */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />

          {/* Medium Purple Orb - Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />

          {/* Small Accent Orbs */}
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl" />
          <div className="absolute bottom-1/4 left-1/3 w-40 h-40 bg-pink-500/15 rounded-full blur-3xl" />
        </div>

        {/* Blockchain Network Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM4YjVjZjYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptLTYgMHYyaC0ydi0yaDF6bS02IDB2MmgtMnYtMmgyem0tNiAwdjJoLTJ2LTJoMnptMjQtNnYyaC0ydi0yaDJ6bS02IDB2MmgtMnYtMmgyem0tNiAwdjJoLTJ2LTJoMnptLTYgMHYyaC0ydi0yaDF6bS02IDB2MmgtMnYtMmgyem0tNiAwdjJoLTJ2LTJoMnptLTYgMHYyaC0ydi0yaDF6bS02IDB2MmgtMnYtMmgyem0yNC02djJoLTJ2LTJoMnptLTYgMHYyaC0ydi0yaDF6bS02IDB2MmgtMnYtMmgyem0tNiAwdjJoLTJ2LTJoMnptLTYgMHYyaC0ydi0yaDF6bS02IDB2MmgtMnYtMmgyem0tNiAwdjJoLTJ2LTJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />

        {/* Radial Gradient Glow Behind Headline */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent rounded-full blur-2xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Powered by Blockchain Technology</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold mb-6 relative">
              {/* Glow effect behind text */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 blur-3xl -z-10" />

              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-pulse" style={{ animationDuration: '3s' }}>
                The Future of Events
              </span>
              <br />
              <span className="text-white">Built on Web3</span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Buy, sell, and invest in event tickets as NFTs. Experience a new era of event participation with blockchain security.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={connectWallet}
                disabled={isLoading}
                className="px-8 text-lg h-12"
              >
                <Wallet className="w-5 h-5 mr-2" />
                {isLoading ? 'Đang kết nối...' : 'Connect Wallet'}
              </Button>
              <Link to="/explore">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 hover:bg-slate-800 text-white px-8 text-lg h-12 w-full"
                >
                  Explore Events
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20 bg-gradient-to-b from-slate-950 via-indigo-950/10 to-slate-950">
        {/* Subtle Background Orbs */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Why EventChain?</h2>
            <p className="text-xl text-slate-400">Experience the next generation of event ticketing</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300"
              >
                {/* Card Glow Effect on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:to-blue-600/5 rounded-2xl transition-all duration-300" />

                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="relative py-20 bg-gradient-to-b from-slate-950 via-blue-950/10 to-slate-950">
        {/* Subtle Background Effects */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-1/3 left-10 w-72 h-72 bg-blue-600/25 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-10 w-72 h-72 bg-cyan-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">Featured Events</h2>
              <p className="text-slate-400">Discover upcoming experiences</p>
            </div>
            <Link to="/explore">
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
                View All
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockEvents.filter(e => e.status === 'approved').slice(0, 4).map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group relative bg-gradient-to-br from-slate-900/80 to-slate-950 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all duration-300"
              >
                {/* Card Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-600/0 via-transparent to-transparent group-hover:from-purple-600/10 transition-all duration-300 pointer-events-none" />
                <div className="aspect-[4/3] overflow-hidden">
                  <ImageWithFallback
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{event.description}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{event.location}</span>
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-20 bg-gradient-to-b from-slate-950 via-violet-950/10 to-slate-950">
        {/* Subtle Background Orbs */}
        <div className="absolute inset-0 overflow-hidden opacity-25">
          <div className="absolute top-10 left-1/3 w-56 h-56 bg-violet-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/3 w-56 h-56 bg-purple-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-xl text-slate-400">Get started in 4 simple steps</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="group relative bg-gradient-to-br from-slate-900/70 to-slate-900/30 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300">
                  {/* Step Card Glow on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:to-blue-600/5 rounded-2xl transition-all duration-300" />

                  <div className="relative">
                    <div className="text-5xl font-bold bg-gradient-to-br from-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
                      {step.number}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-500/50 to-blue-500/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 border-y border-purple-500/10">
        {/* Glow Effects for CTA */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-pink-600/15 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of users experiencing the future of event ticketing
          </p>
          <Button
            size="lg"
            onClick={connectWallet}
            disabled={isLoading}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-12 text-lg h-14"
          >
            <Wallet className="w-5 h-5 mr-2" />
            {isLoading ? 'Đang kết nối...' : 'Connect Your Wallet'}
          </Button>
        </div>
      </section>
    </div>
  );
};