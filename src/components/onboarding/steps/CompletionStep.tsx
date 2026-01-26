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
    <div className="text-center space-y-6">
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <CheckCircle className="h-12 w-12 text-white" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          Vous êtes prêt ! 🎉
        </h2>
        <p className="text-muted-foreground mt-2">
          Votre application est configurée et prête à l'emploi
        </p>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="space-y-2"
      >
        <p className="text-sm font-medium text-muted-foreground mb-3">
          Actions rapides
        </p>
        
        <QuickAction
          icon={Calendar}
          title="Voir le Planning"
          description="Consultez ou créez vos RDV"
          path="/planning"
        />
        <QuickAction
          icon={Users}
          title="Ouvrir le CRM"
          description="Gérez vos clients et ventes"
          path="/crm"
        />
        <QuickAction
          icon={Bot}
          title="Parler à l'Assistant"
          description="Cliquez sur le bouton en bas à droite"
          highlight
        />
      </motion.div>

      {/* Rocket animation */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="pt-2"
      >
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <Rocket className="h-8 w-8 text-primary mx-auto" />
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
    <div className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
      highlight 
        ? "bg-primary/10 border border-primary/20 hover:bg-primary/20"
        : "bg-muted/50 hover:bg-muted"
    }`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        highlight 
          ? "bg-gradient-to-br from-primary to-primary/60"
          : "bg-background border"
      }`}>
        <Icon className={`h-5 w-5 ${highlight ? "text-primary-foreground" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          {title}
          {highlight && <Sparkles className="h-3.5 w-3.5 text-primary" />}
        </h4>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      {path && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  );

  if (path) {
    return <Link to={path}>{content}</Link>;
  }
  
  return content;
}
