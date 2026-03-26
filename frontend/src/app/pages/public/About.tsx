import React from 'react';
import { Link } from 'react-router';
import { 
  Wallet, 
  Shield, 
  Repeat, 
  Ticket, 
  ShoppingBag, 
  CheckCircle,
  Blocks,
  FileCode,
  ArrowRight,
  Target,
  Eye,
  TrendingUp
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export const About: React.FC = () => {
  const steps = [
    {
      icon: Ticket,
      title: 'Create Event',
      description: 'Event organizers create events and mint NFT tickets on the blockchain with customizable metadata and pricing.',
    },
    {
      icon: ShoppingBag,
      title: 'Buy NFT Ticket',
      description: 'Users purchase tickets as NFTs using their Web3 wallet. Each ticket is unique and verifiable on-chain.',
    },
    {
      icon: CheckCircle,
      title: 'Verify Entry',
      description: 'Verifiers scan and validate NFT tickets at the event entrance. No fraud, no duplicates, just secure entry.',
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: 'Secure',
      description: 'Blockchain-powered security ensures tickets cannot be counterfeited or duplicated.',
    },
    {
      icon: Blocks,
      title: 'Transparent',
      description: 'All transactions are recorded on-chain, providing complete transparency and traceability.',
    },
    {
      icon: Repeat,
      title: 'Resellable',
      description: 'NFT tickets can be resold on the marketplace with automated royalties for event creators.',
    },
  ];

  const techStack = [
    {
      icon: Blocks,
      name: 'Blockchain',
      description: 'Built on Ethereum for decentralized and immutable ticket records.',
    },
    {
      icon: FileCode,
      name: 'Smart Contracts',
      description: 'ERC-721 NFT contracts handle ticket minting, transfers, and verification.',
    },
    {
      icon: Wallet,
      name: 'Web3 Wallet',
      description: 'MetaMask integration for secure authentication and transactions.',
    },
  ];

  const team = [
    {
      name: 'Alex Chen',
      role: 'CEO & Founder',
      bio: 'Blockchain enthusiast with 10+ years in event tech.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    },
    {
      name: 'Sarah Johnson',
      role: 'CTO',
      bio: 'Smart contract architect and Web3 security expert.',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    },
    {
      name: 'Marcus Rodriguez',
      role: 'Lead Designer',
      bio: 'UI/UX designer specializing in Web3 experiences.',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    },
    {
      name: 'Emily Park',
      role: 'Head of Marketing',
      bio: 'Growth strategist bridging Web2 and Web3 communities.',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-24">
        {/* Background Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute -top-20 right-10 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                About EventChain
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              The future of event ticketing powered by blockchain technology.
              EventChain is revolutionizing how events are managed, tickets are sold,
              and attendees experience live entertainment.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="relative py-16 lg:py-20 bg-gradient-to-b from-transparent via-indigo-950/10 to-transparent">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Mission */}
            <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-8 lg:p-10">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
              <p className="text-slate-300 leading-relaxed">
                To eliminate ticket fraud and create a transparent, secure ecosystem where event 
                organizers, attendees, and investors can participate in the live entertainment 
                industry with confidence. We're building the infrastructure for the next generation 
                of event experiences.
              </p>
            </Card>

            {/* Vision */}
            <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-8 lg:p-10">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Our Vision</h2>
              <p className="text-slate-300 leading-relaxed">
                A world where every event ticket is an NFT, enabling true ownership, seamless 
                transfers, and complete transparency. EventChain will become the global standard 
                for event ticketing, bringing Web3 innovation to mainstream audiences worldwide.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Description */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            NFT-Based Event Ticket Marketplace
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed mb-6">
            EventChain combines the power of blockchain technology with the events industry
            to create a secure, transparent, and efficient ticket marketplace. Every ticket
            is an NFT, providing proof of ownership and enabling seamless resale without fraud.
          </p>
          <p className="text-lg text-slate-300 leading-relaxed">
            Whether you're an event organizer looking to eliminate ticket fraud, an attendee
            seeking authentic tickets, or an investor interested in event opportunities,
            EventChain provides the tools and infrastructure you need.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-16 lg:py-20 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-10 left-1/3 w-56 h-56 bg-violet-600/25 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/3 w-56 h-56 bg-purple-600/25 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Three simple steps to experience the future of event ticketing
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <Card key={index} className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-8 text-center group hover:border-purple-500/50 transition-all duration-300">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-shadow">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className="text-sm font-semibold text-purple-400">STEP {index + 1}</span>
                    <h3 className="text-xl font-bold text-white mt-2">{step.title}</h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="relative py-16 lg:py-20 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-1/3 left-10 w-72 h-72 bg-blue-600/25 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-10 w-72 h-72 bg-cyan-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Key Features</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Why EventChain is the future of ticketing
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="group relative bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-8 hover:border-purple-500/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:to-blue-600/5 rounded-lg transition-all duration-300" />
                
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                    <benefit.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{benefit.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="relative py-16 lg:py-20 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-purple-600/25 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-pink-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Technology Stack</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Built on cutting-edge Web3 technologies
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {techStack.map((tech, index) => (
              <Card 
                key={index} 
                className="group bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-8 hover:border-purple-500/50 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:to-blue-600/5 rounded-lg transition-all duration-300" />
                
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-purple-600/30">
                    <tech.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{tech.name}</h3>
                  <p className="text-slate-400 leading-relaxed">{tech.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="relative py-16 lg:py-20 bg-gradient-to-b from-transparent via-indigo-950/10 to-transparent">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-indigo-600/25 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-purple-600/25 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Meet Our Team</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              The passionate people building the future of event ticketing
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <Card key={index} className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
                <div className="aspect-square overflow-hidden bg-slate-800">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-1">{member.name}</h3>
                  <p className="text-sm text-purple-400 mb-3">{member.role}</p>
                  <p className="text-sm text-slate-400">{member.bio}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 lg:py-20 bg-gradient-to-b from-transparent via-purple-950/20 to-transparent">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-pink-600/15 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-6 shadow-lg shadow-purple-500/30">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
            Ready to Experience the Future?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Join thousands of event-goers and organizers using EventChain to revolutionize live entertainment
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 text-lg h-12"
            >
              <Link to="/explore">
                Explore Events
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-slate-700 hover:bg-slate-800 text-white px-8 text-lg h-12"
            >
              <Link to="/marketplace">
                Visit Marketplace
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
