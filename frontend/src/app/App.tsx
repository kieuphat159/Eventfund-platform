import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PublicLayout } from "./layouts/PublicLayout";
import { UserLayout } from "./layouts/UserLayout";
import { AdminLayout } from "./layouts/AdminLayout";

// Public Pages
import { Home } from "./pages/public/Home";
import { Explore } from "./pages/public/Explore";
import { Marketplace } from "./pages/public/Marketplace";
import { EventDetail } from "./pages/public/EventDetail";
import { About } from "./pages/public/About";
import { TicketDetail } from "./pages/public/TicketDetail";
import { LoginPage } from "./pages/public/LoginPage";

// User Pages
import { Dashboard } from "./pages/user/Dashboard";
import { MyEvents } from "./pages/user/MyEvents";
import { CreateEvent } from "./pages/user/CreateEvent";
import { EditEvent } from "./pages/user/EditEvents";
import { MyTickets } from "./pages/user/MyTickets";
import { MyInvestments } from "./pages/user/MyInvestments";
import { InvestmentDetail } from "./pages/user/InvestmentDetail";
import { Wallet } from "./pages/user/Wallet";
import { Profile } from "./pages/user/Profile";
import { Settings } from "./pages/user/Settings";

// Verifier Pages
import { VerifierDashboard } from "./pages/verifier/VerifierDashboard";

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { UserManagement } from "./pages/admin/UserManagement";
import { EventManagement } from "./pages/admin/EventManagement";
import { MarketplaceManagement } from "./pages/admin/MarketplaceManagement";
import { FraudMonitoring } from "./pages/admin/FraudMonitoring";
import { FinanceDashboard } from "./pages/admin/FinanceDashboard";
import { AnalyticsDashboard } from "./pages/admin/AnalyticsDashboard";
import { PlatformSettings } from "./pages/admin/PlatformSettings";
import { AdminEventDetail } from "./pages/admin/AdminEventDetail";
import { AdminEditEvent } from "./pages/admin/AdminEditEvent";

type AppRole = "user" | "verifier" | "admin" | "public" | null;

const FullScreenLoader: React.FC<{ text?: string }> = ({
  text = "Verifying access...",
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-mono">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p>{text}</p>
      </div>
    </div>
  );
};

const useSession = () => {
  const { user, isLoading } = useAuth();

  const walletAddress = user?.walletAddress || null;
  const currentRole: AppRole =
    user?.role && user.role !== "public" ? (user.role as AppRole) : "public";
  const isAuthenticated = !!walletAddress && currentRole !== "public";

  return {
    user,
    isLoading,
    walletAddress,
    currentRole,
    isAuthenticated,
  };
};

const getDefaultRouteByRole = (
  isAuthenticated: boolean,
  role: AppRole,
): string => {
  if (!isAuthenticated) return "/login";
  if (role === "admin") return "/admin/dashboard";
  if (role === "verifier") return "/app/verifier/dashboard";
  if (role === "user") return "/app/dashboard";
  return "/login";
};

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowRoles?: Array<"user" | "verifier" | "admin">;
}> = ({ children, allowRoles }) => {
  const { isLoading, isAuthenticated, currentRole } = useSession();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!currentRole || currentRole === "public") {
    return <Navigate to="/login" replace />;
  }

  if (
    allowRoles &&
    !allowRoles.includes(currentRole as "user" | "verifier" | "admin")
  ) {
    return (
      <Navigate
        to={getDefaultRouteByRole(isAuthenticated, currentRole)}
        replace
      />
    );
  }

  return <>{children}</>;
};

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
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowRoles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="events" element={<EventManagement />} />
        <Route path="events/:id" element={<AdminEventDetail />} />
        <Route path="events/edit/:id" element={<AdminEditEvent />} />
        <Route path="marketplace" element={<MarketplaceManagement />} />
        <Route path="fraud" element={<FraudMonitoring />} />
        <Route path="finance" element={<FinanceDashboard />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="settings" element={<PlatformSettings />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute allowRoles={["user", "verifier", "admin"]}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />

        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowRoles={["user", "verifier", "admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="verifier/dashboard"
          element={
            <ProtectedRoute allowRoles={["verifier", "admin"]}>
              <VerifierDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="events/my-events" element={<MyEvents />} />
        <Route path="events/create" element={<CreateEvent />} />
        <Route path="events/edit/:id" element={<EditEvent />} />
        <Route path="tickets/my-tickets" element={<MyTickets />} />
        <Route path="investments" element={<MyInvestments />} />
        <Route path="investments/:id" element={<InvestmentDetail />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="account/profile" element={<Profile />} />
        <Route path="account/settings" element={<Settings />} />
      </Route>

      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route
          path="events/create"
          element={<Navigate to="/app/events/create" replace />}
        />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="about" element={<About />} />
        <Route path="login" element={<LoginRedirect />} />

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
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={getDefaultRouteByRole(isAuthenticated, currentRole)}
            replace
          />
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;