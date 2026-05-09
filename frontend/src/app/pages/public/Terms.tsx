import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Shield, Scale, CalendarClock, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/card';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body:
      'By accessing EventChain, you agree to these terms and any platform policies referenced here. If you do not agree, do not use the platform.',
  },
  {
    title: '2. User Accounts and Wallets',
    body:
      'You are responsible for the security of your wallet, private keys, and any actions taken from your connected account. EventChain does not store private keys.',
  },
  {
    title: '3. Ticket Purchases',
    body:
      'Ticket availability, pricing, resale rules, and refund conditions are set by the event organizer and smart contract configuration for the event.',
  },
  {
    title: '4. Marketplace Activity',
    body:
      'If resale is enabled, you may list eligible tickets in accordance with the platform rules. Fraudulent listings, impersonation, and manipulation of ticket flow are prohibited.',
  },
  {
    title: '5. Service Availability',
    body:
      'The platform depends on third-party infrastructure, blockchain networks, and wallet providers. We do not guarantee uninterrupted availability or transaction finality times.',
  },
  {
    title: '6. Contact',
    body:
      'Questions about these terms can be raised through the support links in the footer or by contacting the EventChain team through the project channels.',
  },
];

export const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-amber-950/10 to-slate-950">
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-36 left-10 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[720px] h-[380px] bg-gradient-radial from-amber-500/10 via-transparent to-transparent rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 mb-6 text-amber-200">
              <Scale className="w-4 h-4" />
              <span className="text-sm font-medium">Legal information</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Terms of Service
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 leading-relaxed max-w-2xl">
              These terms explain how EventChain works, what you are responsible for, and the rules that apply when you use the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="relative py-10 sm:py-12 lg:py-16 bg-gradient-to-b from-transparent via-slate-950/40 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 items-start">
            <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-5 sm:p-6 lg:p-8 lg:sticky lg:top-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Summary</h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                EventChain provides NFT-based ticketing infrastructure. You keep control of your wallet, while organizers define event-specific rules for access, resale, and refunds.
              </p>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Secure wallet-based access
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <CalendarClock className="w-4 h-4 text-amber-400" />
                  Organizer-defined event policies
                </div>
              </div>
              <div className="mt-6">
                <Link to="/privacy" className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200 transition-colors">
                  Read the privacy policy
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </Card>

            <div className="grid gap-4">
              {sections.map((section) => (
                <Card
                  key={section.title}
                  className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-5 sm:p-6 lg:p-7"
                >
                  <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white mb-3 leading-snug">
                    {section.title}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{section.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
