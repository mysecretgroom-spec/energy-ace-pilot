import { ReactNode, useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { PaywallScreen } from "@/components/saas/PaywallScreen";
import { TrialBanner } from "@/components/saas/TrialBanner";
import { PageError, PageLoading } from "@/components/common/PageState";
import { VisitorBanner } from "@/components/auth/VisitorBanner";
import { isVisitorPathAllowed, isVisitorUser } from "@/lib/visitorMode";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { isLoading: isSaasLoading, error: accessError, retry, isPaywall, isBlocked, isInTrial, daysLeftInTrial } = useSaasAccess();
  const [saasTimedOut, setSaasTimedOut] = useState(false);

  // Offer recovery after 5s instead of bypassing the access check.
  useEffect(() => {
    if (!isSaasLoading) {
      setSaasTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn("[ProtectedRoute] Access check timed out after 5s");
      setSaasTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isSaasLoading]);

  if (loading) {
    return <PageLoading fullScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isVisitorUser(user.id)) {
    if (!isVisitorPathAllowed(location.pathname)) return <Navigate to="/planning" replace />;
    return (
      <>
        <VisitorBanner />
        {children}
      </>
    );
  }

  if (accessError || (isSaasLoading && saasTimedOut)) {
    return <PageError fullScreen title="Vérification du compte indisponible" onRetry={() => {
      setSaasTimedOut(false);
      void retry();
    }} onBack={() => window.location.reload()} />;
  }

  if (isSaasLoading) {
    return <PageLoading fullScreen />;
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
