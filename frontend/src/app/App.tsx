import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PublicLayout } from './layouts/PublicLayout';
import { UserLayout } from './layouts/UserLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RoleSwitcher } from './components/RoleSwitcher';

// Public Pages
import { Home } from "./pages/public/Home";
import { Explore } from "./pages/public/Explore";
import { Marketplace } from "./pages/public/Marketplace";
import { EventDetail } from "./pages/public/EventDetail";
import { About } from "./pages/public/About";
import { TicketDetail } from "./pages/public/TicketDetail";
import { LoginPage } from "./pages/public/LoginPage";

// User Pages
import { Dashboard } from './pages/user/Dashboard';
import { MyEvents } from './pages/user/MyEvents';
import { CreateEvent } from './pages/user/CreateEvent';
import { MyTickets } from './pages/user/MyTickets';
import { MyInvestments } from './pages/user/MyInvestments';
import { Wallet } from './pages/user/Wallet';
import { Profile } from './pages/user/Profile';
import { Settings } from './pages/user/Settings';

// Verifier Pages
import { VerifierDashboard } from "./pages/verifier/VerifierDashboard";

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { EventManagement } from './pages/admin/EventManagement';
import { MarketplaceManagement } from './pages/admin/MarketplaceManagement';
import { FraudMonitoring } from './pages/admin/FraudMonitoring';
import { FinanceDashboard } from './pages/admin/FinanceDashboard';
import { AnalyticsDashboard } from './pages/admin/AnalyticsDashboard';
import { PlatformSettings } from './pages/admin/PlatformSettings';

// Demo Page
import { RoleDemo } from './pages/RoleDemo';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowRoles?: Array<"user" | "verifier" | "admin">;
}> = ({ children, allowRoles }) => {
  const { isLoading, isAuthenticated, currentRole } = useSession();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    console.log("[Guard] Not logged in, redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'verifier' && user?.role !== 'verifier' && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (
    allowRoles &&
    !allowRoles.includes(currentRole as "user" | "verifier" | "admin")
  ) {
    console.log("[Guard] Insufficient permissions, redirecting to allowed route");
    return (
      <Navigate
        to={getDefaultRouteByRole(isAuthenticated, currentRole)}
        replace
      />
    );
  }

  return <>{children}</>;
};

/**
 * Prevent logged-in users from staying on the login page
 */
const LoginRedirect: React.FC = () => {
  const { isLoading, isAuthenticated, currentRole } = useSession();

  if (isLoading) {
    return <FullScreenLoader text="Checking login session..." />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={getDefaultRouteByRole(isAuthenticated, currentRole)}
        replace
      />
    );
  }

  return <LoginPage />;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated, currentRole } = useSession();

  return (
    <Routes>
      {/* Admin Routes - Completely Separate Layout */}
      {user?.role === 'admin' && (
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="events" element={<EventManagement />} />
          <Route path="marketplace" element={<MarketplaceManagement />} />
          <Route path="fraud" element={<FraudMonitoring />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="settings" element={<PlatformSettings />} />
        </Route>
      )}

      {/* User/Verifier Routes - Shared Layout (Public Header + User Sidebar) */}
      {(user?.role === 'user' || user?.role === 'verifier') && (
        <Route path="/" element={<UserLayout />}>
          <Route path="dashboard" element={<Dashboard />} />

          {/* Verifier-specific routes - Extends User */}
          {user?.role === 'verifier' && (
            <>
              <Route path="verifier">
                <Route path="dashboard" element={<VerifierDashboard />} />
              </Route>
            </>
          )}

          {/* User Routes */}
          <Route path="events/my-events" element={<MyEvents />} />
          <Route path="events/create" element={<CreateEvent />} />
          <Route path="tickets/my-tickets" element={<MyTickets />} />
          <Route path="investments" element={<MyInvestments />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="account/profile" element={<Profile />} />
          <Route path="account/settings" element={<Settings />} />
        </Route>
      )}

      {/* Public Routes - Public Layout (No Sidebar) */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="about" element={<About />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="faq"
          element={<div className="p-20 text-white">FAQ Page</div>}
        />

        <Route
          path="terms"
          element={<div className="p-20 text-white">Terms Page</div>}
        />

        <Route
          path="privacy"
          element={<div className="p-20 text-white">Privacy Page</div>}
        />
        <Route path="demo" element={<RoleDemo />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <RoleSwitcher />
      </Router>
    </AuthProvider>
  );
};

export default App;
