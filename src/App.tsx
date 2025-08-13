
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import InternalDashboard from "./pages/InternalDashboard";
import PartnerDashboard from "./pages/PartnerDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import InternalIngestion from "./pages/InternalIngestion";
import InternalPipelines from "./pages/InternalPipelines";
import InternalKpiEditor from "./pages/InternalKpiEditor";
import AppLayout from "./components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/internal" element={<InternalDashboard />} />
            <Route path="/internal/ingest" element={<InternalIngestion />} />
            <Route path="/internal/pipelines" element={<InternalPipelines />} />
            <Route path="/internal/kpis" element={<InternalKpiEditor />} />
            <Route path="/partner" element={<PartnerDashboard />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

