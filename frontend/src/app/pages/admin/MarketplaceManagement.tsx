import React from 'react';
import { ShoppingCart, TrendingUp, DollarSign, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockMarketplaceListings } from '../../data/mockData';

export const MarketplaceManagement: React.FC = () => {
  const stats = [
    { label: 'Total Listings', value: mockMarketplaceListings.length.toString(), icon: Package, color: 'from-blue-500 to-cyan-500' },
    { label: 'Active Sales', value: '45', icon: ShoppingCart, color: 'from-green-500 to-emerald-500' },
    { label: 'Volume (24h)', value: '125.5 ETH', icon: DollarSign, color: 'from-purple-500 to-pink-500' },
    { label: 'Growth', value: '+18.2%', icon: TrendingUp, color: 'from-orange-500 to-red-500' },
  ];

  const recentSales = [
    { event: 'Crypto Music Festival 2026', tier: 'VIP', price: '2.5 ETH', buyer: '0x742d...bEb5', seller: '0x8ba1...DBA72', time: '5 min ago' },
    { event: 'Web3 Summit 2026', tier: 'General', price: '1.2 ETH', buyer: '0xDC25...695E', seller: '0x1234...5678', time: '12 min ago' },
    { event: 'NFT Art Gallery Opening', tier: 'Premium', price: '0.8 ETH', buyer: '0x9876...4321', seller: '0x5555...6666', time: '23 min ago' },
    { event: 'Blockchain Workshop', tier: 'Standard', price: '0.5 ETH', buyer: '0xaaaa...bbbb', seller: '0xcccc...dddd', time: '1 hour ago' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Marketplace Management</h1>
        <p className="text-slate-400">Monitor ticket sales and marketplace activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Listings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Active Listings</CardTitle>
          <CardDescription className="text-slate-400">Current tickets for sale on marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockMarketplaceListings.map((listing) => (
              <div key={listing.id} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <h4 className="font-semibold text-white mb-1">{listing.eventName}</h4>
                <p className="text-sm text-slate-400 mb-3">{listing.tier}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">Seller:</span>
                  <code className="text-xs text-slate-300">{listing.seller.slice(0, 10)}...</code>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-lg font-bold text-purple-400">{listing.price} ETH</span>
                  <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Sales</CardTitle>
          <CardDescription className="text-slate-400">Latest marketplace transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Event</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Tier</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Price</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Buyer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Seller</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, index) => (
                  <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-4 px-4 text-sm text-white">{sale.event}</td>
                    <td className="py-4 px-4 text-sm text-slate-400">{sale.tier}</td>
                    <td className="py-4 px-4 text-sm text-purple-400 font-medium">{sale.price}</td>
                    <td className="py-4 px-4">
                      <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">{sale.buyer}</code>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">{sale.seller}</code>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500 text-right">{sale.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
