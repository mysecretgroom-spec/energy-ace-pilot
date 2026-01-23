import { Sun, Calendar, FileText, BarChart3, Sparkles } from "lucide-react";

export function WelcomeStep() {
  return (
    <div className="text-center space-y-6">
      {/* Logo / Icon */}
      <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <Sun className="h-10 w-10 text-primary" />
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Bienvenue sur SolarFlow
        </h2>
        <p className="text-muted-foreground mt-2">
          Votre application métier pour gérer vos rendez-vous, clients et ventes en toute simplicité.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-4 pt-4">
        <FeatureCard
          icon={Calendar}
          title="Planning"
          description="Gérez vos RDV et synchronisez avec Google"
        />
        <FeatureCard
          icon={FileText}
          title="Études"
          description="Créez des études techniques professionnelles"
        />
        <FeatureCard
          icon={BarChart3}
          title="CRM"
          description="Suivez vos clients et ventes"
        />
        <FeatureCard
          icon={Sparkles}
          title="Automatisations"
          description="WhatsApp, notifications, sync auto"
        />
      </div>

      {/* Hint */}
      <p className="text-sm text-muted-foreground pt-2">
        Configurons ensemble votre application en quelques étapes 🚀
      </p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-muted/50 text-left">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
