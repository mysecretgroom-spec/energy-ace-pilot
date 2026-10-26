import React from "react";
import { Button } from "@/components/ui/button";
import type { CompressionQuality } from "../types";

interface QualitySelectorProps {
  value: CompressionQuality;
  onChange: (q: CompressionQuality) => void;
}

const options: { key: CompressionQuality; label: string; desc: string }[] = [
  { key: "high", label: "Haute", desc: "Meilleure qualité" },
  { key: "medium", label: "Moyenne", desc: "Bon compromis" },
  { key: "low", label: "Basse", desc: "Fichier léger" },
];

export function QualitySelector({ value, onChange }: QualitySelectorProps) {
  return (
    <div className="flex gap-2">
      {options.map(({ key, label, desc }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 rounded-lg border px-3 py-2 text-left transition-all ${
            value === key
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <div className={`text-sm font-medium ${value === key ? "text-primary" : "text-foreground"}`}>
            {label}
          </div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </button>
      ))}
    </div>
  );
}
