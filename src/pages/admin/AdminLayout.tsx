import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useSaasAdmin } from "@/hooks/useSaasAdmin";
import { useAuth } from "@/hooks/useAuth";
import { AdminMFAGate } from "@/components/admin/AdminMFAGate";
import {
  Users, CreditCard, Bell, MessageSquare, Lightbulb, LayoutDashboard, LogOut, Loader2,
  BarChart3, ScrollText, Bot, Building2, Package, Search, ArrowLeft, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

interface AdminLayoutProps { children: ReactNode }

const navGroups = [
  { label: "Vue d'ensemble", items: [
    { path: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
    { path: "/admin/analytics", label: "Revenus & croissance", icon: BarChart3 },
  ]},
  { label: "Clients", items: [
    { path: "/admin/users", label: "Comptes", icon: Users },
    { path: "/admin/clients", label: "Clients", icon: Building2 },
    { path: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
    { path: "/admin/payments", label: "Paiements manuels", icon: Wallet },
    { path: "/admin/plans", label: "Offres", icon: Package },
  ]},
  { label: "Produit", items: [
    { path: "/admin/ai-workflows", label: "Workflows IA", icon: Bot },
    { path: "/admin/features", label: "Améliorations", icon: Lightbulb },
  ]},
  { label: "Opérations", items: [
    { path: "/admin/support", label: "Support", icon: MessageSquare },
    { path: "/admin/notifications", label: "Notifications", icon: Bell },
    { path: "/admin/audit-logs", label: "Journal d'audit", icon: ScrollText },
  ]},
];
const allItems = navGroups.flatMap((g) => g.items);

function AdminSidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b">
        <div className="h-7 w-7 rounded-sm bg-primary text-primary-foreground grid place-items-center font-display text-xs font-bold">DP</div>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-tight">DébalePro</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Console admin</p>
        </div>
      </div>
      <SidebarContent className="py-2">
        {navGroups.map((g) => (
          <SidebarGroup key={g.label} className="py-1">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuButton key={item.path} asChild isActive={location.pathname === item.path} className="h-8 text-[13px]">
                    <Link to={item.path}><item.icon className="h-4 w-4" /><span>{item.label}</span></Link>
                  </SidebarMenuButton>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <div className="border-t p-3 space-y-1">
        <p className="px-2 pb-1 text-xs text-muted-foreground truncate">{user?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />Retour à l'app
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-muted-foreground" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />Déconnexion
        </Button>
      </div>
    </Sidebar>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isAdmin, isLoading } = useSaasAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/");
  }, [isAdmin, isLoading, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCmdOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return null;

  const current = allItems.find((i) => i.path === location.pathname);

  return (
    <AdminMFAGate>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-muted/30">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 shrink-0">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground hidden sm:inline">Admin</span>
              <span className="text-muted-foreground hidden sm:inline">/</span>
              <span className="text-sm font-medium truncate">{current?.label ?? "Administration"}</span>
              <button
                onClick={() => setCmdOpen(true)}
                className={cn("ml-auto flex items-center gap-2 h-8 rounded-md border bg-background px-3 text-sm text-muted-foreground",
                  "hover:bg-muted transition-colors duration-100 w-auto sm:w-72")}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline flex-1 text-left">Rechercher…</span>
                <kbd className="hidden sm:inline text-[10px] font-mono border rounded px-1">⌘K</kbd>
              </button>
            </header>
            <main className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-[1400px] p-4 md:p-8">{children}</div>
            </main>
          </div>
        </div>
        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
          <CommandInput placeholder="Aller à une page…" />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            {navGroups.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map((i) => (
                  <CommandItem key={i.path} onSelect={() => { setCmdOpen(false); navigate(i.path); }}>
                    <i.icon className="mr-2 h-4 w-4" />{i.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>
      </SidebarProvider>
    </AdminMFAGate>
  );
}
