import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { GoogleAccountSettings } from "@/components/settings/GoogleAccountSettings";
import { toast } from "sonner";
import {
  User,
  Euro,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Sun,
  Compass,
  Clock,
  Zap,
  Gauge,
  Gift,
  Target,
  Building2,
  Settings2,
  MessageCircle,
  Scale,
  Bot,
  Thermometer,
  Home,
  Layers,
  PaintBucket,
  ChevronDown,
  Flame,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Données communes
const dataSharedItems = [
  { icon: Flame, label: "Prix énergies fossiles", description: "Gaz, fioul, propane, bois", path: "/parametres/data-energies-prix" },
  { icon: MapPin, label: "Zones climatiques (DJU)", description: "Besoins chauffage par région", path: "/parametres/data-zones-climatiques" },
];

// Données PV
const dataPvItems = [
  { icon: Sun, label: "PSH / Heures ensoleillement", description: "Par département", path: "/parametres/data-psh" },
  { icon: Compass, label: "Orientation / Inclinaison", description: "Coefficients de production", path: "/parametres/data-orientation" },
  { icon: Euro, label: "Tarifs revente", description: "Prix kWh revente/autoconso", path: "/parametres/data-tarifs" },
  { icon: Zap, label: "Types de compteurs", description: "Monophasé, triphasé", path: "/parametres/data-compteurs" },
  { icon: Gauge, label: "Calibres disjoncteur", description: "Ampérage et puissances", path: "/parametres/data-calibres" },
  { icon: Gift, label: "Aides & Primes PV", description: "Prime autoconso, éco TVA", path: "/parametres/data-aides" },
];

// Données PAC
const dataPacItems = [
  { icon: Shield, label: "Niveaux d'isolation", description: "Coefficients et besoins kWh/m²", path: "/parametres/data-isolation-pac" },
  { icon: Thermometer, label: "COP par température", description: "Performance selon T° ext.", path: "/parametres/data-cop-pac" },
  { icon: Zap, label: "Puissances recommandées", description: "kW selon surface", path: "/parametres/data-puissances-pac" },
  { icon: Zap, label: "Types de compteurs", description: "Monophasé, triphasé", path: "/parametres/data-compteurs" },
  { icon: Gauge, label: "Calibres disjoncteur", description: "Ampérage et puissances kVA", path: "/parametres/data-calibres" },
  { icon: Gift, label: "Aides & Primes PAC", description: "MaPrimeRénov, CEE", path: "/parametres/data-aides-pac" },
];

// Données ITE
const dataIteItems = [
  { icon: Layers, label: "Types d'isolants", description: "Lambda, prix au m²", path: "/parametres/data-isolants-ite" },
  { icon: PaintBucket, label: "Finitions", description: "Enduit, bardage, prix", path: "/parametres/data-finitions-ite" },
  { icon: Home, label: "Types de murs", description: "R initial selon mur existant", path: "/parametres/data-murs-ite" },
  { icon: Gift, label: "Aides & Primes ITE", description: "MaPrimeRénov, CEE", path: "/parametres/data-aides-ite" },
];

const settingsSections = [
  {
    title: "Profil",
    items: [
      { icon: User, label: "Mon profil", description: "Nom, téléphone, email", path: "/profil" },
      { icon: Target, label: "Mes objectifs", description: "CA, ventes, RDV mensuels", path: "/parametres/objectifs" },
      { icon: Bell, label: "Notifications", description: "Alertes RDV, rappels", path: "/notifications" },
    ],
  },
  {
    title: "WhatsApp",
    items: [
      { icon: Bot, label: "Assistant IA", description: "Agent WhatsApp intelligent", path: "/parametres/whatsapp-agent" },
      { icon: MessageCircle, label: "Messages personnalisés", description: "Templates par statut de RDV", path: "/parametres/whatsapp-templates" },
    ],
  },
  {
    title: "Régies & Sources",
    items: [
      { icon: Building2, label: "Régies", description: "Sources RDV, emails, contacts, tarifs", path: "/parametres/regies" },
    ],
  },
  {
    title: "Planning",
    items: [
      { icon: Clock, label: "Jours travaillés", description: "Jours affichés dans la vue semaine", path: "/parametres/jours-travailles" },
    ],
  },
  {
    title: "Import RDV",
    items: [
      { icon: Clock, label: "Sync Gmail automatique", description: "Import périodique des RDV", path: "/parametres/gmail-auto-sync" },
    ],
  },
  {
    title: "Automatisations",
    items: [
      { icon: Clock, label: "Transition ventes", description: "Délai Posé → Attente paiement", path: "/parametres/ventes" },
    ],
  },
  {
    title: "Sécurité",
    items: [
      { icon: Shield, label: "Code PIN / Biométrie", description: "Accès mode interne", path: "/parametres/securite" },
    ],
  },
  {
    title: "Légal",
    items: [
      { icon: Scale, label: "Documents légaux", description: "CGU, CGV, Confidentialité, Sécurité", path: "/legal" },
    ],
  },
];

interface DataProductSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  items: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; description: string; path: string }>;
  defaultOpen?: boolean;
}

const DataProductSection = ({ title, icon: Icon, iconColor, bgColor, items, defaultOpen = false }: DataProductSectionProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-card overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", bgColor)}>
              <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{items.length} paramètres</p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t divide-y divide-border">
            {items.map((item) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-3 p-4 pl-12 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(item.path)}
                >
                  <div className="p-2 rounded-lg bg-muted">
                    <ItemIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const Parametres = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <MobileLayout title="Paramètres">
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Header profil - clickable */}
        <Card 
          className="shadow-card overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate("/profil")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-hero flex items-center justify-center">
                <User className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">Mon Profil</h2>
                <p className="text-sm text-muted-foreground">
                  Voir et modifier mes informations
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Google Account Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Intégrations
          </h3>
          <GoogleAccountSettings />
        </div>

        {/* Notifications Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Notifications
          </h3>
          <Card 
            className="shadow-card overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate("/parametres/notifications-push")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Notifications Push</p>
                  <p className="text-xs text-muted-foreground">Alertes sur téléphone</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables Section - Organized by Product */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Tables DATA par Produit
          </h3>
          <div className="space-y-2">
            <DataProductSection
              title="Données Communes"
              icon={Flame}
              iconColor="text-red-600"
              bgColor="bg-red-500/10"
              items={dataSharedItems}
              defaultOpen
            />
            <DataProductSection
              title="Données Photovoltaïque (PV)"
              icon={Sun}
              iconColor="text-yellow-600"
              bgColor="bg-yellow-500/10"
              items={dataPvItems}
            />
            <DataProductSection
              title="Données Pompe à Chaleur (PAC)"
              icon={Thermometer}
              iconColor="text-blue-600"
              bgColor="bg-blue-500/10"
              items={dataPacItems}
            />
            <DataProductSection
              title="Données Isolation (ITE)"
              icon={Home}
              iconColor="text-orange-600"
              bgColor="bg-orange-500/10"
              items={dataIteItems}
            />
          </div>
        </div>

        {/* Sections de paramètres */}
        {settingsSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">
              {section.title}
            </h3>
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 divide-y divide-border">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const handleClick = () => {
                    if (item.path) {
                      navigate(item.path);
                    } else {
                      toast.info("Fonctionnalité à venir", {
                        description: "Cette option sera disponible prochainement"
                      });
                    }
                  };
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={handleClick}
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Admin Section - Only visible for admins */}
        {isAdmin && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">
              Administration
            </h3>
            <Card 
              className="shadow-card overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors border-amber-500/30"
              onClick={() => navigate("/admin")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Settings2 className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Panel Admin</p>
                    <p className="text-xs text-muted-foreground">Gestion utilisateurs, abonnements</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Déconnexion */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          DébalePro v1.0.0 • © 2026
        </p>
      </div>
    </MobileLayout>
  );
};

export default Parametres;
