import { ReactNode, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useSaasAdmin } from "@/hooks/useSaasAdmin";
import { useAuth } from "@/hooks/useAuth";
import { AdminMFAGate } from "@/components/admin/AdminMFAGate";
import { 
  Users, 
  CreditCard, 
  Bell, 
  MessageSquare, 
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Loader2,
  Shield,
  BarChart3,
  ScrollText,
  Bot,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/admin/users", label: "Utilisateurs", icon: Users },
  { path: "/admin/clients", label: "Clients", icon: Users },
  { path: "/admin/plans", label: "Offres", icon: CreditCard },
  { path: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
  { path: "/admin/ai-workflows", label: "Workflows IA", icon: Bot },
  { path: "/admin/notifications", label: "Notifications", icon: Bell },
  { path: "/admin/support", label: "Support", icon: MessageSquare },
  { path: "/admin/features", label: "Améliorations", icon: Lightbulb },
  { path: "/admin/audit-logs", label: "Logs d'Audit", icon: ScrollText },
];

function AdminSidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <div className={cn("p-4 border-b", collapsed ? "px-2" : "p-4")}>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-foreground truncate">Admin Panel</h1>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>

      <SidebarContent>
        <SidebarGroup defaultOpen>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.path}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className={cn("border-t p-2 space-y-1", collapsed ? "px-1" : "p-3")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size={collapsed ? "icon" : "default"}
              className={cn("w-full", !collapsed && "justify-start gap-2")}
              onClick={() => navigate("/")}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">Quitter l'admin</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Quitter l'admin</TooltipContent>}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size={collapsed ? "icon" : "default"}
              className={cn("w-full text-muted-foreground", !collapsed && "justify-start gap-2")}
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">Déconnexion</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Déconnexion</TooltipContent>}
        </Tooltip>
      </div>
    </Sidebar>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isAdmin, isLoading } = useSaasAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminMFAGate>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center border-b bg-background px-4 shrink-0">
              <SidebarTrigger />
              <span className="ml-3 text-sm font-medium text-muted-foreground">Administration</span>
            </header>
            <main className="flex-1 overflow-auto">
              <div className="p-4 md:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminMFAGate>
  );
}
