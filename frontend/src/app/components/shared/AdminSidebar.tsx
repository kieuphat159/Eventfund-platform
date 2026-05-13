import React from "react";
import { Link, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SidebarShell } from "./SidebarShell";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();

  const adminNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
    { icon: Users, label: "User Management", path: "/admin/users" },
    { icon: Calendar, label: "Event Management", path: "/admin/events" },
    { icon: ShoppingCart, label: "Marketplace", path: "/admin/marketplace" },
    { icon: AlertTriangle, label: "Fraud Monitoring", path: "/admin/fraud" },
    { icon: DollarSign, label: "Finance", path: "/admin/finance" },
    { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
    // { icon: Settings, label: "Platform Settings", path: "/admin/settings" },
  ];

  return (
    <SidebarShell
      title="Admin"
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onCloseMobile={onCloseMobile}
      footer={
        <button
          onClick={onToggle}
          className="hidden items-center justify-center border-t border-slate-800 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:flex md:h-12"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      }
    >
      <nav className="space-y-1 px-2 py-4">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 transition-all",
                isActive
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white",
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={cn(
                  "ml-3 text-sm md:block",
                  collapsed ? "md:hidden" : "md:block",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* {!collapsed && (
        <div className="mx-2 mb-2 hidden rounded-lg border border-slate-700 bg-slate-800 p-4 md:block">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-400">System Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Uptime</span>
              <span className="font-medium text-green-400">99.9%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Users</span>
              <span className="font-medium text-white">2,543</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pending Reviews</span>
              <span className="font-medium text-purple-400">12</span>
            </div>
          </div>
        </div>
      )} */}
    </SidebarShell>
  );
};
