import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
// Settings sub-pages
import EmailsAutorises from "./pages/settings/EmailsAutorises";
import DataPSH from "./pages/settings/DataPSH";
import DataOrientation from "./pages/settings/DataOrientation";
import DataTarifs from "./pages/settings/DataTarifs";
import DataBouquets from "./pages/settings/DataBouquets";
import DataCommissions from "./pages/settings/DataCommissions";
import DataCompteurs from "./pages/settings/DataCompteurs";
import DataCalibres from "./pages/settings/DataCalibres";
import DataAides from "./pages/settings/DataAides";
import DataFinancements from "./pages/settings/DataFinancements";
import WhatsAppSettings from "./pages/settings/WhatsAppSettings";
import React, { useEffect } from "react";

const queryClient = new QueryClient();

// Initialize theme from localStorage
const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
};

// App component with authentication
const App = () => {
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
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
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
                <Route path="/parametres/emails-autorises" element={<ProtectedRoute><EmailsAutorises /></ProtectedRoute>} />
                <Route path="/parametres/data-psh" element={<ProtectedRoute><DataPSH /></ProtectedRoute>} />
                <Route path="/parametres/data-orientation" element={<ProtectedRoute><DataOrientation /></ProtectedRoute>} />
                <Route path="/parametres/data-tarifs" element={<ProtectedRoute><DataTarifs /></ProtectedRoute>} />
                <Route path="/parametres/data-bouquets" element={<ProtectedRoute><DataBouquets /></ProtectedRoute>} />
                <Route path="/parametres/data-commissions" element={<ProtectedRoute><DataCommissions /></ProtectedRoute>} />
                <Route path="/parametres/data-compteurs" element={<ProtectedRoute><DataCompteurs /></ProtectedRoute>} />
                <Route path="/parametres/data-calibres" element={<ProtectedRoute><DataCalibres /></ProtectedRoute>} />
                <Route path="/parametres/data-aides" element={<ProtectedRoute><DataAides /></ProtectedRoute>} />
                <Route path="/parametres/data-financements" element={<ProtectedRoute><DataFinancements /></ProtectedRoute>} />
                <Route path="/parametres/whatsapp" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />
                <Route path="/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;
