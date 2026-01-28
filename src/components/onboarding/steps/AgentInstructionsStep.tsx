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
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4"
        >
          <Bot className="h-7 w-7 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold">Assistant IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Disponible 24h/24 via WhatsApp ou dans l'application
        </p>
      </div>

      {/* Channels */}
      <div className="flex justify-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          Chat App
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
          <Mic className="h-3.5 w-3.5" />
          Vocal
        </div>
      </div>

      {/* Capability tabs */}
      <div className="space-y-3">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {AGENT_CAPABILITIES.map((cap, index) => (
            <button
              key={cap.title}
              onClick={() => setActiveTab(index)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === index 
                  ? "bg-background shadow text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cap.title}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-3 rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const Icon = AGENT_CAPABILITIES[activeTab].icon;
                return <Icon className="h-4 w-4 text-primary" />;
              })()}
              <span className="text-sm font-medium">{AGENT_CAPABILITIES[activeTab].title}</span>
            </div>
            <div className="space-y-1.5">
              {AGENT_CAPABILITIES[activeTab].examples.map((example, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground">→</span>
                  <span className="italic text-muted-foreground">"{example}"</span>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Key commands */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" />
          Commandes clés
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {KEY_COMMANDS.map((cmd) => (
            <div key={cmd.command} className="p-2 rounded bg-muted/50">
              <p className="text-xs font-mono text-primary">{cmd.command}</p>
              <p className="text-[10px] text-muted-foreground">{cmd.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-xs text-muted-foreground">
          💬 <strong>L'agent apprend de vos habitudes !</strong> Il mémorise vos alias clients, expressions temporelles et préférences pour mieux vous comprendre.
        </p>
      </div>
    </div>
  );
}
