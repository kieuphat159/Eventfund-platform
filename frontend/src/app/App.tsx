import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
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
import { MyTickets } from "./pages/user/MyTickets";
import { MyInvestments } from "./pages/user/MyInvestments";
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

type AppRole = "user" | "verifier" | "admin" | "public" | null;

const FullScreenLoader: React.FC<{ text?: string }> = ({
  text = "Đang xác thực quyền truy cập...",
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

/**
 * Lấy session hiện tại từ cả context và localStorage
 */
const useSession = () => {
  const { user, isLoading } = useAuth();

  const savedRole = localStorage.getItem("userRole") as AppRole;
  const savedAddress = localStorage.getItem("walletAddress");

  const walletAddress = user?.walletAddress || savedAddress || null;

  const currentRole: AppRole =
    user?.role && user.role !== "public" ? (user.role as AppRole) : savedRole;

  const isAuthenticated = !!walletAddress;

  return {
    user,
    isLoading,
    walletAddress,
    currentRole,
    isAuthenticated,
  };
};

/**
 * Trả về route mặc định theo role
 */
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

/**
 * Guard tổng quát
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowRoles?: Array<"user" | "verifier" | "admin">;
}> = ({ children, allowRoles }) => {
  const { isLoading, isAuthenticated, currentRole } = useSession();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    console.log("[Guard] Chưa đăng nhập, chuyển về /login");
    return <Navigate to="/login" replace />;
  }

  if (!currentRole || currentRole === "public") {
    console.log("[Guard] Có ví nhưng role không hợp lệ, chuyển về /login");
    return <Navigate to="/login" replace />;
  }

  if (
    allowRoles &&
    !allowRoles.includes(currentRole as "user" | "verifier" | "admin")
  ) {
    console.log("[Guard] Không đủ quyền, chuyển về route phù hợp");
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
 * Nếu đã login thì không cho ở lại login page
 */
const LoginRedirect: React.FC = () => {
  const { isLoading, isAuthenticated, currentRole } = useSession();

  if (isLoading) {
    return <FullScreenLoader text="Đang kiểm tra phiên đăng nhập..." />;
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
      {/* 1. ADMIN ROUTES */}
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
        <Route path="marketplace" element={<MarketplaceManagement />} />
        <Route path="fraud" element={<FraudMonitoring />} />
        <Route path="finance" element={<FinanceDashboard />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="settings" element={<PlatformSettings />} />
      </Route>

      {/* 2. USER & VERIFIER ROUTES */}
      <Route
        path="/app"
        element={
          <ProtectedRoute allowRoles={["user", "verifier", "admin"]}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />

        {/* Dashboard chung cho user thường */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowRoles={["user", "verifier", "admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Verifier specific */}
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
        <Route path="tickets/my-tickets" element={<MyTickets />} />
        <Route path="investments" element={<MyInvestments />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="account/profile" element={<Profile />} />
        <Route path="account/settings" element={<Settings />} />
      </Route>

      {/* 3. PUBLIC ROUTES */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="marketplace" element={<Marketplace />} />
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

      {/* 4. Catch-all: tự đẩy theo role */}
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
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
