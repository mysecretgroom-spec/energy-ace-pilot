import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Zap, 
  Sun, 
  ArrowRight,
  Thermometer,
  Home,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRODUCT_SECTIONS = [
  {
    icon: Sun,
    title: "Données PV",
    description: "PSH, orientation, tarifs, aides",
    path: "/parametres",
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
  },
  {
    icon: Thermometer,
    title: "Données PAC",
    description: "Isolation, COP, puissances",
    path: "/parametres",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Home,
    title: "Données ITE",
    description: "Isolants, finitions",
    path: "/parametres",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
  },
];

export function DataConfigStep() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
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
          Configurez les tarifs, aides et paramètres par produit
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

      {/* Product sections */}
      <div className="space-y-2">
        {PRODUCT_SECTIONS.map((section) => (
          <button
            key={section.title}
            onClick={() => handleNavigate(section.path)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group"
          >
            <div className={cn("p-2 rounded-lg", section.bgColor)}>
              <section.icon className={cn("h-5 w-5", section.color)} />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">{section.title}</h4>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Skip hint */}
      <p className="text-xs text-center text-muted-foreground">
        Vous pourrez modifier ces données à tout moment dans Paramètres → Tables DATA
      </p>
    </div>
  );
}
