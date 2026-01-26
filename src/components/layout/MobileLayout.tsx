import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AgentChat } from "@/components/chat/AgentChat";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
  showBackButton?: boolean;
  showAgentChat?: boolean;
}

export const MobileLayout = ({
  children,
  title,
  showNav = true,
  showBackButton = false,
  showAgentChat = true,
}: MobileLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      {title && (
        <header className="sticky top-0 z-40 glass border-b border-border safe-top">
          <div className="flex items-center h-16 px-4">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="mr-2 h-12 w-12 min-h-[48px] min-w-[48px]"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            )}
            <h1 className={`text-lg font-display font-semibold text-foreground ${!showBackButton ? 'flex-1 text-center' : ''}`}>
              {title}
            </h1>
            {showBackButton && <div className="w-11" />}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${showNav ? "pb-24" : ""}`}>{children}</main>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Agent Chat */}
      {showAgentChat && <AgentChat />}

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </div>
  );
};
