import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  TrendingUp,
  Wallet,
  User,
  Settings,
  QrCode,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import { SidebarShell } from "./SidebarShell";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const UserSidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { user } = useAuth();

  // IMPORTANT: All paths must start with /app
  const userNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/app/dashboard" },
    { icon: Calendar, label: "My Events", path: "/app/events/my-events" },
    { icon: Ticket, label: "My Tickets", path: "/app/tickets/my-tickets" },
    { icon: TrendingUp, label: "Investments", path: "/app/investments" },
    { icon: Wallet, label: "Wallet", path: "/app/wallet" },
    { icon: User, label: "Profile", path: "/app/account/profile" }, // Must match App.tsx
    { icon: Settings, label: "Settings", path: "/app/account/settings" },
  ];

  const verifierNavItems = [
    { icon: QrCode, label: "Event Check-In", path: "/app/verifier/dashboard" },
  ];

  const allNavItems =
    user?.role === "verifier"
      ? [
          ...userNavItems.slice(0, 2),
          ...verifierNavItems,
          ...userNavItems.slice(2),
        ]
      : userNavItems;

  return (
    <SidebarShell
      title="Navigation"
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
        {allNavItems.map((item) => {
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
              <span className={cn("ml-3 text-sm md:block", collapsed ? "md:hidden" : "md:block")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </SidebarShell>
  );
};
