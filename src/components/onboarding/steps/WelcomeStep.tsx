import { 
  Sun, 
  Calendar, 
  FileText, 
  BarChart3, 
  Sparkles, 
  Bot,
  Zap,
  Shield
} from "lucide-react";
import { motion } from "framer-motion";

export function WelcomeStep() {
  return (
    <div className="text-center space-y-4 sm:space-y-6">
      {/* Animated Logo - smaller on mobile */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="mx-auto w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg"
      >
        <Sun className="h-8 w-8 sm:h-12 sm:w-12 text-primary-foreground" />
      </motion.div>

      {/* Title - responsive text */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Bienvenue sur DébalePro
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2 max-w-xs mx-auto">
          L'app tout-en-un pour les commerciaux ENR
        </p>
      </motion.div>

      {/* Features grid - compact on mobile */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-2 sm:gap-3"
      >
        <FeatureCard
          icon={Calendar}
          title="Planning"
          description="Gérez vos RDV"
          color="from-blue-500 to-blue-600"
        />
        <FeatureCard
          icon={FileText}
          title="Études"
          description="Devis auto"
          color="from-amber-500 to-orange-500"
        />
        <FeatureCard
          icon={Bot}
          title="Assistant IA"
          description="24h/24"
          color="from-green-500 to-emerald-500"
        />
        <FeatureCard
          icon={BarChart3}
          title="CRM"
          description="Suivi ventes"
          color="from-purple-500 to-violet-500"
        />
      </motion.div>

      {/* Badges - smaller on mobile */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
          <span>Rapide</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
          <span>Sécurisé</span>
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
          <span>Intelligent</span>
        </div>
      </motion.div>

      {/* CTA hint */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-xs sm:text-sm text-muted-foreground"
      >
        Découvrons ensemble les fonctionnalités 🚀
      </motion.p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/50 text-left">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-1.5 sm:mb-2`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>
      <h3 className="font-semibold text-xs sm:text-sm">{title}</h3>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
