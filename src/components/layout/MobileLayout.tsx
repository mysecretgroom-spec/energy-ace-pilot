import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
}

export const MobileLayout = ({
  children,
  title,
  showNav = true,
}: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      {title && (
        <header className="sticky top-0 z-40 glass border-b border-border safe-top">
          <div className="flex items-center justify-center h-14 px-4">
            <h1 className="text-lg font-display font-semibold text-foreground">
              {title}
            </h1>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${showNav ? "pb-20" : ""}`}>{children}</main>

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </div>
  );
};
