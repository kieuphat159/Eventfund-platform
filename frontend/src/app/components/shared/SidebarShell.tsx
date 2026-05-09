import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SidebarShellProps {
  title: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SidebarShell: React.FC<SidebarShellProps> = ({
  title,
  collapsed,
  mobileOpen,
  onCloseMobile,
  children,
  footer,
}) => {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] border-r border-slate-800 bg-slate-900 transition-all duration-300",
          "w-[min(20rem,85vw)] md:z-40 md:w-64",
          collapsed ? "md:w-16" : "md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 md:hidden">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              {title}
            </span>
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label={`Close ${title}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer}
        </div>
      </aside>
    </>
  );
};
