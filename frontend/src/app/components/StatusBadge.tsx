import React from 'react';
import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const variants = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-400 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variants[status],
        className
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};
