import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { GoogleAccountSettings } from "@/components/settings/GoogleAccountSettings";
import {
  User,
  Mail,
  Database,
  Euro,
  Calculator,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Sun,
  Percent,
  MapPin,
  Clock,
} from "lucide-react";

const settingsSections = [
  {
    title: "Profil",
    items: [
      {
        icon: User,
        label: "Mon profil",
        description: "Nom, téléphone, email",
        action: "navigate",
      },
      {
        icon: Bell,
        label: "Notifications",
        description: "Alertes RDV, rappels",
        action: "navigate",
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
        action: "navigate",
      },
      {
        icon: Clock,
        label: "Tolérance matching",
        description: "±2h pour détection doublons",
        action: "navigate",
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
        action: "navigate",
      },
      {
        icon: MapPin,
        label: "Orientation / Inclinaison",
        description: "Coefficients de production",
        action: "navigate",
      },
      {
        icon: Euro,
        label: "Tarifs revente",
        description: "Prix kWh revente/autoconso",
        action: "navigate",
      },
      {
        icon: Calculator,
        label: "Prix bouquets",
        description: "Tarifs installations",
        action: "navigate",
      },
      {
        icon: Percent,
        label: "Commissions",
        description: "Grilles de rémunération",
        action: "navigate",
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
        action: "navigate",
      },
    ],
  },
];

const Parametres = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
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
                  <Sun className="h-4 w-4 text-accent-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Mode sombre
                </span>
              </div>
              <Switch />
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
