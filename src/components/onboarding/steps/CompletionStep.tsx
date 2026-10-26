import { 
  CheckCircle, 
  Rocket, 
  Calendar, 
  FileText, 
  Users, 
  Bot,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export function CompletionStep() {
  return (
    <div className="text-center space-y-4 sm:space-y-6">
      {/* Success animation - smaller on mobile */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="mx-auto w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
        </motion.div>
      </motion.div>

      {/* Title - responsive */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Vous êtes prêt ! 🎉
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          L'app est configurée et prête
        </p>
      </motion.div>

      {/* Quick actions - compact on mobile */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="space-y-1.5 sm:space-y-2"
      >
        <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
          Actions rapides
        </p>
        
        <QuickAction
          icon={Calendar}
          title="Planning"
          description="Consultez vos RDV"
          path="/planning"
        />
        <QuickAction
          icon={Users}
          title="CRM"
          description="Gérez vos ventes"
          path="/crm"
        />
        <QuickAction
          icon={Bot}
          title="Assistant IA"
          description="Bouton en bas à droite"
          highlight
        />
      </motion.div>

      {/* Rocket animation - smaller on mobile */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="pt-1 sm:pt-2"
      >
        <motion.div
          animate={{ y: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <Rocket className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto" />
        </motion.div>
      </motion.div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  path,
  highlight,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  path?: string;
  highlight?: boolean;
}) {
  const content = (
    <div className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl text-left transition-colors touch-manipulation active:scale-[0.98] ${
      highlight 
        ? "bg-primary/10 border border-primary/20"
        : "bg-muted/50"
    }`}>
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg flex items-center justify-center shrink-0 ${
        highlight 
          ? "bg-gradient-to-br from-primary to-primary/60"
          : "bg-background border"
      }`}>
        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${highlight ? "text-primary-foreground" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-xs sm:text-sm flex items-center gap-1">
          {title}
          {highlight && <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />}
        </h4>
        <p className="text-xs sm:text-xs text-muted-foreground truncate">{description}</p>
      </div>
      {path && <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />}
    </div>
  );

  if (path) {
    return <Link to={path}>{content}</Link>;
  }
  
  return content;
}
