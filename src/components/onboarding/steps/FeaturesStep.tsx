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
      "Calcul des aides (MaPrimeRénov, Prime Autoconso...)",
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
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">
            Fonctionnalité {currentIndex + 1}/{FEATURES.length}
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
          className="space-y-4"
        >
          {/* Icon & Title */}
          <div className="text-center">
            <div className={cn(
              "mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-3",
              feature.color
            )}>
              <feature.icon className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">{feature.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {feature.description}
            </p>
          </div>

          {/* Highlights */}
          <div className="space-y-2">
            {feature.highlights.map((highlight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-sm">{highlight}</span>
              </motion.div>
            ))}
          </div>

          {/* Tip */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-primary font-medium">
              {feature.tip}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === currentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goNext}
          disabled={currentIndex === FEATURES.length - 1}
          className="gap-1"
        >
          Suivant
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
