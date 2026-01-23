import { CheckCircle, Rocket, Calendar, FileText, Users } from "lucide-react";

export function CompletionStep() {
  return (
    <div className="text-center space-y-6">
      {/* Success icon */}
      <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Vous êtes prêt ! 🎉
        </h2>
        <p className="text-muted-foreground mt-2">
          Votre application est configurée et prête à l'emploi
        </p>
      </div>

      {/* Quick start tips */}
      <div className="space-y-3 pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Par où commencer ?
        </h3>
        
        <div className="space-y-2">
          <QuickTip
            icon={Calendar}
            title="Planifiez votre premier RDV"
            description="Depuis le Planning, ajoutez un rendez-vous"
          />
          <QuickTip
            icon={Users}
            title="Ajoutez vos clients"
            description="Dans le CRM, créez votre base clients"
          />
          <QuickTip
            icon={FileText}
            title="Créez une étude"
            description="Après un RDV, générez une étude technique"
          />
        </div>
      </div>

      {/* Rocket animation */}
      <div className="pt-4">
        <Rocket className="h-8 w-8 text-primary mx-auto animate-bounce" />
      </div>
    </div>
  );
}

function QuickTip({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-left">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
