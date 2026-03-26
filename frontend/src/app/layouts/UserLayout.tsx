import React, { useState } from 'react';
import { Outlet } from 'react-router';
import { PublicUserHeader } from '../components/shared/PublicUserHeader';
import { UserSidebar } from '../components/shared/UserSidebar';
import { cn } from '../lib/utils';

export const UserLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      <PublicUserHeader />
      <UserSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main
        className={cn(
          'pt-16 flex-1 transition-all duration-300 overflow-y-auto',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
