import { 
  Settings, 
  Calendar, 
  Building2, 
  Bell, 
  UserCircle,
  ChevronRight,
  Shield,
  Clock,
  Palette,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const SETTINGS_SECTIONS = [
  {
    icon: Building2,
    title: "Régies",
    description: "Configurez vos agences partenaires et leurs contacts",
    path: "/parametres/regies",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Clock,
    title: "Jours travaillés",
    description: "Définissez vos jours et horaires de travail",
    path: "/parametres/jours-travailles",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Push, WhatsApp et alertes automatiques",
    path: "/parametres/notifications-push",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: UserCircle,
    title: "Objectifs",
    description: "Fixez vos objectifs mensuels de CA et ventes",
    path: "/parametres/objectifs",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Shield,
    title: "Sécurité",
    description: "PIN, 2FA et gestion des accès",
    path: "/parametres/securite",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
  },
];

export function SettingsStep() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4"
        >
          <Settings className="h-7 w-7 text-primary" />
        </motion.div>
        <h2 className="text-xl font-bold">Paramètres Clés</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez l'application selon vos besoins
        </p>
      </div>

      {/* Settings sections */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        {SETTINGS_SECTIONS.map((section, index) => (
          <motion.button
            key={section.title}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 * (index + 1) }}
            onClick={() => navigate(section.path)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group"
          >
            <div className={`p-2 rounded-lg ${section.bgColor}`}>
              <section.icon className={`h-5 w-5 ${section.color}`} />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">{section.title}</h4>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        ))}
      </motion.div>

      {/* Tip */}
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          💡 <strong>Astuce :</strong> Commencez par configurer vos régies pour attribuer automatiquement les RDV et suivre vos commissions par source.
        </p>
      </div>
    </div>
  );
}
