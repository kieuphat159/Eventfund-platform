import React from 'react';
import { Outlet } from 'react-router-dom';
import { PublicUserHeader } from '../components/shared/PublicUserHeader';
import { Footer } from '../components/shared/Footer';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <PublicUserHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
