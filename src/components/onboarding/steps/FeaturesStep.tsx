import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  FileText, 
  Users, 
  Bot, 
  MessageCircle, 
  Bell, 
  Wallet, 
  Route, 
  Camera, 
  ChevronRight,
  ChevronLeft,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    id: "planning",
    icon: Calendar,
    color: "from-blue-500 to-blue-600",
    title: "Planning Intelligent",
    description: "Gérez vos RDV avec synchronisation Google Calendar automatique",
    highlights: [
      "Vue semaine et mois",
      "Drag & Drop pour déplacer les RDV",
      "Temps de trajet calculé automatiquement",
      "Synchronisation bidirectionnelle avec Google",
    ],
    tip: "💡 Glissez un RDV sur une autre date pour le reprogrammer",
  },
  {
    id: "crm",
    icon: Users,
    color: "from-purple-500 to-purple-600",
    title: "CRM & Pipeline",
    description: "Suivez vos prospects du premier contact jusqu'à l'installation",
    highlights: [
      "Vue Kanban du pipeline",
      "Historique complet par client",
      "Gestion des documents",
      "Suivi des commissions",
    ],
    tip: "💡 Utilisez la sélection multiple pour traiter plusieurs ventes",
  },
  {
    id: "etudes",
    icon: FileText,
    color: "from-amber-500 to-orange-500",
    title: "Études Techniques",
    description: "Créez des études professionnelles avec calcul automatique",
    highlights: [
      "Calcul des aides (MaPrimeRénov, éco TVA, aides manuelles...)",
      "Dimensionnement automatique",
      "Export PDF professionnel",
      "Mode Hejja pour simulations",
    ],
    tip: "💡 Le mode Hejja ajuste les prix pour optimiser vos simulations",
  },
  {
    id: "agent",
    icon: Bot,
    color: "from-green-500 to-emerald-500",
    title: "Assistant IA",
    description: "Votre assistant personnel disponible 24h/24 par WhatsApp et in-app",
    highlights: [
      "Consultation de votre planning",
      "Recherche de clients vocale",
      "Mise à jour des statuts",
      "Apprentissage de vos préférences",
    ],
    tip: "💡 Dites 'Dupont posé' pour marquer une vente comme installée",
  },
  {
    id: "notifications",
    icon: Bell,
    color: "from-red-500 to-rose-500",
    title: "Notifications WhatsApp",
    description: "Restez informé à chaque étape avec des alertes automatiques",
    highlights: [
      "Rappels de RDV",
      "Alertes de validation",
      "Messages au confirmateur",
      "Templates personnalisables",
    ],
    tip: "💡 Configurez l'heure du CQ pour vos notifications positives",
  },
  {
    id: "finance",
    icon: Wallet,
    color: "from-teal-500 to-cyan-500",
    title: "Gestion Financière",
    description: "Suivez vos frais, commissions et déclarations",
    highlights: [
      "Scan de tickets OCR",
      "Export frais PDF",
      "Suivi des commissions",
      "Calcul TVA automatique",
    ],
    tip: "💡 Photographiez vos tickets pour les ajouter automatiquement",
  },
  {
    id: "scanner",
    icon: Camera,
    color: "from-indigo-500 to-violet-500",
    title: "Scanner de Documents",
    description: "Numérisez vos documents avec détection intelligente",
    highlights: [
      "Détection de contours auto",
      "OCR intégré",
      "Multi-pages PDF",
      "Catégorisation automatique",
    ],
    tip: "💡 Le scanner détecte automatiquement les bords du document",
  },
  {
    id: "routes",
    icon: Route,
    color: "from-pink-500 to-fuchsia-500",
    title: "Optimisation Trajets",
    description: "Calculez vos itinéraires et réservez vos hôtels",
    highlights: [
      "Temps de trajet entre RDV",
      "Carte interactive",
      "Lien Booking.com",
      "Alertes distance",
    ],
    tip: "💡 L'app vous alerte si un RDV est éloigné du précédent",
  },
];

export function FeaturesStep() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const feature = FEATURES[currentIndex];

  const goNext = () => {
    if (currentIndex < FEATURES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header - compact on mobile */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <span className="text-xs sm:text-sm font-medium text-primary">
            {currentIndex + 1}/{FEATURES.length} • {feature.title}
          </span>
        </div>
      </div>

      {/* Feature Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-3 sm:space-y-4"
        >
          {/* Icon & Title - smaller on mobile */}
          <div className="text-center">
            <div className={cn(
              "mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br flex items-center justify-center mb-2 sm:mb-3",
              feature.color
            )}>
              <feature.icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold">{feature.title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              {feature.description}
            </p>
          </div>

          {/* Highlights - compact on mobile */}
          <div className="space-y-1.5 sm:space-y-2">
            {feature.highlights.slice(0, 3).map((highlight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/50"
              >
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs sm:text-sm line-clamp-1">{highlight}</span>
              </motion.div>
            ))}
            {feature.highlights.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-center sm:hidden">
                +{feature.highlights.length - 3} autres...
              </p>
            )}
            {/* Show all on desktop */}
            <div className="hidden sm:block space-y-2">
              {feature.highlights.slice(3).map((highlight, i) => (
                <motion.div
                  key={i + 3}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (i + 3) * 0.1 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-sm">{highlight}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Tip - compact on mobile */}
          <div className="p-2 sm:p-3 rounded-md sm:rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-[11px] sm:text-sm text-primary font-medium leading-snug">
              {feature.tip}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation - touch-friendly */}
      <div className="flex items-center justify-between pt-1 sm:pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="gap-0.5 sm:gap-1 h-8 sm:h-9 px-2 sm:px-3 touch-manipulation"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Précédent</span>
        </Button>

        {/* Dots - smaller on mobile */}
        <div className="flex gap-1 sm:gap-1.5">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "h-1.5 sm:h-2 rounded-full transition-all touch-manipulation",
                i === currentIndex
                  ? "bg-primary w-3 sm:w-4"
                  : "bg-muted-foreground/30 w-1.5 sm:w-2"
              )}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goNext}
          disabled={currentIndex === FEATURES.length - 1}
          className="gap-0.5 sm:gap-1 h-8 sm:h-9 px-2 sm:px-3 touch-manipulation"
        >
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
