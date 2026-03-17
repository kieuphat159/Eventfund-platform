import React from 'react';
import { Bell, Shield, Palette, Globe, Smartphone, Key, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../contexts/AuthContext';

export const Settings: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account preferences and settings</p>
      </div>

      {/* Account Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-white">Account & Security</CardTitle>
              <CardDescription className="text-slate-400">Manage your account security settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-white font-medium mb-1">Wallet Address</p>
                <code className="text-sm text-slate-400 bg-slate-800 px-3 py-1.5 rounded">
                  {user?.wallet ? `${user.wallet.slice(0, 20)}...${user.wallet.slice(-12)}` : '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5'}
                </code>
                <p className="text-xs text-slate-500 mt-2">This is your primary wallet address</p>
              </div>
              <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
                Copy
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Key className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-slate-400">Add an extra layer of security</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
              Enable
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Smartphone className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">Trusted Devices</p>
                <p className="text-sm text-slate-400">Manage devices that can access your account</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 text-white">
              Manage
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-white">Notifications</CardTitle>
              <CardDescription className="text-slate-400">Configure how you receive notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Event Reminders</p>
              <p className="text-sm text-slate-400">Get notified before your events start</p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Ticket Sales</p>
              <p className="text-sm text-slate-400">Notifications when your tickets are sold</p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Investment Updates</p>
              <p className="text-sm text-slate-400">Get updates on your event investments</p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Marketplace Activity</p>
              <p className="text-sm text-slate-400">Notifications for marketplace transactions</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Email Notifications</p>
              <p className="text-sm text-slate-400">Receive updates via email</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Marketing & Promotions</p>
              <p className="text-sm text-slate-400">Receive news and special offers</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-white">Appearance</CardTitle>
              <CardDescription className="text-slate-400">Customize how the app looks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="theme" className="text-white">Theme</Label>
            <Select defaultValue="dark">
              <SelectTrigger id="theme" className="mt-1.5 bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accent" className="text-white">Accent Color</Label>
            <Select defaultValue="purple">
              <SelectTrigger id="accent" className="mt-1.5 bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="purple">Purple</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="red">Red</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Compact Mode</p>
              <p className="text-sm text-slate-400">Reduce spacing for more content</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
          </div>
        </CardContent>
      </Card>

      {/* Language & Region */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-white">Language & Region</CardTitle>
              <CardDescription className="text-slate-400">Set your language and timezone</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="language" className="text-white">Language</Label>
            <Select defaultValue="en">
              <SelectTrigger id="language" className="mt-1.5 bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="timezone" className="text-white">Timezone</Label>
            <Select defaultValue="utc">
              <SelectTrigger id="timezone" className="mt-1.5 bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="utc">UTC (GMT+0)</SelectItem>
                <SelectItem value="pst">Pacific Time (GMT-8)</SelectItem>
                <SelectItem value="est">Eastern Time (GMT-5)</SelectItem>
                <SelectItem value="cet">Central European (GMT+1)</SelectItem>
                <SelectItem value="jst">Japan Standard (GMT+9)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="currency" className="text-white">Currency Display</Label>
            <Select defaultValue="eth">
              <SelectTrigger id="currency" className="mt-1.5 bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="eth">ETH</SelectItem>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
                <SelectItem value="gbp">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-red-900/10 border-red-500/30">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-white">Danger Zone</CardTitle>
              <CardDescription className="text-slate-400">Irreversible and destructive actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-red-500/20">
            <div>
              <p className="text-white font-medium">Export Account Data</p>
              <p className="text-sm text-slate-400">Download all your account data</p>
            </div>
            <Button variant="outline" size="sm" className="border-red-600 hover:bg-red-900/20 text-red-400">
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-red-500/20">
            <div>
              <p className="text-white font-medium">Delete Account</p>
              <p className="text-sm text-slate-400">Permanently delete your account and all data</p>
            </div>
            <Button variant="outline" size="sm" className="border-red-600 hover:bg-red-900/20 text-red-400">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      <div className="flex items-center justify-end space-x-4">
        <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
          Reset to Defaults
        </Button>
        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
          Save All Changes
        </Button>
      </div>
    </div>
  );
};
