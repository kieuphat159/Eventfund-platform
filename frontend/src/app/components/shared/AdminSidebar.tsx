import React from 'react';
import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  Settings,
  BarChart3,
  Shield,
  Flag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const AdminSidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();

  const adminNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'User Management', path: '/admin/users' },
    { icon: Calendar, label: 'Event Management', path: '/admin/events' },
    { icon: ShoppingCart, label: 'Marketplace', path: '/admin/marketplace' },
    { icon: AlertTriangle, label: 'Fraud Monitoring', path: '/admin/fraud' },
    { icon: DollarSign, label: 'Finance', path: '/admin/finance' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    { icon: Settings, label: 'Platform Settings', path: '/admin/settings' },
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-slate-900 border-r border-slate-800 transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center px-3 py-2 rounded-lg transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="ml-3 text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Quick Stats - Only show when not collapsed */}
        {!collapsed && (
          <div className="mx-2 mb-2 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">System Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Uptime</span>
                <span className="text-green-400 font-medium">99.9%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Active Users</span>
                <span className="text-white font-medium">2,543</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pending Reviews</span>
                <span className="text-purple-400 font-medium">12</span>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-12 border-t border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </aside>
  );
};