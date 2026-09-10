import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AIUsageBanner } from "@/components/saas/AIUsageBanner";
import { RGECardDialog } from "./RGECardDialog";
import { NotificationBell } from "./NotificationBell";
import { AlignmentGuides } from "./AlignmentGuides";
import { Button } from "@/components/ui/button";
import { ArrowLeft, WifiOff, RefreshCw } from "lucide-react";
import { AgentChat } from "@/components/chat/AgentChat";
import { HejjaToggle } from "@/components/layout/HejjaToggle";
import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";
import { useOfflineData } from "@/hooks/useOfflineData";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
  showBackButton?: boolean;
  showAgentChat?: boolean;
  showRGECard?: boolean;
}

export const MobileLayout = ({
  children,
  title,
  showNav = true,
  showBackButton = false,
  showAgentChat = true,
  showRGECard = true,
}: MobileLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [agentOpen, setAgentOpen] = useState(false);

  const {
    pendingCount: pendingDocsCount,
    isSyncing: isSyncingDocs,
    isOnline: isOnlineDocs,
    syncPendingDocuments,
  } = useOfflineDocuments();
  const {
    pendingEtudesCount,
    pendingWhatsAppCount,
    isSyncing: isSyncingData,
    isOnline: isOnlineData,
    syncAll,
  } = useOfflineData();

  const isOnline = isOnlineDocs && isOnlineData;
  const totalPending =
    pendingDocsCount + pendingEtudesCount + pendingWhatsAppCount;
  const isSyncing = isSyncingDocs || isSyncingData;

  const handleHeaderSync = async () => {
    if (!isOnline || totalPending === 0 || isSyncing) return;
    await Promise.all([syncPendingDocuments(), syncAll()]);
  };

  // Hide RGE card on etude pages
  const isEtudePage = location.pathname.includes("/etude");
  const shouldShowRGECard = showRGECard && !isEtudePage;
  // Hide agent chat button on etude pages
  const shouldShowAgent = showAgentChat && !isEtudePage;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      {title && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60 safe-top">
          <div className="flex items-center h-14 px-4">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="mr-2 h-10 w-10 min-h-[40px] min-w-[40px] rounded-lg"
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate("/");
                  }
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className={`font-display text-base font-semibold text-foreground tracking-tight ${!showBackButton ? 'flex-1 text-center' : 'flex-1'}`}>
              {title}
            </h1>
            <div className="flex items-center gap-1">
              {/* Hejja Toggle - fixed in header */}
              <HejjaToggle />
              {/* Agent Chat button - fixed in header */}
              {shouldShowAgent && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAgentOpen(true)}
                  className="h-9 w-9 rounded-full hover:bg-muted"
                >
                  <span className="text-base">🤖</span>
                </Button>
              )}
              {!isOnline && (
                <button
                  onClick={handleHeaderSync}
                  disabled={isSyncing}
                  className="relative p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-60"
                  aria-label="Hors-ligne"
                  title="Hors-ligne"
                >
                  {isSyncing ? (
                    <RefreshCw className="h-5 w-5 text-destructive animate-spin" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-destructive" />
                  )}
                  {totalPending > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                      {totalPending > 9 ? "9+" : totalPending}
                    </span>
                  )}
                </button>
              )}
              <NotificationBell />
              {shouldShowRGECard && <RGECardDialog />}
            </div>
          </div>
        </header>
      )}

      {/* Main Content - ensure proper spacing for bottom nav */}
      <main className={`flex-1 ${showNav ? "pb-28 sm:pb-24" : ""} max-w-5xl w-full md:mx-auto md:px-2`}>{children}</main>

      {/* AI usage banner (shown only when warning/capped) */}
      <AIUsageBanner />

      {/* Offline indicator moved to header */}

      {/* Agent Chat - controlled by header button */}
      {shouldShowAgent && (
        <AgentChat externalOpen={agentOpen} onExternalOpenChange={setAgentOpen} />
      )}

      {/* Alignment guides for draggable buttons */}
      <AlignmentGuides />

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </div>
  );
};
