import React from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ShieldAlert, DatabaseZap, EyeOff, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/card';

const items = [
  {
    title: 'Information we use',
    body:
      'We may process wallet addresses, transaction metadata, page interactions, and other information needed to operate the platform and improve the user experience.',
  },
  {
    title: 'How we use it',
    body:
      'Data is used to display event ownership, validate ticket activity, support purchases, and maintain service security and debugging workflows.',
  },
  {
    title: 'Blockchain data',
    body:
      'Ticket ownership and related transactions may be recorded on public blockchains. That data can be visible to anyone by design and may not be erasable.',
  },
  {
    title: 'Sharing',
    body:
      'We do not sell your personal data. Some information may be shared with infrastructure providers, wallet services, or legal authorities when required.',
  },
  {
    title: 'Security',
    body:
      'We use technical and organizational safeguards to reduce risk, but no digital system is completely secure. Keep your wallet credentials private at all times.',
  },
  {
    title: 'Your choices',
    body:
      'You can stop using the platform at any time. For questions about data handling or removal requests where applicable, contact the team through the site channels.',
  },
];

export const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-emerald-950/10 to-slate-950">
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 right-10 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
          <div className="absolute top-10 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[720px] h-[380px] bg-gradient-radial from-emerald-500/10 via-transparent to-transparent rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 mb-6 text-emerald-200">
              <LockKeyhole className="w-4 h-4" />
              <span className="text-sm font-medium">Privacy notice</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Privacy Policy
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 leading-relaxed max-w-2xl">
              This page explains what EventChain collects, why it is processed, and how blockchain activity affects privacy on the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="relative py-10 sm:py-12 lg:py-16 bg-gradient-to-b from-transparent via-slate-950/40 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 items-start">
            <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-5 sm:p-6 lg:p-8 lg:sticky lg:top-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
                <EyeOff className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Privacy by design</h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                We aim to minimize the data we handle while still delivering secure ticketing, account access, and event discovery features.
              </p>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <DatabaseZap className="w-4 h-4 text-emerald-400" />
                  Limited platform-side data processing
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  Public-chain visibility for transactions
                </div>
              </div>
              <div className="mt-6">
                <Link to="/terms" className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition-colors">
                  Review the terms
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </Card>

            <div className="grid gap-4">
              {items.map((item) => (
                <Card
                  key={item.title}
                  className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-5 sm:p-6 lg:p-7"
                >
                  <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white mb-3 leading-snug">
                    {item.title}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{item.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
