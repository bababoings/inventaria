import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { toast } from "sonner";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import PurchaseOrders from "./pages/PurchaseOrders";
import Suppliers from "./pages/Suppliers";
import AIAsk from "./pages/AIAsk";
import AutomationLogs from "./pages/AutomationLogs";
import Organization from "./pages/Organization";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/organization" element={<Organization />} />
        <Route path="/ai-ask" element={<AIAsk />} />
        <Route path="/automation-logs" element={<AutomationLogs />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Component to handle auth callbacks and show success messages
function AuthCallbackHandler() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Check for successful email confirmation in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const error = hashParams.get('error');

    if (type === 'signup' && accessToken && !error && user) {
      // Show success message after a brief delay to ensure user is loaded
      setTimeout(() => {
        toast.success("Email confirmed! Welcome to InventarIA!");
      }, 500);
    }
  }, [user, location]);

  return null;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <AuthCallbackHandler />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
