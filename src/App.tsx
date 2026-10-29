import { PublicHomeGate } from "@/components/auth/PublicHomeGate";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { HejjaModeProvider } from "@/hooks/useHejjaMode";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InteractiveOnboardingProvider } from "@/components/onboarding/InteractiveOnboarding";
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt";
import { SecurityPrompt } from "@/components/notifications/SecurityPrompt";
import { DailyBriefingProvider } from "@/components/notifications/DailyBriefingProvider";
import React, { Suspense, useEffect } from "react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { PageLoading } from "@/components/common/PageState";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { TopLoadingBar } from "@/components/common/TopLoadingBar";
import { ScrollToTop } from "@/components/layout/ScrollToTop";


// ─── Lazy-loaded pages for code-splitting ───
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Planning = React.lazy(() => import("./pages/Planning"));
const CRM = React.lazy(() => import("./pages/CRM"));
const ClientDetail = React.lazy(() => import("./pages/ClientDetail"));
const VenteDetail = React.lazy(() => import("./pages/VenteDetail"));
const EtudeForm = React.lazy(() => import("./pages/EtudeForm"));
const Finance = React.lazy(() => import("./pages/Finance"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const Parametres = React.lazy(() => import("./pages/Parametres"));
const Profil = React.lazy(() => import("./pages/Profil"));
const Login = React.lazy(() => import("./pages/Login"));
const PresentationVideo = React.lazy(() => import("./pages/PresentationVideo"));
const Signup = React.lazy(() => import("./pages/Signup"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Install = React.lazy(() => import("./pages/Install"));
const AuthCallback = React.lazy(() => import("./pages/AuthCallback"));
const OAuthConsent = React.lazy(() => import("./pages/OAuthConsent"));

// Settings sub-pages
const GmailAutoSync = React.lazy(() => import("./pages/settings/GmailAutoSync"));
const DataPSH = React.lazy(() => import("./pages/settings/DataPSH"));
const DataOrientation = React.lazy(() => import("./pages/settings/DataOrientation"));
const DataTarifs = React.lazy(() => import("./pages/settings/DataTarifs"));
const DataCompteurs = React.lazy(() => import("./pages/settings/DataCompteurs"));
const DataCalibres = React.lazy(() => import("./pages/settings/DataCalibres"));
const DataAides = React.lazy(() => import("./pages/settings/DataAides"));
const DataIsolationPAC = React.lazy(() => import("./pages/settings/DataIsolationPAC"));
const DataCopPAC = React.lazy(() => import("./pages/settings/DataCopPAC"));
const DataPuissancesPAC = React.lazy(() => import("./pages/settings/DataPuissancesPAC"));
const DataIsolantsITE = React.lazy(() => import("./pages/settings/DataIsolantsITE"));
const DataFinitionsITE = React.lazy(() => import("./pages/settings/DataFinitionsITE"));
const SecuritySettings = React.lazy(() => import("./pages/settings/SecuritySettings"));
const VentesSettings = React.lazy(() => import("./pages/settings/VentesSettings"));
const CommissionsSettings = React.lazy(() => import("./pages/settings/CommissionsSettings"));
const ConfigAssistant = React.lazy(() => import("./pages/settings/ConfigAssistant"));
const PushNotificationsSettings = React.lazy(() => import("./pages/settings/PushNotificationsSettings"));
const ObjectifsSettings = React.lazy(() => import("./pages/settings/ObjectifsSettings"));
const RegiesSettings = React.lazy(() => import("./pages/settings/RegiesSettings"));
const AutoConfigRegie = React.lazy(() => import("./pages/settings/AutoConfigRegie"));
const WhatsAppTemplatesSettings = React.lazy(() => import("./pages/settings/WhatsAppTemplatesSettings"));
const WhatsAppAgentSettings = React.lazy(() => import("./pages/settings/WhatsAppAgentSettings"));
const DataEnergiesPrix = React.lazy(() => import("./pages/settings/DataEnergiesPrix"));
const DataZonesClimatiques = React.lazy(() => import("./pages/settings/DataZonesClimatiques"));
const DataAidesPAC = React.lazy(() => import("./pages/settings/DataAidesPAC"));
const DataAidesITE = React.lazy(() => import("./pages/settings/DataAidesITE"));
const DataMursITE = React.lazy(() => import("./pages/settings/DataMursITE"));
const DataEconomiesITE = React.lazy(() => import("./pages/settings/DataEconomiesITE"));
const DataEstimateurCoefficients = React.lazy(() => import("./pages/settings/DataEstimateurCoefficients"));
const WorkingDaysSettings = React.lazy(() => import("./pages/settings/WorkingDaysSettings"));
const OfflineSelectionSettings = React.lazy(() => import("./pages/settings/OfflineSelectionSettings"));
const DriveUploadsSettings = React.lazy(() => import("./pages/settings/DriveUploadsSettings"));
const GoogleDriveReturn = React.lazy(() => import("./pages/GoogleDriveReturn"));
const AgentNotificationsSettings = React.lazy(() => import("./pages/settings/AgentNotificationsSettings"));
const AgentLearnings = React.lazy(() => import("./pages/settings/AgentLearnings"));
const DataEvolutionPrix = React.lazy(() => import("./pages/settings/DataEvolutionPrix"));

// Other pages
const RegieDashboard = React.lazy(() => import("./pages/RegieDashboard"));
const Confidentialite = React.lazy(() => import("./pages/Confidentialite"));
const Conditions = React.lazy(() => import("./pages/Conditions"));
const Legal = React.lazy(() => import("./pages/Legal"));
const CGV = React.lazy(() => import("./pages/CGV"));
const Remboursement = React.lazy(() => import("./pages/Remboursement"));
const SecurityPolicy = React.lazy(() => import("./pages/SecurityPolicy"));
const DataRetention = React.lazy(() => import("./pages/DataRetention"));
const Abonnement = React.lazy(() => import("./pages/Abonnement"));
const Support = React.lazy(() => import("./pages/Support"));
const DocScannerPage = React.lazy(() => import("./modules/docScanner/components/DocScannerPage"));
const VideoUpload = React.lazy(() => import("./pages/VideoUpload"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));

// Admin pages
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAnalytics = React.lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminClients = React.lazy(() => import("./pages/admin/AdminClients"));
const AdminSubscriptions = React.lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminNotifications = React.lazy(() => import("./pages/admin/AdminNotifications"));
const AdminSupport = React.lazy(() => import("./pages/admin/AdminSupport"));
const AdminFeatures = React.lazy(() => import("./pages/admin/AdminFeatures"));
const AdminAuditLogs = React.lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminPlans = React.lazy(() => import("./pages/admin/AdminPlans"));
const AdminAIWorkflows = React.lazy(() => import("./pages/admin/AdminAIWorkflows"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminPayments = React.lazy(() => import("./pages/admin/AdminPayments"));
const AdminTrials = React.lazy(() => import("./pages/admin/AdminTrials"));
const Tarifs = React.lazy(() => import("./pages/Tarifs"));
const EssaiGratuit = React.lazy(() => import("./pages/EssaiGratuit"));
const Paiement = React.lazy(() => import("./pages/Paiement"));

// ─── QueryClient with optimized defaults + offline-first ───
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min before refetch
      gcTime: 30 * 60 * 1000, // 30 min garbage collection (longer for offline)
      retry: (failureCount, error) => {
        // Don't retry when offline
        if (!navigator.onLine) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst", // Serve cached data when offline
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

// Suspense fallback
const PageLoader = () => <PageLoading fullScreen />;

const App = () => {
  usePWAUpdate();
  
  useEffect(() => {
    // Always start in light mode - dark mode is only enabled via HEJJA mode
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return (
    <React.StrictMode>
      <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <TopLoadingBar />
            <AuthProvider>
              <HejjaModeProvider>
                <InteractiveOnboardingProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                      <Route path="/presentation" element={<PresentationVideo />} />
                      <Route path="/tarifs" element={<Tarifs />} />
                      <Route path="/essai-gratuit" element={<EssaiGratuit />} />
                      <Route path="/paiement" element={<Paiement />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/index" element={<Navigate to="/" replace />} />
                      <Route path="/" element={<PublicHomeGate><Dashboard /></PublicHomeGate>} />
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
                      <Route path="/parametres/data-isolation-pac" element={<ProtectedRoute><DataIsolationPAC /></ProtectedRoute>} />
                      <Route path="/parametres/data-cop-pac" element={<ProtectedRoute><DataCopPAC /></ProtectedRoute>} />
                      <Route path="/parametres/data-puissances-pac" element={<ProtectedRoute><DataPuissancesPAC /></ProtectedRoute>} />
                      <Route path="/parametres/data-isolants-ite" element={<ProtectedRoute><DataIsolantsITE /></ProtectedRoute>} />
                      <Route path="/parametres/data-finitions-ite" element={<ProtectedRoute><DataFinitionsITE /></ProtectedRoute>} />
                      <Route path="/parametres/data-energies-prix" element={<ProtectedRoute><DataEnergiesPrix /></ProtectedRoute>} />
                      <Route path="/parametres/data-zones-climatiques" element={<ProtectedRoute><DataZonesClimatiques /></ProtectedRoute>} />
                      <Route path="/parametres/data-aides-pac" element={<ProtectedRoute><DataAidesPAC /></ProtectedRoute>} />
                      <Route path="/parametres/data-aides-ite" element={<ProtectedRoute><DataAidesITE /></ProtectedRoute>} />
                      <Route path="/parametres/data-murs-ite" element={<ProtectedRoute><DataMursITE /></ProtectedRoute>} />
                      <Route path="/parametres/data-economies-ite" element={<ProtectedRoute><DataEconomiesITE /></ProtectedRoute>} />
                      <Route path="/parametres/data-estimateur" element={<ProtectedRoute><DataEstimateurCoefficients /></ProtectedRoute>} />
                      <Route path="/parametres/data-evolution-prix" element={<ProtectedRoute><DataEvolutionPrix /></ProtectedRoute>} />
                      <Route path="/parametres/securite" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
                      <Route path="/parametres/ventes" element={<ProtectedRoute><VentesSettings /></ProtectedRoute>} />
                      <Route path="/parametres/commissions" element={<ProtectedRoute><CommissionsSettings /></ProtectedRoute>} />
                      <Route path="/parametres/assistant" element={<ProtectedRoute><ConfigAssistant /></ProtectedRoute>} />
                      <Route path="/parametres/notifications-push" element={<ProtectedRoute><PushNotificationsSettings /></ProtectedRoute>} />
                      <Route path="/parametres/objectifs" element={<ProtectedRoute><ObjectifsSettings /></ProtectedRoute>} />
                      <Route path="/parametres/regies" element={<ProtectedRoute><RegiesSettings /></ProtectedRoute>} />
                      <Route path="/parametres/regies-auto-config" element={<ProtectedRoute><AutoConfigRegie /></ProtectedRoute>} />
                      <Route path="/parametres/whatsapp-templates" element={<ProtectedRoute><WhatsAppTemplatesSettings /></ProtectedRoute>} />
                      <Route path="/parametres/whatsapp-agent" element={<ProtectedRoute><WhatsAppAgentSettings /></ProtectedRoute>} />
                      <Route path="/parametres/agent-notifications" element={<ProtectedRoute><AgentNotificationsSettings /></ProtectedRoute>} />
                      <Route path="/parametres/apprentissages" element={<ProtectedRoute><AgentLearnings /></ProtectedRoute>} />
                      <Route path="/parametres/jours-travailles" element={<ProtectedRoute><WorkingDaysSettings /></ProtectedRoute>} />
                      <Route path="/parametres/hors-ligne" element={<ProtectedRoute><OfflineSelectionSettings /></ProtectedRoute>} />
                      <Route path="/oauth/google-drive/return" element={<ProtectedRoute><GoogleDriveReturn /></ProtectedRoute>} />
                      <Route path="/parametres/envois-drive" element={<ProtectedRoute><DriveUploadsSettings /></ProtectedRoute>} />
                      <Route path="/regies/:id" element={<ProtectedRoute><RegieDashboard /></ProtectedRoute>} />
                      <Route path="/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/confidentialite" element={<Confidentialite />} />
                      <Route path="/conditions" element={<Conditions />} />
                      <Route path="/legal" element={<Legal />} />
                      <Route path="/cgv" element={<CGV />} />
                      <Route path="/remboursement" element={<Remboursement />} />
                      <Route path="/mentions-legales" element={<Navigate to="/legal" replace />} />
                      <Route path="/conditions-generales" element={<Navigate to="/cgv" replace />} />
                      <Route path="/politique-de-confidentialite" element={<Navigate to="/confidentialite" replace />} />
                      <Route path="/privacy" element={<Navigate to="/confidentialite" replace />} />
                      <Route path="/refund" element={<Navigate to="/remboursement" replace />} />
                      <Route path="/securite" element={<SecurityPolicy />} />
                      <Route path="/data-retention" element={<DataRetention />} />
                      <Route path="/abonnement" element={<ProtectedRoute><Abonnement /></ProtectedRoute>} />
                      <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
                      <Route path="/docs/scan" element={<ProtectedRoute><DocScannerPage /></ProtectedRoute>} />
                      <Route path="/videos" element={<ProtectedRoute><VideoUpload /></ProtectedRoute>} />
                      {/* Admin routes */}
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/analytics" element={<AdminAnalytics />} />
                      <Route path="/admin/clients" element={<AdminClients />} />
                      <Route path="/admin/plans" element={<AdminPlans />} />
                      <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                      <Route path="/admin/notifications" element={<AdminNotifications />} />
                      <Route path="/admin/support" element={<AdminSupport />} />
                      <Route path="/admin/features" element={<AdminFeatures />} />
                      <Route path="/admin/ai-workflows" element={<AdminAIWorkflows />} />
                      <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/payments" element={<AdminPayments />} />
                      <Route path="/admin/trials" element={<AdminTrials />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  <PushPermissionPrompt />
                  <SecurityPrompt />
                  <DailyBriefingProvider />
                </InteractiveOnboardingProvider>
              </HejjaModeProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
};

export default App;
