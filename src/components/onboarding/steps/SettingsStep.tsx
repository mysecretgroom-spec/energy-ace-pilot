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
    <div className="space-y-4 sm:space-y-5">
      {/* Header - compact on mobile */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4"
        >
          <Settings className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        </motion.div>
        <h2 className="text-lg sm:text-xl font-bold">Paramètres Clés</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          Personnalisez l'app selon vos besoins
        </p>
      </div>

      {/* Settings sections - compact on mobile */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-1.5 sm:space-y-2"
      >
        {SETTINGS_SECTIONS.map((section, index) => (
          <motion.button
            key={section.title}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 * (index + 1) }}
            onClick={() => navigate(section.path)}
            className="w-full flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-muted/50 active:bg-muted transition-colors text-left touch-manipulation"
          >
            <div className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg ${section.bgColor}`}>
              <section.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${section.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-xs sm:text-sm">{section.title}</h4>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{section.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </motion.button>
        ))}
      </motion.div>

      {/* Tip - compact on mobile */}
      <div className="p-2.5 sm:p-3 rounded-md sm:rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          💡 Configurez vos régies pour attribuer les RDV et suivre vos commissions.
        </p>
      </div>
    </div>
  );
}
