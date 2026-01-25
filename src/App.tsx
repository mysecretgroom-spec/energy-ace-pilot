import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { HejjaModeProvider } from "@/hooks/useHejjaMode";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HejjaToggle } from "@/components/layout/HejjaToggle";
import { OnboardingDialog } from "@/components/onboarding";
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt";
import { SecurityPrompt } from "@/components/notifications/SecurityPrompt";
import Dashboard from "./pages/Dashboard";
import Planning from "./pages/Planning";
import CRM from "./pages/CRM";
import ClientDetail from "./pages/ClientDetail";
import VenteDetail from "./pages/VenteDetail";
import EtudeForm from "./pages/EtudeForm";
import Finance from "./pages/Finance";
import Notifications from "./pages/Notifications";
import Parametres from "./pages/Parametres";
import Profil from "./pages/Profil";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import AuthCallback from "./pages/AuthCallback";
// Settings sub-pages
import GmailAutoSync from "./pages/settings/GmailAutoSync";
import DataPSH from "./pages/settings/DataPSH";
import DataOrientation from "./pages/settings/DataOrientation";
import DataTarifs from "./pages/settings/DataTarifs";
import DataCompteurs from "./pages/settings/DataCompteurs";
import DataCalibres from "./pages/settings/DataCalibres";
import DataAides from "./pages/settings/DataAides";
import SecuritySettings from "./pages/settings/SecuritySettings";
import VentesSettings from "./pages/settings/VentesSettings";
import PushNotificationsSettings from "./pages/settings/PushNotificationsSettings";
import ObjectifsSettings from "./pages/settings/ObjectifsSettings";
import RegiesSettings from "./pages/settings/RegiesSettings";
import WhatsAppTemplatesSettings from "./pages/settings/WhatsAppTemplatesSettings";
import RegieDashboard from "./pages/RegieDashboard";
import Confidentialite from "./pages/Confidentialite";
import Conditions from "./pages/Conditions";
import Legal from "./pages/Legal";
import CGV from "./pages/CGV";
import SecurityPolicy from "./pages/SecurityPolicy";
import DataRetention from "./pages/DataRetention";
import Abonnement from "./pages/Abonnement";
import Support from "./pages/Support";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminClients from "./pages/admin/AdminClients";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminFeatures from "./pages/admin/AdminFeatures";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminPlans from "./pages/admin/AdminPlans";
import React, { useEffect } from "react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

const queryClient = new QueryClient();

// Initialize theme - dark mode only with HEJJA, default to light
const initTheme = () => {
  // Always start in light mode - dark mode is only enabled via HEJJA mode
  document.documentElement.classList.remove("dark");
  localStorage.setItem("theme", "light");
};

// Component to show HejjaToggle only for authenticated users
const AuthenticatedHejjaToggle = () => {
  return <HejjaToggle />;
};

const App = () => {
  // PWA auto-update with network check
  usePWAUpdate();
  
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <HejjaModeProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
                  <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
                  <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
                  <Route path="/ventes/:id" element={<ProtectedRoute><VenteDetail /></ProtectedRoute>} />
                  <Route path="/etude/new" element={<ProtectedRoute><EtudeForm /></ProtectedRoute>} />
                  <Route path="/etude/edit" element={<ProtectedRoute><EtudeForm /></ProtectedRoute>} />
                  <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/parametres" element={<ProtectedRoute><Parametres /></ProtectedRoute>} />
                  <Route path="/parametres/gmail-auto-sync" element={<ProtectedRoute><GmailAutoSync /></ProtectedRoute>} />
                  <Route path="/parametres/data-psh" element={<ProtectedRoute><DataPSH /></ProtectedRoute>} />
                  <Route path="/parametres/data-orientation" element={<ProtectedRoute><DataOrientation /></ProtectedRoute>} />
                  <Route path="/parametres/data-tarifs" element={<ProtectedRoute><DataTarifs /></ProtectedRoute>} />
                  <Route path="/parametres/data-compteurs" element={<ProtectedRoute><DataCompteurs /></ProtectedRoute>} />
                  <Route path="/parametres/data-calibres" element={<ProtectedRoute><DataCalibres /></ProtectedRoute>} />
                  <Route path="/parametres/data-aides" element={<ProtectedRoute><DataAides /></ProtectedRoute>} />
                  <Route path="/parametres/securite" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
                  <Route path="/parametres/ventes" element={<ProtectedRoute><VentesSettings /></ProtectedRoute>} />
                  <Route path="/parametres/notifications-push" element={<ProtectedRoute><PushNotificationsSettings /></ProtectedRoute>} />
                  <Route path="/parametres/objectifs" element={<ProtectedRoute><ObjectifsSettings /></ProtectedRoute>} />
                  <Route path="/parametres/regies" element={<ProtectedRoute><RegiesSettings /></ProtectedRoute>} />
                  <Route path="/parametres/whatsapp-templates" element={<ProtectedRoute><WhatsAppTemplatesSettings /></ProtectedRoute>} />
                  <Route path="/regies/:id" element={<ProtectedRoute><RegieDashboard /></ProtectedRoute>} />
                  <Route path="/regies/:id" element={<ProtectedRoute><RegieDashboard /></ProtectedRoute>} />
                  <Route path="/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/confidentialite" element={<Confidentialite />} />
                  <Route path="/conditions" element={<Conditions />} />
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/cgv" element={<CGV />} />
                  <Route path="/securite" element={<SecurityPolicy />} />
                  <Route path="/data-retention" element={<DataRetention />} />
                  <Route path="/abonnement" element={<ProtectedRoute><Abonnement /></ProtectedRoute>} />
                  <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
                  {/* Admin routes */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/clients" element={<AdminClients />} />
                  <Route path="/admin/plans" element={<AdminPlans />} />
                  <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                  <Route path="/admin/notifications" element={<AdminNotifications />} />
                  <Route path="/admin/support" element={<AdminSupport />} />
                  <Route path="/admin/features" element={<AdminFeatures />} />
                  <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                {/* Onboarding modal for new users */}
                <OnboardingDialog />
                {/* Push notification permission prompt */}
                <PushPermissionPrompt />
                {/* Security prompt for biometric */}
                <SecurityPrompt />
                {/* Floating HEJJA toggle - only visible when authenticated */}
                <AuthenticatedHejjaToggle />
              </HejjaModeProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;
