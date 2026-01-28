import * as React from "react";
import { Home, Calendar, Briefcase, Wallet, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BackgroundJobsIndicator } from "./BackgroundJobsIndicator";

const navItems = [
  { icon: Home, label: "Accueil", path: "/" },
  { icon: Calendar, label: "Planning", path: "/planning" },
  { icon: Briefcase, label: "CRM", path: "/crm" },
  { icon: Wallet, label: "Finance", path: "/finance" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
];

export const BottomNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => {
    const location = useLocation();

    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-bottom" {...props}>
        {/* Background jobs indicator - fixed top right of nav */}
        <div className="absolute -top-10 right-2">
          <BackgroundJobsIndicator />
        </div>
        <div className="flex items-center justify-around h-[72px] max-w-lg mx-auto px-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 flex-1 py-3 px-2 rounded-xl transition-all duration-200 active:scale-90 touch-action-manipulation",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground active:text-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-12 h-8 rounded-full transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-transform duration-200",
                      isActive && "scale-105"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium transition-all duration-200",
                    isActive && "font-semibold text-primary"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }
);

BottomNav.displayName = "BottomNav";
