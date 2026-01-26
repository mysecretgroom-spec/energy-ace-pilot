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
    <div className="text-center space-y-6">
      {/* Animated Logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg"
      >
        <Sun className="h-12 w-12 text-primary-foreground" />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Bienvenue sur DébalePro
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
          L'application tout-en-un pour les commerciaux de l'énergie solaire
        </p>
      </motion.div>

      {/* Features grid */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
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
          description="Devis automatisés"
          color="from-amber-500 to-orange-500"
        />
        <FeatureCard
          icon={Bot}
          title="Assistant IA"
          description="24h/24 à vos côtés"
          color="from-green-500 to-emerald-500"
        />
        <FeatureCard
          icon={BarChart3}
          title="CRM"
          description="Suivez vos ventes"
          color="from-purple-500 to-violet-500"
        />
      </motion.div>

      {/* Badges */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center gap-4 text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>Rapide</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-green-600" />
          <span>Sécurisé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Intelligent</span>
        </div>
      </motion.div>

      {/* CTA hint */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-sm text-muted-foreground"
      >
        Découvrons ensemble toutes les fonctionnalités 🚀
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
    <div className="p-3 rounded-xl bg-muted/50 text-left group hover:bg-muted/70 transition-colors">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
