import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { GoogleAccountSettings } from "@/components/settings/GoogleAccountSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { toast } from "sonner";
import {
  User,
  Mail,
  Euro,
  Calculator,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Sun,
  Percent,
  Compass,
  Clock,
  Moon,
  Zap,
  Gauge,
  Gift,
  CreditCard,
  MessageCircle,
} from "lucide-react";

const settingsSections = [
  {
    title: "Profil",
    items: [
      {
        icon: User,
        label: "Mon profil",
        description: "Nom, téléphone, email",
        path: "/profil",
      },
      {
        icon: Bell,
        label: "Notifications",
        description: "Alertes RDV, rappels",
        path: "/notifications",
      },
    ],
  },
  {
    title: "Import RDV",
    items: [
      {
        icon: Mail,
        label: "Emails autorisés",
        description: "Sources d'import RDV",
        path: "/parametres/emails-autorises",
      },
      {
        icon: Clock,
        label: "Tolérance matching",
        description: "±2h pour détection doublons",
        path: null, // Configuration simple, pas besoin de page
      },
    ],
  },
  {
    title: "Tables DATA",
    items: [
      {
        icon: Sun,
        label: "PSH / Heures ensoleillement",
        description: "Par département",
        path: "/parametres/data-psh",
      },
      {
        icon: Compass,
        label: "Orientation / Inclinaison",
        description: "Coefficients de production",
        path: "/parametres/data-orientation",
      },
      {
        icon: Euro,
        label: "Tarifs revente",
        description: "Prix kWh revente/autoconso",
        path: "/parametres/data-tarifs",
      },
      {
        icon: Calculator,
        label: "Prix bouquets",
        description: "Tarifs installations",
        path: "/parametres/data-bouquets",
      },
      {
        icon: Percent,
        label: "Commissions",
        description: "Grilles de rémunération",
        path: "/parametres/data-commissions",
      },
      {
        icon: Zap,
        label: "Types de compteurs",
        description: "Monophasé, triphasé",
        path: "/parametres/data-compteurs",
      },
      {
        icon: Gauge,
        label: "Calibres disjoncteur",
        description: "Ampérage et puissances",
        path: "/parametres/data-calibres",
      },
      {
        icon: Gift,
        label: "Aides & Primes",
        description: "Prime autoconso, éco TVA",
        path: "/parametres/data-aides",
      },
      {
        icon: CreditCard,
        label: "Financements",
        description: "Taux, TAEG, durées",
        path: "/parametres/data-financements",
      },
    ],
  },
  {
    title: "Sécurité",
    items: [
      {
        icon: Shield,
        label: "Code PIN / Biométrie",
        description: "Accès mode interne",
        path: null, // TODO: PIN/biometric setup
      },
    ],
  },
];

const Parametres = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <MobileLayout title="Paramètres">
      <div className="p-4 space-y-6">
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

        {/* Notification Settings Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Notifications
          </h3>
          <NotificationSettings />
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
                        <p className="text-sm font-medium text-foreground">
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Mode sombre */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <Moon className="h-4 w-4 text-accent-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Mode sombre
                </span>
              </div>
              <Switch 
                checked={darkMode} 
                onCheckedChange={setDarkMode}
              />
            </div>
          </CardContent>
        </Card>

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
          SolarFlow v1.0.0 • © 2026
        </p>
      </div>
    </MobileLayout>
  );
};

export default Parametres;
