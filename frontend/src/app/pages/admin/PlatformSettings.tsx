import React from 'react';
import { 
  Settings, 
  DollarSign, 
  FileCode, 
  ShieldCheck, 
  Lock, 
  Users, 
  Save,
  AlertCircle,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export const PlatformSettings: React.FC = () => {
  const [platformFee, setPlatformFee] = React.useState('2.5');
  const [marketplaceFee, setMarketplaceFee] = React.useState('1.5');
  const [autoApproval, setAutoApproval] = React.useState(false);
  const [verificationRequired, setVerificationRequired] = React.useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = React.useState(true);

  const adminUsers = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah@eventchain.io',
      role: 'Super Admin',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595bEb5',
      status: 'active',
    },
    {
      id: 2,
      name: 'Mike Chen',
      email: 'mike@eventchain.io',
      role: 'Admin',
      wallet: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      status: 'active',
    },
    {
      id: 3,
      name: 'Emily Rodriguez',
      email: 'emily@eventchain.io',
      role: 'Finance Admin',
      wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      status: 'active',
    },
    {
      id: 4,
      name: 'David Park',
      email: 'david@eventchain.io',
      role: 'Support Admin',
      wallet: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      status: 'inactive',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Platform Settings</h1>
        <p className="text-slate-400">Configure platform parameters and security settings</p>
      </div>

      {/* Platform Fee Configuration */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <CardTitle className="text-white">Platform Fee Configuration</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Set transaction fees for the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="platform-fee" className="text-slate-300">
                Platform Fee (%)
              </Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="platform-fee"
                  type="number"
                  step="0.1"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <span className="text-sm text-slate-400">on ticket sales</span>
              </div>
              <p className="text-xs text-slate-500">
                Current: {platformFee}% fee on all primary ticket sales
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketplace-fee" className="text-slate-300">
                Marketplace Fee (%)
              </Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="marketplace-fee"
                  type="number"
                  step="0.1"
                  value={marketplaceFee}
                  onChange={(e) => setMarketplaceFee(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <span className="text-sm text-slate-400">on resales</span>
              </div>
              <p className="text-xs text-slate-500">
                Current: {marketplaceFee}% fee on secondary market transactions
              </p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-400 font-medium">Fee Distribution</p>
              <p className="text-xs text-slate-400 mt-1">
                Platform fees are collected from event organizers on ticket sales and from sellers on marketplace transactions.
                Changes take effect immediately for new transactions.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
              <Save className="w-4 h-4 mr-2" />
              Save Fee Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Smart Contract Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-white">Smart Contract Configuration</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Blockchain and smart contract addresses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-contract" className="text-slate-300">
                Ticket NFT Contract Address
              </Label>
              <Input
                id="ticket-contract"
                value="0x5FbDB2315678afecb367f032d93F642f64180aa3"
                readOnly
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              />
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Deployed</Badge>
                <span className="text-xs text-slate-500">Network: Ethereum Mainnet</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketplace-contract" className="text-slate-300">
                Marketplace Contract Address
              </Label>
              <Input
                id="marketplace-contract"
                value="0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
                readOnly
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              />
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Deployed</Badge>
                <span className="text-xs text-slate-500">Network: Ethereum Mainnet</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-contract" className="text-slate-300">
                Payment Processor Contract
              </Label>
              <Input
                id="payment-contract"
                value="0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
                readOnly
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              />
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Deployed</Badge>
                <span className="text-xs text-slate-500">Network: Ethereum Mainnet</span>
              </div>
            </div>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-orange-400 font-medium">Contract Upgrade Required</p>
              <p className="text-xs text-slate-400 mt-1">
                A new version of the marketplace contract is available. Review changes before upgrading.
              </p>
              <Button size="sm" variant="outline" className="mt-3 border-orange-500 text-orange-400 hover:bg-orange-500/10">
                Review Upgrade
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Approval Rules */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-white">Event Approval Rules</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Configure event moderation and approval workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="auto-approval" className="text-slate-300 font-medium">
                  Automatic Event Approval
                </Label>
                <p className="text-sm text-slate-400 mt-1">
                  Automatically approve events from verified organizers
                </p>
              </div>
              <Switch
                id="auto-approval"
                checked={autoApproval}
                onCheckedChange={setAutoApproval}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="verification-required" className="text-slate-300 font-medium">
                  Organizer Verification Required
                </Label>
                <p className="text-sm text-slate-400 mt-1">
                  Require identity verification before creating events
                </p>
              </div>
              <Switch
                id="verification-required"
                checked={verificationRequired}
                onCheckedChange={setVerificationRequired}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-ticket-price" className="text-slate-300">
                Minimum Ticket Price
              </Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="min-ticket-price"
                  type="number"
                  step="0.001"
                  defaultValue="0.01"
                  className="bg-slate-800 border-slate-700 text-white max-w-xs"
                />
                <span className="text-sm text-slate-400">ETH</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-ticket-price" className="text-slate-300">
                Maximum Ticket Price
              </Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="max-ticket-price"
                  type="number"
                  step="0.1"
                  defaultValue="10.0"
                  className="bg-slate-800 border-slate-700 text-white max-w-xs"
                />
                <span className="text-sm text-slate-400">ETH</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval-timeout" className="text-slate-300">
                Approval Timeout
              </Label>
              <Select defaultValue="48">
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                  <SelectItem value="72">72 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Time before pending events are auto-rejected
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Approval Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-red-400" />
            <CardTitle className="text-white">Security Settings</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Platform security and authentication configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="2fa-required" className="text-slate-300 font-medium">
                  Two-Factor Authentication
                </Label>
                <p className="text-sm text-slate-400 mt-1">
                  Require 2FA for admin accounts
                </p>
              </div>
              <Switch
                id="2fa-required"
                checked={twoFactorRequired}
                onCheckedChange={setTwoFactorRequired}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-timeout" className="text-slate-300">
                Session Timeout
              </Label>
              <Select defaultValue="30">
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip-whitelist" className="text-slate-300">
                Admin IP Whitelist
              </Label>
              <Input
                id="ip-whitelist"
                placeholder="192.168.1.1, 10.0.0.1"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                Comma-separated list of allowed IP addresses (optional)
              </p>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-medium">Security Alert</p>
              <p className="text-xs text-slate-400 mt-1">
                2 failed admin login attempts detected in the last hour. Review security logs.
              </p>
              <Button size="sm" variant="outline" className="mt-3 border-red-500 text-red-400 hover:bg-red-500/10">
                View Security Logs
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Security Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin Role Management */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Admin Role Management</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Manage admin users and permissions
              </CardDescription>
            </div>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              Add Admin User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Wallet</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((admin) => (
                  <tr key={admin.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-white">{admin.name}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-400">{admin.email}</span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge 
                        className={
                          admin.role === 'Super Admin'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }
                      >
                        {admin.role}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-400 font-mono">
                        {admin.wallet.slice(0, 10)}...{admin.wallet.slice(-6)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        className={
                          admin.status === 'active'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }
                      >
                        {admin.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                          Edit
                        </Button>
                        {admin.role !== 'Super Admin' && (
                          <Button size="sm" variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                            Remove
                          </Button>
                        )}
                      </div>
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