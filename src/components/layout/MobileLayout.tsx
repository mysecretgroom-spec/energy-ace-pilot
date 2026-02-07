import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { RGECardDialog } from "./RGECardDialog";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AgentChat } from "@/components/chat/AgentChat";

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

  // Hide RGE card on etude pages
  const isEtudePage = location.pathname.includes("/etude");
  const shouldShowRGECard = showRGECard && !isEtudePage;

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
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className={`font-display text-base font-semibold text-foreground tracking-tight ${!showBackButton ? 'flex-1 text-center' : 'flex-1'}`}>
              {title}
            </h1>
            <div className="flex items-center gap-1">
              <NotificationBell />
              {shouldShowRGECard && <RGECardDialog />}
            </div>
          </div>
        </header>
      )}

      {/* Main Content - ensure proper spacing for bottom nav */}
      <main className={`flex-1 ${showNav ? "pb-28 sm:pb-24" : ""}`}>{children}</main>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Agent Chat */}
      {showAgentChat && <AgentChat />}

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </div>
  );
};
