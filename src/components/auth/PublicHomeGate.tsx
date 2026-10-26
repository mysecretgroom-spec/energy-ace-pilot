import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageLoading } from "@/components/common/PageState";
import { ProtectedRoute } from "./ProtectedRoute";
import Accueil from "@/pages/Accueil";

/** Homepage: signed-out visitors (and payment reviewers) see the public product/pricing page instead of a login wall. */
export function PublicHomeGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading fullScreen />;
  if (!user) return <Accueil />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
