import React, { useState } from 'react';
import { Search, MoreVertical, Ban, CheckCircle, Shield, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

export const UserManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const users = [
    {
      id: '1',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5',
      role: 'user',
      status: 'active',
      joined: '2026-01-15',
      events: 3,
      tickets: 12,
      spend: '15.5 ETH',
    },
    {
      id: '2',
      wallet: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      role: 'verifier',
      status: 'active',
      joined: '2026-02-03',
      events: 0,
      tickets: 5,
      spend: '3.2 ETH',
    },
    {
      id: '3',
      wallet: '0xDC25EF3F5B8A186998338A2aDA83795FBA2D695E',
      role: 'user',
      status: 'suspended',
      joined: '2025-12-20',
      events: 1,
      tickets: 8,
      spend: '6.8 ETH',
    },
    {
      id: '4',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
      role: 'user',
      status: 'active',
      joined: '2026-03-01',
      events: 5,
      tickets: 20,
      spend: '28.4 ETH',
    },
  ];

  const stats = [
    { label: 'Total Users', value: '2,543', icon: Shield, color: 'from-blue-500 to-cyan-500' },
    { label: 'Active Today', value: '847', icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
    { label: 'Suspended', value: '12', icon: Ban, color: 'from-red-500 to-orange-500' },
    { label: 'New This Week', value: '156', icon: Calendar, color: 'from-purple-500 to-pink-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-slate-400">Manage platform users and permissions</p>
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

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search by wallet address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="verifier">Verifier</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Users</CardTitle>
          <CardDescription className="text-slate-400">All registered platform users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Wallet Address</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Joined</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Events</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Tickets</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Total Spend</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <code className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">
                        {user.wallet.slice(0, 10)}...{user.wallet.slice(-8)}
                      </code>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2 py-1 rounded capitalize ${
                          user.role === 'admin'
                            ? 'bg-red-500/10 text-red-400'
                            : user.role === 'verifier'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2 py-1 rounded capitalize ${
                          user.status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-400">
                      {new Date(user.joined).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-sm text-white text-right">{user.events}</td>
                    <td className="py-4 px-4 text-sm text-white text-right">{user.tickets}</td>
                    <td className="py-4 px-4 text-sm text-white text-right">{user.spend}</td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-400 hover:bg-slate-700">
                            {user.status === 'active' ? 'Suspend User' : 'Activate User'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
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
