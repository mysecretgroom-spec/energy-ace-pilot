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
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border/60 safe-bottom" {...props}>
        {/* Background jobs indicator - fixed top right of nav */}
        <div className="absolute -top-10 right-2">
          <BackgroundJobsIndicator />
        </div>
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 rounded-lg transition-all duration-150 active:scale-95 touch-action-manipulation",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-md transition-all duration-150",
                  isActive && "bg-primary/10"
                )}>
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-150",
                      isActive && "scale-105"
                    )}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-tight transition-all duration-150",
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
