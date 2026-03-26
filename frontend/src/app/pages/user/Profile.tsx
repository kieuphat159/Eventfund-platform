import React from 'react';
import { User, Mail, MapPin, Calendar, Edit, Camera } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../contexts/AuthContext';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  const userStats = [
    { label: 'Events Created', value: '3' },
    { label: 'Tickets Owned', value: '12' },
    { label: 'Total Investments', value: '8.5 ETH' },
    { label: 'Member Since', value: 'Jan 2026' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
        <p className="text-slate-400">Manage your public profile and personal information</p>
      </div>

      {/* Profile Header */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-8">
          <div className="flex items-start space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-slate-800 border-2 border-slate-900 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors">
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Anonymous User</h2>
                  <code className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded">
                    {user?.wallet ? `${user.wallet.slice(0, 12)}...${user.wallet.slice(-8)}` : '0x742d...bEb5'}
                  </code>
                </div>
                <span className={`text-xs px-3 py-1 rounded capitalize ${
                  user?.role === 'admin'
                    ? 'bg-red-500/10 text-red-400'
                    : user?.role === 'verifier'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {user?.role}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {userStats.map((stat, index) => (
                  <div key={index} className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                    <p className="text-lg font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Personal Information</CardTitle>
              <CardDescription className="text-slate-400">Update your personal details</CardDescription>
            </div>
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display-name" className="text-white">Display Name</Label>
              <Input
                id="display-name"
                placeholder="Enter your display name"
                defaultValue="Anonymous User"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="username" className="text-white">Username</Label>
              <Input
                id="username"
                placeholder="@username"
                defaultValue="@crypto_enthusiast"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-white">Email (Optional)</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Email is optional and kept private</p>
          </div>

          <div>
            <Label htmlFor="bio" className="text-white">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              className="mt-1.5 bg-slate-800 border-slate-700 text-white min-h-[100px]"
              defaultValue="Web3 enthusiast and event organizer passionate about bringing people together through blockchain technology."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location" className="text-white">Location</Label>
              <div className="relative mt-1.5">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="location"
                  placeholder="City, Country"
                  defaultValue="San Francisco, USA"
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="joined" className="text-white">Member Since</Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="joined"
                  value="January 2026"
                  disabled
                  className="pl-10 bg-slate-800 border-slate-700 text-slate-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Social Links</CardTitle>
          <CardDescription className="text-slate-400">Connect your social media accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="twitter" className="text-white">Twitter</Label>
            <Input
              id="twitter"
              placeholder="https://twitter.com/username"
              className="mt-1.5 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label htmlFor="discord" className="text-white">Discord</Label>
            <Input
              id="discord"
              placeholder="username#0000"
              className="mt-1.5 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label htmlFor="website" className="text-white">Website</Label>
            <Input
              id="website"
              placeholder="https://yourwebsite.com"
              className="mt-1.5 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Privacy Settings</CardTitle>
          <CardDescription className="text-slate-400">Control your profile visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Public Profile</p>
              <p className="text-sm text-slate-400">Make your profile visible to everyone</p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Show Wallet Activity</p>
              <p className="text-sm text-slate-400">Display your transactions and NFTs publicly</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Show Email</p>
              <p className="text-sm text-slate-400">Make your email visible to other users</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      <div className="flex items-center justify-end space-x-4">
        <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
          Cancel
        </Button>
        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
          Save Changes
        </Button>
      </div>
    </div>
  );
};
