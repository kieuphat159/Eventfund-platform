import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { PublicUserHeader } from '../components/shared/PublicUserHeader';
import { UserSidebar } from '../components/shared/UserSidebar';
import { cn } from '../lib/utils';

export const UserLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      <PublicUserHeader />
      <UserSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <main
        className={cn(
          'relative pt-16 flex-1 overflow-y-auto transition-all duration-300',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-slate-950/40 backdrop-blur md:hidden"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>

        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
