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
    <div className="space-y-4 sm:space-y-6">
      {/* Header - compact on mobile */}
      <div className="text-center">
        <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center mb-2 sm:mb-4">
          <Settings className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold">Données de Référence</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          Tarifs, aides et paramètres par produit
        </p>
      </div>

      {/* Info banner - compact on mobile */}
      <div className="p-2.5 sm:p-3 rounded-md sm:rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-2">
          <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-medium">Valeurs par défaut pré-configurées</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              Personnalisables dans les paramètres
            </p>
          </div>
        </div>
      </div>

      {/* Product sections - touch-friendly */}
      <div className="space-y-1.5 sm:space-y-2">
        {PRODUCT_SECTIONS.map((section) => (
          <button
            key={section.title}
            onClick={() => handleNavigate(section.path)}
            className="w-full flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-md sm:rounded-lg bg-muted/50 active:bg-muted transition-colors text-left touch-manipulation"
          >
            <div className={cn("p-1.5 sm:p-2 rounded-md sm:rounded-lg", section.bgColor)}>
              <section.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", section.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-xs sm:text-sm">{section.title}</h4>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{section.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      {/* Skip hint */}
      <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
        Modifiable dans Paramètres → Tables DATA
      </p>
    </div>
  );
}
