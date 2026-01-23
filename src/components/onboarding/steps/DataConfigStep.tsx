import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Zap, 
  Euro, 
  Sun, 
  Gauge, 
  Package, 
  ArrowRight,
  Wallet,
  Compass,
} from "lucide-react";

const DATA_SECTIONS = [
  {
    icon: Sun,
    title: "PSH (Heures Solaires)",
    description: "Rendement par région",
    path: "/parametres/data-psh",
  },
  {
    icon: Compass,
    title: "Orientation",
    description: "Coefficients par orientation",
    path: "/parametres/data-orientation",
  },
  {
    icon: Euro,
    title: "Tarifs",
    description: "Prix par puissance kWc",
    path: "/parametres/data-tarifs",
  },
  {
    icon: Package,
    title: "Bouquets",
    description: "Offres et configurations",
    path: "/parametres/data-bouquets",
  },
  {
    icon: Wallet,
    title: "Aides Financières",
    description: "Prime autoconso, MaPrimeRénov",
    path: "/parametres/data-aides",
  },
  {
    icon: Gauge,
    title: "Compteurs & Calibres",
    description: "Types de raccordement",
    path: "/parametres/data-compteurs",
  },
];

export function DataConfigStep() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    // Close modal and navigate
    navigate(path);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
          <Settings className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold">Données de Référence</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez les tarifs, aides et paramètres techniques
        </p>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-2">
          <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Des valeurs par défaut sont déjà configurées</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vous pouvez les personnaliser à tout moment depuis les paramètres
            </p>
          </div>
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-2 gap-2">
        {DATA_SECTIONS.map((section) => (
          <button
            key={section.path}
            onClick={() => handleNavigate(section.path)}
            className="flex flex-col items-start p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group"
          >
            <section.icon className="h-5 w-5 text-primary mb-2" />
            <h4 className="font-medium text-sm">{section.title}</h4>
            <p className="text-xs text-muted-foreground">{section.description}</p>
            <ArrowRight className="h-3 w-3 text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Skip hint */}
      <p className="text-xs text-center text-muted-foreground">
        Vous pourrez modifier ces données à tout moment dans Paramètres → Données
      </p>
    </div>
  );
}
