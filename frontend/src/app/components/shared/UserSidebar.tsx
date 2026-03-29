import React from "react";
import { Link, useLocation } from "react-router";
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

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const UserSidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
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
    <aside
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-slate-900 border-r border-slate-800 transition-all duration-300 z-40",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            // Exact path check for active state
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg transition-all",
                  isActive
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="ml-3 text-sm">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

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
