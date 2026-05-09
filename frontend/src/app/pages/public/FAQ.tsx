import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircleQuestion, Ticket, Wallet, ShieldCheck, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/card';

const faqs = [
  {
    question: 'How do I buy an NFT ticket?',
    answer:
      'Connect your wallet, browse the event detail page, choose a ticket tier, and confirm the transaction in your wallet. The ticket will appear in your account after the blockchain transaction is confirmed.',
  },
  {
    question: 'Can I resell my ticket?',
    answer:
      'Yes. If the organizer allows transfers or resale for that event, you can list the NFT ticket on the marketplace and transfer ownership securely on-chain.',
  },
  {
    question: 'Which wallet is supported?',
    answer:
      'The platform is designed for standard Web3 wallets such as MetaMask. Any wallet that supports the connected network and contract standards should work.',
  },
  {
    question: 'What happens if a payment fails?',
    answer:
      'If the wallet transaction is rejected or the blockchain call fails, the ticket is not issued and your funds remain under your wallet provider’s control. You can try again once the issue is resolved.',
  },
  {
    question: 'How do event organizers get paid?',
    answer:
      'Organizer payouts are recorded through the platform and smart contracts, so ticket proceeds are tracked transparently and can be distributed according to the event configuration.',
  },
  {
    question: 'How can I contact support?',
    answer:
      'Use the contact details in the footer or reach out through the project channels listed on the site. If you are reporting an issue, include the event link and a screenshot when possible.',
  },
];

export const FAQ: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-cyan-950/10 to-slate-950">
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-0 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 mb-6 text-cyan-200">
              <MessageCircleQuestion className="w-4 h-4" />
              <span className="text-sm font-medium">Support center</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 leading-relaxed max-w-2xl">
              Answers to the most common questions about buying, holding, and reselling NFT tickets on EventChain.
            </p>
          </div>
        </div>
      </section>

      <section className="relative py-10 sm:py-12 lg:py-16 bg-gradient-to-b from-transparent via-slate-950/40 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8 items-start">
            <div className="grid gap-4">
              {faqs.map((faq) => (
                <Card
                  key={faq.question}
                  className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-5 sm:p-6 lg:p-7"
                >
                  <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white mb-3 leading-snug">
                    {faq.question}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{faq.answer}</p>
                </Card>
              ))}
            </div>

            <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border-slate-800/50 p-5 sm:p-6 lg:p-8 lg:sticky lg:top-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/20">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Need a quick answer?</h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                If your question is about wallet setup, ticket delivery, or a failed transaction, the fastest path is to check the event page and your wallet activity first.
              </p>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  Wallet connection and network guidance
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <Ticket className="w-4 h-4 text-cyan-400" />
                  Ticket purchase, transfer, and resale
                </div>
              </div>

              <div className="mt-6">
                <Link to="/explore" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200 transition-colors">
                  Explore events
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};
