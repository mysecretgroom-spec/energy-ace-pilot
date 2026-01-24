import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { Footer } from "./Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
  showBackButton?: boolean;
}

export const MobileLayout = ({
  children,
  title,
  showNav = true,
  showBackButton = false,
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

      {/* Footer */}
      <Footer />

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </div>
  );
};
