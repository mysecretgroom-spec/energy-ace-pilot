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
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/clients", label: "Clients", icon: Users },
  { path: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
  { path: "/admin/notifications", label: "Notifications", icon: Bell },
  { path: "/admin/support", label: "Support", icon: MessageSquare },
  { path: "/admin/features", label: "Améliorations", icon: Lightbulb },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isAdmin, isLoading } = useSaasAdmin();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card flex flex-col">
          <div className="p-6 border-b">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => signOut()}
            >
              <LogOut className="h-5 w-5" />
              Déconnexion
            </Button>
          </div>
        </aside>
        
        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </AdminMFAGate>
  );
}
