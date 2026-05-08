import React from "react";
import { cn } from "../lib/utils";

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = "draft",
  className,
}) => {
  const variants: Record<string, string> = {
    draft: "bg-slate-500/10 text-slate-300 border-slate-500/20",
    funding: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    funded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ticketing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    ongoing: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    failed: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  const normalized = status.toLowerCase();
  const style =
    variants[normalized] ||
    "bg-slate-500/10 text-slate-300 border-slate-500/20";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
};
