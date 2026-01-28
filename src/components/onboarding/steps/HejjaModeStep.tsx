import { 
  Flame, 
  Eye, 
  EyeOff,
  DollarSign,
  Users,
  Lock,
  Moon,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

const HEJJA_FEATURES = [
  {
    icon: Eye,
    title: "Données sensibles",
    description: "Accès aux régies et bouquets marqués 'HEJJA'",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: DollarSign,
    title: "Prix sans plafond",
    description: "Supprime les limites de prix dans les études",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Users,
    title: "Retape client",
    description: "Dupliquer un client pour un nouveau cycle de vente",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Moon,
    title: "Mode sombre",
    description: "Activation exclusive du thème dark",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
  },
];

export function HejjaModeStep() {
  return (
    <div className="space-y-5">
      {/* Header with flame animation */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-yellow-500 flex items-center justify-center mb-4 relative overflow-hidden"
        >
          <motion.div
            animate={{ 
              y: [0, -3, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.5,
              ease: "easeInOut"
            }}
          >
            <Flame className="h-8 w-8 text-white" />
          </motion.div>
          {/* Fire glow effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/50 to-transparent" />
        </motion.div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
          Mode HEJJA
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fonctionnalités avancées réservées aux experts
        </p>
      </div>

      {/* Warning banner */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Mode restreint
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
            Activez HEJJA via le bouton 🔥 en bas à gauche de l'écran
          </p>
        </div>
      </motion.div>

      {/* Features grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-2"
      >
        {HEJJA_FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * (index + 1) }}
            className="p-3 rounded-xl bg-muted/50 text-left group"
          >
            <div className={`w-8 h-8 rounded-lg ${feature.bgColor} flex items-center justify-center mb-2`}>
              <feature.icon className={`h-4 w-4 ${feature.color}`} />
            </div>
            <h4 className="font-medium text-xs">{feature.title}</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Visibility explanation */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Ce qui change quand HEJJA est actif
        </h4>
        <div className="p-3 rounded-lg bg-muted/30 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-green-600" />
            <span>Régies et bouquets HEJJA <strong>visibles</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff className="h-3.5 w-3.5 text-red-600" />
            <span>Ces éléments sont <strong>masqués</strong> en mode normal</span>
          </div>
        </div>
      </div>

      {/* Activation hint */}
      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">
          Retrouvez le toggle HEJJA 🔥 dans la barre de navigation
        </p>
      </div>
    </div>
  );
}
