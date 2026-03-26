import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { UserRole } from '../types/roles';

export const RoleDemo: React.FC = () => {
  const { user, switchRole } = useAuth();

  const roles: { role: UserRole; title: string; description: string; features: string[] }[] = [
    {
      role: 'public',
      title: 'Public (No Wallet)',
      description: 'Browse events without connecting a wallet',
      features: [
        'View public pages',
        'Explore events',
        'Browse marketplace',
        'Uses Public/User shared header',
      ],
    },
    {
      role: 'user',
      title: 'User (Wallet Connected)',
      description: 'Full access to platform features',
      features: [
        'Same header as Public',
        'Dashboard with sidebar',
        'Create and manage events',
        'Buy and sell tickets',
        'Invest in events',
      ],
    },
    {
      role: 'verifier',
      title: 'Verifier (User + Check-In)',
      description: 'User permissions + event check-in access',
      features: [
        'Extends User role (same layout)',
        'Same header and sidebar as User',
        'QR code ticket scanner',
        'Validate NFT tickets',
        'Manage event check-ins',
      ],
    },
    {
      role: 'admin',
      title: 'Admin (Separate Layout)',
      description: 'Complete platform management',
      features: [
        'COMPLETELY SEPARATE layout',
        'Different header and sidebar',
        'User management',
        'Platform analytics',
        'System configuration',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Role-Based Layout System</h1>
          <p className="text-xl text-slate-400 mb-2">
            Demonstrating strict layout separation between roles
          </p>
          <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mt-4">
            <span className="text-sm text-purple-300">
              Current Role: <span className="font-bold text-purple-200">{user?.role?.toUpperCase()}</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {roles.map((roleInfo) => (
            <Card
              key={roleInfo.role}
              className={`bg-slate-900 border-2 transition-all ${
                user?.role === roleInfo.role
                  ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  {roleInfo.title}
                  {user?.role === roleInfo.role && (
                    <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full">Active</span>
                  )}
                </CardTitle>
                <CardDescription className="text-slate-400">{roleInfo.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {roleInfo.features.map((feature, index) => (
                    <li key={index} className="text-sm text-slate-300 flex items-start">
                      <span className="text-purple-400 mr-2">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => switchRole(roleInfo.role)}
                  disabled={user?.role === roleInfo.role}
                  className={`w-full ${
                    user?.role === roleInfo.role
                      ? 'bg-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                  } text-white`}
                >
                  {user?.role === roleInfo.role ? 'Current Role' : `Switch to ${roleInfo.title}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Layout Explanation */}
        <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-white">Layout Architecture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h3 className="font-semibold text-blue-400 mb-3">Public + User Layout</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Shared PublicUserHeader</li>
                  <li>• User adds sidebar navigation</li>
                  <li>• Consistent branding</li>
                  <li>• Marketing-focused design</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-purple-400 mb-3">Verifier Layout</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Extends User layout</li>
                  <li>• Same header and sidebar</li>
                  <li>• Additional nav items</li>
                  <li>• Check-in focused pages</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-red-400 mb-3">Admin Layout</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Completely separate AdminHeader</li>
                  <li>• Separate AdminSidebar</li>
                  <li>• Different color scheme</li>
                  <li>• Data-focused interface</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Component Hierarchy Diagram */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Layout Component Hierarchy</CardTitle>
            <CardDescription className="text-slate-400">Visual representation of layout separation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Public & User Share */}
              <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5">
                <h4 className="text-blue-400 font-semibold mb-3">Public & User (Shared Header)</h4>
                <div className="space-y-2">
                  <div className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300">
                    <code>PublicUserHeader.tsx</code> - Shared component
                  </div>
                  <div className="ml-4 space-y-2">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded p-2 text-sm text-slate-400">
                      Public: No sidebar
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded p-2 text-sm text-slate-400">
                      User: + <code>UserSidebar.tsx</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verifier Extends User */}
              <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/5">
                <h4 className="text-purple-400 font-semibold mb-3">Verifier (Extends User)</h4>
                <div className="space-y-2">
                  <div className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300">
                    <code>PublicUserHeader.tsx</code> - Same as User
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300">
                    <code>UserSidebar.tsx</code> - Same as User + Check-In item
                  </div>
                </div>
              </div>

              {/* Admin Separate */}
              <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/5">
                <h4 className="text-red-400 font-semibold mb-3">Admin (Completely Separate)</h4>
                <div className="space-y-2">
                  <div className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300">
                    <code>AdminHeader.tsx</code> - Unique component
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300">
                    <code>AdminSidebar.tsx</code> - Unique component
                  </div>
                  <div className="bg-slate-800/50 border border-red-500/30 rounded p-2 text-xs text-red-400 mt-2">
                    ⚠️ Zero shared components with Public/User/Verifier
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Test */}
        <Card className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Test Layout Separation</h3>
              <p className="text-slate-300 mb-4">
                Use the floating button (bottom-right) to switch between roles and observe:
              </p>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-left">
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-blue-400 font-medium mb-1">Public → User</p>
                  <p className="text-slate-400">Same header, sidebar appears</p>
                </div>
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-purple-400 font-medium mb-1">User → Verifier</p>
                  <p className="text-slate-400">Same layout + extra nav items</p>
                </div>
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-red-400 font-medium mb-1">Any → Admin</p>
                  <p className="text-slate-400">Completely different layout</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};