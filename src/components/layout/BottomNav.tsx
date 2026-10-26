import * as React from "react";
import { Home, Calendar, Briefcase, Wallet, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BackgroundJobsIndicator } from "./BackgroundJobsIndicator";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useAuth } from "@/hooks/useAuth";
import { isVisitorUser, VISITOR_NAV_PATHS } from "@/lib/visitorMode";

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
    const prefetch = useRoutePrefetch();
    const { user } = useAuth();
    const visitor = isVisitorUser(user?.id);
    const items = visitor ? navItems.filter((i) => VISITOR_NAV_PATHS.includes(i.path)) : navItems;

    return (
      <nav
        ref={ref}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t rounded-none safe-bottom will-change-transform"
        style={{ transform: "translateZ(0)" }}
        {...props}
      >
        {/* Background jobs indicator - fixed top right of nav */}
        <div className="absolute -top-10 right-2">
          <BackgroundJobsIndicator />
        </div>
        <div className={cn("grid h-16", visitor ? "grid-cols-2" : "grid-cols-5", " max-w-lg md:max-w-2xl mx-auto")}>
          {items.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onMouseEnter={() => prefetch(path)}
                onTouchStart={() => prefetch(path)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 transition-colors duration-100 touch-action-manipulation",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground active:text-foreground"
                )}
              >
                {/* Active indicator — trait supérieur */}
                <span
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-primary transition-opacity duration-100",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                />
                <Icon
                  className="h-6 w-6"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "text-xs font-semibold leading-none",
                    !isActive && "font-medium"
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
