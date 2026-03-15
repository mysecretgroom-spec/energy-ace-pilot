import { ReactNode, useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { PaywallScreen } from "@/components/saas/PaywallScreen";
import { TrialBanner } from "@/components/saas/TrialBanner";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { isLoading: isSaasLoading, isPaywall, isBlocked, isInTrial, daysLeftInTrial } = useSaasAccess();
  const [saasTimedOut, setSaasTimedOut] = useState(false);

  // Prevent infinite SaaS loading: force-bypass after 5s
  useEffect(() => {
    if (!isSaasLoading) {
      setSaasTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn("[ProtectedRoute] SaaS loading timed out after 5s, bypassing...");
      setSaasTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isSaasLoading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isSaasLoading && !saasTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show paywall for users with expired trial or blocked accounts
  if (isPaywall || isBlocked) {
    return <PaywallScreen isBlocked={isBlocked} daysLeft={0} />;
  }

  return (
    <>
      {isInTrial && <TrialBanner daysLeft={daysLeftInTrial} />}
      {children}
    </>
  );
};
