import { useState } from "react";
import { 
  Bot, 
  MessageCircle, 
  Sparkles,
  Mic,
  Image,
  FileText,
  ChevronRight,
  Lightbulb,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const AGENT_CAPABILITIES = [
  {
    icon: MessageCircle,
    title: "Questions & Réponses",
    examples: [
      "Combien j'ai signé ce mois-ci ?",
      "Quel est mon CA de la semaine ?",
      "Quels RDV j'ai demain ?",
    ],
  },
  {
    icon: Target,
    title: "Actions Rapides",
    examples: [
      "Signe la vente Dupont à 15kWc pour 25000€",
      "Annule le RDV de Martin",
      "Crée un RDV pour Dubois demain à 14h",
    ],
  },
  {
    icon: FileText,
    title: "Documents & Factures",
    examples: [
      "Envoie-lui une photo → attribue au client",
      "Facture d'essence → enregistre en frais",
      "Analyse ce document",
    ],
  },
];

const KEY_COMMANDS = [
  { command: "Ma tournée", desc: "= RDV du jour" },
  { command: "Signe [client] [puissance] [prix]", desc: "Nouvelle vente" },
  { command: "Annule/Reporte [rdv]", desc: "Modifier RDV" },
  { command: "Stats [période]", desc: "Voir statistiques" },
];

export function AgentInstructionsStep() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Header - compact on mobile */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-2 sm:mb-4"
        >
          <Bot className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
        </motion.div>
        <h2 className="text-lg sm:text-xl font-bold">Assistant IA</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          24h/24 via WhatsApp ou in-app
        </p>
      </div>

      {/* Channels - compact on mobile */}
      <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-green-500/10 text-green-600 text-[10px] sm:text-xs font-medium">
          <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          WhatsApp
        </div>
        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-medium">
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          Chat
        </div>
        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] sm:text-xs font-medium">
          <Mic className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          Vocal
        </div>
      </div>

      {/* Capability tabs - touch-friendly */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-muted rounded-md sm:rounded-lg">
          {AGENT_CAPABILITIES.map((cap, index) => (
            <button
              key={cap.title}
              onClick={() => setActiveTab(index)}
              className={cn(
                "flex-1 px-1.5 sm:px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-colors touch-manipulation",
                activeTab === index 
                  ? "bg-background shadow text-foreground" 
                  : "text-muted-foreground"
              )}
            >
              {cap.title.split(' ')[0]}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-2.5 sm:p-3 rounded-md sm:rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              {(() => {
                const Icon = AGENT_CAPABILITIES[activeTab].icon;
                return <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />;
              })()}
              <span className="text-xs sm:text-sm font-medium">{AGENT_CAPABILITIES[activeTab].title}</span>
            </div>
            <div className="space-y-1">
              {AGENT_CAPABILITIES[activeTab].examples.slice(0, 2).map((example, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] sm:text-xs">
                  <span className="text-muted-foreground">→</span>
                  <span className="italic text-muted-foreground line-clamp-1">"{example}"</span>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Key commands - 2x2 grid on mobile */}
      <div className="space-y-1.5 sm:space-y-2">
        <h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Lightbulb className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          Commandes clés
        </h4>
        <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
          {KEY_COMMANDS.map((cmd) => (
            <div key={cmd.command} className="p-1.5 sm:p-2 rounded bg-muted/50">
              <p className="text-[9px] sm:text-xs font-mono text-primary truncate">{cmd.command}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">{cmd.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tip - compact on mobile */}
      <div className="p-2 sm:p-3 rounded-md sm:rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
          💬 <strong>L'agent apprend</strong> de vos habitudes et mémorise vos préférences.
        </p>
      </div>
    </div>
  );
}
