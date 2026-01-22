import * as React from "react";
import { Home, Calendar, Briefcase, Wallet, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

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
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 py-2 px-1 touch-target transition-all duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-all duration-200",
                    isActive && "font-semibold"
                  )}
                >
                  {label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary animate-fade-in" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }
);

BottomNav.displayName = "BottomNav";
