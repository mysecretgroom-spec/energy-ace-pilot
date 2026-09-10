import { supabase } from "@/integrations/supabase/client";
import type { OcrIssue } from "@/lib/ocrIssues";

export type OcrEngine = "ia" | "appareil";

export interface ReceiptReading {
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
  commercant: string | null;
  date_debut: string | null;
  date_fin: string | null;
  issues?: OcrIssue[];
  confiance?: number;
  qualite_image?: string;
  /** Moteur ayant produit la lecture : IA serveur ou moteur embarqué (hors ligne). */
  moteur: OcrEngine;
}

const EMPTY: Omit<ReceiptReading, "moteur"> = {
  montant_ttc: null,
  montant_ht: null,
  tva: null,
  taux_tva: null,
  date: null,
  categorie: null,
  description: null,
  commercant: null,
  date_debut: null,
  date_fin: null,
};

const LOCAL_CATEGORIES: Record<string, string> = {
  carburant: "carburant",
  repas: "repas",
  hotel: "hotel",
  peage: "peage",
  parking: "parking",
};

/**
 * Lecture locale (moteur embarqué, sans réseau).
 * Chargé dynamiquement pour ne pas alourdir le bundle quand l'IA suffit.
 */
async function readOnDevice(imageBase64: string): Promise<ReceiptReading> {
  const { performOcr } = await import("@/components/scanner/services/ocrService");
  const ocr = await performOcr(imageBase64);
  const d = ocr.extractedData;

  const issues: OcrIssue[] = [
    {
      field: "image",
      level: "warning",
      message: "Lecture réalisée sur l'appareil (hors ligne) : vérifiez chaque champ.",
    },
  ];
  if (!d.montant) {
    issues.push({ field: "montant_ttc", level: "error", message: "Montant non lu, à saisir." });
  }
  if (!d.date) {
    issues.push({ field: "date", level: "error", message: "Date non lue, à saisir." });
  }
  if (!d.fournisseur) {
    issues.push({ field: "commercant", level: "warning", message: "Commerçant non lu." });
  }

  return {
    ...EMPTY,
    montant_ttc: d.montant ?? null,
    tva: d.tva ?? null,
    date: d.date ?? null,
    commercant: d.fournisseur ?? null,
    categorie: d.description ? LOCAL_CATEGORIES[d.description] ?? null : null,
    description: d.description ?? null,
    issues,
    confiance: Math.max(0, Math.min(1, ocr.confidence / 100)),
    qualite_image: ocr.confidence < 60 ? "mauvaise" : "moyenne",
    moteur: "appareil",
  };
}

/**
 * Lecture d'un justificatif : IA serveur en priorité,
 * bascule automatique sur le moteur embarqué si hors ligne ou en cas d'échec.
 */
export async function recognizeReceipt(imageBase64: string): Promise<ReceiptReading> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (!offline) {
    try {
      const { data, error } = await supabase.functions.invoke("ocr-receipt", {
        body: { image_base64: imageBase64 },
      });
      if (error) throw error;
      if (data && typeof data === "object" && !("error" in data)) {
        return { ...EMPTY, ...(data as Partial<ReceiptReading>), moteur: "ia" };
      }
      throw new Error("Réponse de lecture invalide");
    } catch (err) {
      console.warn("Lecture IA indisponible, bascule sur le moteur embarqué:", err);
    }
  }

  try {
    return await readOnDevice(imageBase64);
  } catch (err) {
    console.error("Lecture embarquée échouée:", err);
    return {
      ...EMPTY,
      moteur: "appareil",
      issues: [
        {
          field: "image",
          level: "error",
          message: "Lecture impossible : saisissez les informations manuellement.",
        },
      ],
    };
  }
}
