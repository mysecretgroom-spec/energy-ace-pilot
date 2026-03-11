import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import franceRenovLogo from "@/assets/logos/france-renov.png";
import ministereLogoSvg from "@/assets/logos/ministere-transition-energetique.png";
import enedisLogo from "@/assets/logos/enedis.png";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PacData {
  subtype: "air_air" | "air_eau";
  surfaceChauffee: number;
  typeEmetteurs: string;
  puissanceCalorifique: number;
  cop: number;
  ecsIntegre: boolean;
  volumeBallon: number;
  energieActuelle: string;
  niveauIsolation: string;
  prixInstallation: number;
  aides: { maPrimeRenov: number; cee: number; ecoTva: number; aideLocale: number };
  economies: { besoinsChauffageKwh: number; consoElecPacKwh: number; surcoutElecEuros: number; economieNetteEuros: number; economieNetteMessage: number } | null;
  factureChauffage: number;
  factureElec: number;
  prixKwhElec: number;
}

interface IteData {
  surfaceIsoler: number;
  typeFacade: string;
  epaisseurIsolant: number;
  typeIsolant: string;
  rActuel: number;
  rCible: number;
  nombreFacades: number;
  surfaceOuvertures: number;
  finition: string;
  economieChauffagePct: number;
  factureChaufActuelle: number;
  prixInstallation: number;
  aides: { maPrimeRenov: number; cee: number; ecoTva: number; aideLocale: number };
}

interface EtudeData {
  // Multi-product
  activeProducts?: string[];
  
  // Client
  clientNom: string;
  clientPrenom: string;
  clientAdresse: string;
  clientVille: string;
  clientCodePostal: string;
  clientTelephone?: string;
  departement: string;
  dateEtude: string;
  
  // Visite technique
  ombreToiture: string;
  surfaceToiture: string;
  typeToiture: string;
  etatToiture: string;
  orientation: string;
  inclinaison: number;
  
  // Compteur
  typeCompteurElectrique: string;
  numeroPdl: string;
  typeRaccordement: string;
  amperageDisjoncteur: number;
  emplacementBoitier: string;
  potentielFaisabilite: string;
  
  // Consommation
  consoAnnuelle: number;
  factureMensuelle: number;
  consoIsEstimated?: boolean;
  
  // Préconisation
  bouquetNom: string;
  puissanceKwc: number;
  typeRevente: string;
  supportInstallation: string;
  
  // Données techniques
  surfaceInstallation: number;
  heuresEnsoleillement: number;
  rendementProductivite: number;
  
  // Résultats calculs
  productionAnnuelle: number;
  surplusProduction: number;
  autoconsoPct: number;
  
  // Prix
  prixInstallation: number;
  surcoutSupport: number;
  surcoutCompteur: number;
  autreSurcout: number;
  prixTotalHorsAides: number;
  
  // Aides
  primeAutoconsommation: number;
  ecoTva: number;
  totalAides: number;
  totalAidesDeduites: number;
  
  // Financement
  financementNom: string;
  tauxFinancement: number;
  dureeMois: number;
  mensualite: number;
  
  // Rentabilité
  autoconsommationEuros: number;
  reventeMensuelleEstimee: number;
  resultatTransfertCharge: number;
  verdict: string;
  
  // Classification
  classification?: string;
  classificationComment?: string;
  
  // Multi-product data
  pac?: PacData;
  ite?: IteData;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitize text for jsPDF: replace ALL non-ASCII whitespace, invisible chars,
 * and problematic Unicode with safe ASCII equivalents.
 * jsPDF's built-in Helvetica has broken metrics for many Unicode chars,
 * causing abnormal character spacing.
 */
const sanitizePdfText = (text: string): string => {
  return text
    // Replace all Unicode whitespace variants with regular space
    .replace(/[\u00A0\u202F\u2009\u200A\u2007\u2008\u200B\u200C\u200D\uFEFF]/g, " ")
    // Replace em/en dashes with simple hyphens
    .replace(/[\u2013\u2014]/g, "-")
    // Replace curly quotes with straight quotes
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    // Replace ellipsis
    .replace(/\u2026/g, "...")
    // Replace minus sign with hyphen
    .replace(/\u2212/g, "-")
    // Replace multiplication sign
    .replace(/\u00D7/g, "x")
    // Replace bullet
    .replace(/\u2022/g, "-")
    // Collapse multiple spaces
    .replace(/ {2,}/g, " ");
};

const formatEuros = (value: number): string => {
  const raw = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
  return sanitizePdfText(raw);
};

const formatNumber = (value: number, decimals: number = 0): string => {
  const raw = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return sanitizePdfText(raw);
};

const loadImageAsBase64 = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════════════════
const bleuMarianne: [number, number, number] = [0, 0, 145];
const rougeMarianne: [number, number, number] = [225, 0, 15];
const grisTexte: [number, number, number] = [58, 58, 58];
const grisClair: [number, number, number] = [240, 240, 240];
const successColor: [number, number, number] = [34, 197, 94];
const warningColor: [number, number, number] = [234, 179, 8];
const dangerColor: [number, number, number] = [239, 68, 68];
const pacColor: [number, number, number] = [59, 130, 246]; // blue
const iteColor: [number, number, number] = [168, 85, 247]; // purple

// ═══════════════════════════════════════════════════════════════════════════
// HEADER & FOOTER helpers
// ═══════════════════════════════════════════════════════════════════════════

const drawHeader = (doc: jsPDF, data: EtudeData, franceRenovBase64: string, subtitle: string, ministereBase64?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Tricolor band
  doc.setFillColor(...bleuMarianne);
  doc.rect(0, 0, 3, 35, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(3, 0, 3, 35, "F");
  doc.setFillColor(...rougeMarianne);
  doc.rect(6, 0, 3, 35, "F");
  
  if (franceRenovBase64) {
    try { doc.addImage(franceRenovBase64, "PNG", 14, 4, 45, 28); } catch {}
  }
  
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ÉTUDE DE FAISABILITÉ", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(12);
  doc.text(subtitle, pageWidth / 2, 22, { align: "center" });
  
  // Ministère logo top-right
  if (ministereBase64) {
    try { doc.addImage(ministereBase64, "PNG", pageWidth - 55, 4, 40, 28); } catch {}
  }
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grisTexte);
  doc.text(`Date: ${data.dateEtude}`, pageWidth - 14, 34, { align: "right" });
  
  doc.setDrawColor(...bleuMarianne);
  doc.setLineWidth(0.5);
  doc.line(14, 36, pageWidth - 14, 36);
};

const FOOTER_ZONE = 56; // reserved height at bottom for footer + logos on last page
const FOOTER_ZONE_NORMAL = 28; // reserved height on non-last pages

interface PageContext {
  doc: jsPDF;
  data: EtudeData;
  franceRenovBase64: string;
  ministereBase64: string;
  subtitle: string;
  headerStyle?: "standard" | "cepc";
}

/**
 * Check if there's enough vertical space for a section.
 * If not, add a new page with header and return the new yPos.
 */
const ensureSpace = (ctx: PageContext, yPos: number, requiredHeight: number): number => {
  const pageHeight = ctx.doc.internal.pageSize.getHeight();
  const available = pageHeight - FOOTER_ZONE_NORMAL - yPos;
  if (available < requiredHeight) {
    ctx.doc.addPage();
    if (ctx.headerStyle === "cepc") {
      // CEPC header drawn via deferred call to avoid forward reference
      _drawCepcHeaderFn?.(ctx.doc, ctx.data, ctx.franceRenovBase64, ctx.subtitle, ctx.ministereBase64);
      return 38;
    } else {
      drawHeader(ctx.doc, ctx.data, ctx.franceRenovBase64, ctx.subtitle, ctx.ministereBase64);
      return 42;
    }
  }
  return yPos;
};

// Forward reference holder — set later when drawCepcHeader is defined
let _drawCepcHeaderFn: typeof drawHeader | null = null;

/**
 * Monkey-patch doc.text and doc.splitTextToSize to auto-sanitize
 * all strings, preventing broken character spacing from Unicode chars
 * that jsPDF's built-in Helvetica can't properly measure.
 */
const patchDocTextMethods = (doc: jsPDF) => {
  const originalText = doc.text.bind(doc);
  (doc as any).text = (text: any, x: number, y: number, options?: any) => {
    if (typeof text === "string") {
      text = sanitizePdfText(text);
    } else if (Array.isArray(text)) {
      text = text.map((t: any) => typeof t === "string" ? sanitizePdfText(t) : t);
    }
    return originalText(text, x, y, options);
  };

  const originalSplit = doc.splitTextToSize.bind(doc);
  (doc as any).splitTextToSize = (text: string, maxWidth: number, options?: any) => {
    return originalSplit(sanitizePdfText(text), maxWidth, options);
  };
};

const drawFooter = (doc: jsPDF, data: EtudeData, pageNum: number, totalPages: number, isLastPage = false, logos?: { franceRenov: string; ministere: string; enedis: string }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Last page: institutional logos bar above footer
  if (isLastPage && logos) {
    const logoH = 16;
    const logoY = pageHeight - 52;
    // Each logo has different natural proportions — use individual widths
    const frW = 28;  // France Rénov': roughly square-ish
    const minW = 34;  // Ministère: wider text block
    const endW = 40;  // Enedis: wide horizontal logo — must not be squeezed
    const gap = 12;
    const totalLogosWidth = frW + minW + endW + gap * 2;
    const startX = (pageWidth - totalLogosWidth) / 2;

    // Subtle separator above logos
    doc.setDrawColor(200, 205, 212);
    doc.setLineWidth(0.2);
    doc.line(startX, logoY - 3, startX + totalLogosWidth, logoY - 3);

    try {
      let x = startX;
      if (logos.franceRenov) { doc.addImage(logos.franceRenov, "PNG", x, logoY, frW, logoH); }
      x += frW + gap;
      if (logos.ministere) { doc.addImage(logos.ministere, "PNG", x, logoY, minW, logoH); }
      x += minW + gap;
      if (logos.enedis) { doc.addImage(logos.enedis, "PNG", x, logoY, endW, logoH); }
    } catch {}
  }

  const footerY = pageHeight - 24;
  
  doc.setDrawColor(...bleuMarianne);
  doc.setLineWidth(0.3);
  doc.line(14, footerY, pageWidth - 14, footerY);
  
  doc.setTextColor(...grisTexte);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.clientPrenom} ${data.clientNom} — ${data.clientAdresse}, ${data.clientCodePostal} ${data.clientVille}`, 14, footerY + 4);
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.text("Ce document est une étude préliminaire de faisabilité et ne constitue pas un engagement contractuel.", pageWidth / 2, footerY + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${pageNum}/${totalPages}`, pageWidth - 14, footerY + 13, { align: "right" });
  
  // Bottom tricolor band
  doc.setFillColor(...bleuMarianne);
  doc.rect(0, pageHeight - 3, pageWidth / 3, 3, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(pageWidth / 3, pageHeight - 3, pageWidth / 3, 3, "F");
  doc.setFillColor(...rougeMarianne);
  doc.rect((pageWidth / 3) * 2, pageHeight - 3, pageWidth / 3, 3, "F");
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: Bénéficiaire
// ═══════════════════════════════════════════════════════════════════════════
const drawBeneficiaire = (doc: jsPDF, data: EtudeData, yPos: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMATIONS DU BÉNÉFICIAIRE", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ["Nom et prénom", `${data.clientPrenom} ${data.clientNom}`],
      ["Adresse du projet", data.clientAdresse],
      ["Ville", `${data.clientCodePostal} ${data.clientVille}`],
      ["Département", data.departement],
      ["N° PDL", data.numeroPdl || "Non renseigné"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: grisTexte },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  
  return (doc as any).lastAutoTable.finalY + 6;
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE PV
// ═══════════════════════════════════════════════════════════════════════════
const drawPvPage = (doc: jsPDF, data: EtudeData, yStart: number, ctx?: PageContext): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = yStart;
  
  // Diagnostic technique
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DIAGNOSTIC TECHNIQUE - PHOTOVOLTAÏQUE", 16, yPos + 5);
  yPos += 9;
  
  const colWidth = (pageWidth - 28 - 4) / 2;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Caractéristiques Toiture", ""]],
    body: [
      ["Type de couverture", data.typeToiture],
      ["État général", data.etatToiture],
      ["Surface disponible", data.surfaceToiture],
      ["Ombrage", data.ombreToiture],
      ["Orientation", data.orientation],
      ["Inclinaison", `${data.inclinaison}°`],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 0: { cellWidth: colWidth / 2 }, 1: { cellWidth: colWidth / 2 - 5, halign: "right" } },
    margin: { left: 14, right: pageWidth / 2 + 2, bottom: FOOTER_ZONE_NORMAL },
  });
  const leftY = (doc as any).lastAutoTable.finalY;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Installation Électrique", ""]],
    body: [
      ["Type de compteur", data.typeCompteurElectrique],
      ["Raccordement", data.typeRaccordement],
      ["Calibre disjoncteur", `${data.amperageDisjoncteur}A`],
      ["Position boîtier", data.emplacementBoitier],
      ["Faisabilité technique", data.potentielFaisabilite],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 0: { cellWidth: colWidth / 2 }, 1: { cellWidth: colWidth / 2 - 5, halign: "right" } },
    margin: { left: pageWidth / 2 + 2, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = Math.max(leftY, (doc as any).lastAutoTable.finalY) + 6;
  
  // Préconisation
  if (ctx) yPos = ensureSpace(ctx, yPos, 40);
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PRÉCONISATION D'INSTALLATION", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [[`Point de Consommation de référence${data.consoIsEstimated ? " (Estimatif)" : " (Relevé client)"}`, "", "Installation Recommandée", ""]],
    body: [
      ["Consommation annuelle", `${formatNumber(data.consoAnnuelle)} kWh`, "Configuration", data.bouquetNom],
      ["Facture mensuelle moy.", formatEuros(data.factureMensuelle), "Puissance crête", `${data.puissanceKwc} kWc`],
      ["", "", "Support d'installation", data.supportInstallation],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Production
  if (ctx) yPos = ensureSpace(ctx, yPos, 35);
  autoTable(doc, {
    startY: yPos,
    head: [["Estimation de Production", "", "", ""]],
    body: [
      ["Surface panneaux", `${data.surfaceInstallation} m²`, "Point de Production Minimal", `${formatNumber(data.productionAnnuelle)} kWh`],
      ["Ensoleillement zone", `${formatNumber(data.heuresEnsoleillement)} h/an`, "Surplus revendable", `${formatNumber(data.surplusProduction)} kWh`],
      ["Rendement orientation", `${data.rendementProductivite}%`, "Taux autoconsommation", `${formatNumber(data.autoconsoPct, 1)}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  
  // Analyse financière — need space for header + investment table + financement + verdict (~120mm)
  if (ctx) yPos = ensureSpace(ctx, yPos, 120);
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ANALYSE FINANCIÈRE - PV", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Investissement", "", "Aides Financières", ""]],
    body: [
      ["Installation TTC", formatEuros(data.prixInstallation), "Prime à l'autoconsommation", formatEuros(data.primeAutoconsommation)],
      ["Surcoût support", formatEuros(data.surcoutSupport), "Éco-participation TVA", formatEuros(data.ecoTva)],
      ["Surcoût compteur", formatEuros(data.surcoutCompteur), "", ""],
      ["Autres frais", formatEuros(data.autreSurcout), "TOTAL DES AIDES", formatEuros(data.totalAides)],
      ["COÛT TOTAL BRUT", formatEuros(data.prixTotalHorsAides), "COÛT NET (après aides)", formatEuros(data.totalAidesDeduites)],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Financement & Rentabilité
  if (ctx) yPos = ensureSpace(ctx, yPos, 65);
  autoTable(doc, {
    startY: yPos,
    head: [["Financement", "", "Rentabilité Mensuelle", ""]],
    body: [
      ["Solution", data.financementNom || "Comptant", "Économie autoconsommation", formatEuros(data.autoconsommationEuros)],
      ["Taux effectif", `${data.tauxFinancement}%`, "Revente surplus", formatEuros(data.reventeMensuelleEstimee)],
      ["Durée", `${data.dureeMois} mois`, "Mensualité financement", `-${formatEuros(data.mensualite)}`],
      ["Mensualité", formatEuros(data.mensualite), "RÉSULTAT MENSUEL", formatEuros(data.resultatTransfertCharge)],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (cellData) => { if (cellData.row.index === 3 && cellData.column.index >= 2) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  // Verdict
  if (ctx) yPos = ensureSpace(ctx, yPos, 30);
  let verdictColor = successColor;
  let verdictText = "TENDANCE FAVORABLE";
  let verdictDesc = "Les indicateurs suggèrent des conditions propices à la réalisation du projet";
  if (data.verdict === "a_etudier") {
    verdictColor = warningColor; verdictText = "À APPROFONDIR"; verdictDesc = "Une analyse complémentaire est recommandée avant toute décision";
  } else if (data.verdict === "invalide") {
    verdictColor = dangerColor; verdictText = "RÉSERVES IDENTIFIÉES"; verdictDesc = "Les conditions actuelles ne permettent pas de conclure favorablement";
  }
  
  doc.setDrawColor(...verdictColor);
  doc.setLineWidth(1);
  doc.setFillColor(...verdictColor);
  doc.roundedRect(pageWidth / 2 - 55, yPos, 110, 22, 2, 2, "FD");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(verdictText, pageWidth / 2, yPos + 8, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(verdictDesc, pageWidth / 2, yPos + 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.resultatTransfertCharge >= 0 ? "+" : ""}${formatEuros(data.resultatTransfertCharge)}/mois`, pageWidth / 2, yPos + 20, { align: "center" });
  
  return yPos + 28;
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE PAC
// ═══════════════════════════════════════════════════════════════════════════
const drawPacPage = (doc: jsPDF, data: EtudeData, yStart: number, ctx?: PageContext): number => {
  if (!data.pac) return yStart;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pac = data.pac;
  let yPos = yStart;
  
  if (ctx) yPos = ensureSpace(ctx, yPos, 50);
  doc.setFillColor(...pacColor);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("POMPE A CHALEUR (PAC)", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Caracteristiques PAC", "", "Performance", ""]],
    body: [
      ["Type de PAC", pac.subtype === "air_eau" ? "Air/Eau" : "Air/Air", "COP moyen", `${pac.cop}`],
      ["Surface chauffee", `${pac.surfaceChauffee} m2`, "Puissance calorifique", `${pac.puissanceCalorifique} kW`],
      ["Type emetteurs", pac.typeEmetteurs, "Niveau isolation", pac.niveauIsolation],
      ["Energie actuelle", pac.energieActuelle, "ECS integre", pac.ecsIntegre ? "Oui" : "Non"],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: pacColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Economies PAC
  if (pac.economies) {
    if (ctx) yPos = ensureSpace(ctx, yPos, 35);
    autoTable(doc, {
      startY: yPos,
      head: [["Bilan Energetique PAC", "", "", ""]],
      body: [
        ["Besoins chauffage", `${formatNumber(pac.economies.besoinsChauffageKwh)} kWh`, "Facture chauffage actuelle", formatEuros(pac.factureChauffage)],
        ["Conso elec PAC", `${formatNumber(pac.economies.consoElecPacKwh)} kWh`, "Surcout elec PAC", formatEuros(pac.economies.surcoutElecEuros)],
        ["", "", "ECONOMIE NETTE ANNUELLE", formatEuros(pac.economies.economieNetteEuros)],
      ],
      theme: "striped",
      headStyles: { fillColor: grisClair, textColor: pacColor, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      didParseCell: (cellData) => { if (cellData.row.index === 2 && cellData.column.index >= 2) cellData.cell.styles.fontStyle = "bold"; },
      margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
    });
    yPos = (doc as any).lastAutoTable.finalY + 4;
  }
  
  // Financier PAC
  if (ctx) yPos = ensureSpace(ctx, yPos, 50);
  const totalAidesPac = pac.aides.maPrimeRenov + pac.aides.cee + pac.aides.ecoTva + pac.aides.aideLocale;
  autoTable(doc, {
    startY: yPos,
    head: [["Investissement PAC", "", "Aides PAC", ""]],
    body: [
      ["Prix installation", formatEuros(pac.prixInstallation), "MaPrimeRenov'", formatEuros(pac.aides.maPrimeRenov)],
      ["", "", "CEE", formatEuros(pac.aides.cee)],
      ["", "", "Eco TVA", formatEuros(pac.aides.ecoTva)],
      ["", "", "Aide locale", formatEuros(pac.aides.aideLocale)],
      ["COUT PAC", formatEuros(pac.prixInstallation), "TOTAL AIDES PAC", formatEuros(totalAidesPac)],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: pacColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  
  return (doc as any).lastAutoTable.finalY + 6;
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE ITE
// ═══════════════════════════════════════════════════════════════════════════
const drawItePage = (doc: jsPDF, data: EtudeData, yStart: number, ctx?: PageContext): number => {
  if (!data.ite) return yStart;
  const pageWidth = doc.internal.pageSize.getWidth();
  const ite = data.ite;
  let yPos = yStart;
  
  if (ctx) yPos = ensureSpace(ctx, yPos, 55);
  doc.setFillColor(...iteColor);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ISOLATION THERMIQUE EXTERIEURE (ITE)", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Caracteristiques ITE", "", "Performance Thermique", ""]],
    body: [
      ["Surface a isoler", `${ite.surfaceIsoler} m2`, "R actuel", `${ite.rActuel} m2.K/W`],
      ["Type de facade", ite.typeFacade, "R cible", `${ite.rCible} m2.K/W`],
      ["Isolant", ite.typeIsolant, "Epaisseur", `${ite.epaisseurIsolant} mm`],
      ["Nombre de facades", `${ite.nombreFacades}`, "Finition", ite.finition],
      ["Surface ouvertures", `${ite.surfaceOuvertures} m2`, "Economie chauffage", `${ite.economieChauffagePct}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: iteColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Financier ITE
  if (ctx) yPos = ensureSpace(ctx, yPos, 50);
  const totalAidesIte = ite.aides.maPrimeRenov + ite.aides.cee + ite.aides.ecoTva + ite.aides.aideLocale;
  const economieAnnuelle = ite.factureChaufActuelle * (ite.economieChauffagePct / 100);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Investissement ITE", "", "Aides & Economies ITE", ""]],
    body: [
      ["Prix installation", formatEuros(ite.prixInstallation), "MaPrimeRenov'", formatEuros(ite.aides.maPrimeRenov)],
      ["", "", "CEE", formatEuros(ite.aides.cee)],
      ["", "", "Eco TVA", formatEuros(ite.aides.ecoTva)],
      ["Facture chauffage actuelle", formatEuros(ite.factureChaufActuelle), "TOTAL AIDES ITE", formatEuros(totalAidesIte)],
      ["Economie annuelle estimee", formatEuros(economieAnnuelle), "COUT NET ITE", formatEuros(ite.prixInstallation - totalAidesIte)],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: iteColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  
  return (doc as any).lastAutoTable.finalY + 6;
};

// ═══════════════════════════════════════════════════════════════════════════
// RÉCAP GLOBAL MULTI-PRODUIT
// ═══════════════════════════════════════════════════════════════════════════
const drawGlobalSummary = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const products = data.activeProducts || ["PV"];
  if (products.length <= 1) return yStart;
  
  let yPos = yStart;
  
  // Header
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RÉCAPITULATIF GLOBAL DU PROJET", 16, yPos + 5);
  yPos += 9;
  
  // Calculate combined values
  let totalPrix = 0;
  let totalAides = 0;
  const rows: string[][] = [];
  
  if (products.includes("PV")) {
    totalPrix += data.prixTotalHorsAides;
    totalAides += data.totalAides;
    rows.push(["☀️ Photovoltaïque", `${data.puissanceKwc} kWc`, formatEuros(data.prixTotalHorsAides), formatEuros(data.totalAides), formatEuros(data.prixTotalHorsAides - data.totalAides)]);
  }
  if (data.pac) {
    const aidesPac = data.pac.aides.maPrimeRenov + data.pac.aides.cee + data.pac.aides.ecoTva + data.pac.aides.aideLocale;
    totalPrix += data.pac.prixInstallation;
    totalAides += aidesPac;
    rows.push(["🌡️ PAC", `${data.pac.puissanceCalorifique} kW`, formatEuros(data.pac.prixInstallation), formatEuros(aidesPac), formatEuros(data.pac.prixInstallation - aidesPac)]);
  }
  if (data.ite) {
    const aidesIte = data.ite.aides.maPrimeRenov + data.ite.aides.cee + data.ite.aides.ecoTva + data.ite.aides.aideLocale;
    totalPrix += data.ite.prixInstallation;
    totalAides += aidesIte;
    rows.push(["🧱 ITE", `${data.ite.surfaceIsoler} m²`, formatEuros(data.ite.prixInstallation), formatEuros(aidesIte), formatEuros(data.ite.prixInstallation - aidesIte)]);
  }
  
  rows.push(["TOTAL PROJET", "", formatEuros(totalPrix), formatEuros(totalAides), formatEuros(totalPrix - totalAides)]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Produit", "Capacité", "Coût Brut", "Aides", "Coût Net"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: bleuMarianne, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3, textColor: grisTexte },
    columnStyles: { 
      0: { fontStyle: "bold" },
      2: { halign: "right" }, 
      3: { halign: "right" }, 
      4: { halign: "right" },
    },
    didParseCell: (cellData) => {
      if (cellData.row.index === rows.length - 1) {
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.fillColor = [230, 240, 255];
      }
    },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 6;
  
  // Combined economies
  let totalEconomiesMensuelles = 0;
  const ecoRows: string[][] = [];
  
  if (products.includes("PV")) {
    const pvEco = data.autoconsommationEuros + data.reventeMensuelleEstimee;
    totalEconomiesMensuelles += pvEco;
    ecoRows.push(["☀️ PV - Autoconsommation + Revente", formatEuros(pvEco) + "/mois"]);
  }
  if (data.pac?.economies) {
    const pacEcoMensuel = data.pac.economies.economieNetteEuros / 12;
    totalEconomiesMensuelles += pacEcoMensuel;
    ecoRows.push(["🌡️ PAC - Économie chauffage", formatEuros(pacEcoMensuel) + "/mois"]);
  }
  if (data.ite) {
    const iteEcoMensuel = (data.ite.factureChaufActuelle * data.ite.economieChauffagePct / 100) / 12;
    totalEconomiesMensuelles += iteEcoMensuel;
    ecoRows.push(["🧱 ITE - Réduction facture chauffage", formatEuros(iteEcoMensuel) + "/mois"]);
  }
  
  ecoRows.push(["Mensualité financement", `-${formatEuros(data.mensualite)}/mois`]);
  const resultatGlobal = totalEconomiesMensuelles - data.mensualite;
  ecoRows.push(["RÉSULTAT MENSUEL GLOBAL", `${resultatGlobal >= 0 ? "+" : ""}${formatEuros(resultatGlobal)}/mois`]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Économies Combinées", "Montant"]],
    body: ecoRows,
    theme: "striped",
    headStyles: { fillColor: successColor, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3, textColor: grisTexte },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    didParseCell: (cellData) => {
      if (cellData.row.index === ecoRows.length - 1) {
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.fillColor = resultatGlobal >= 0 ? [220, 252, 231] : [254, 226, 226];
      }
    },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  
  return (doc as any).lastAutoTable.finalY + 8;
};

// ═══════════════════════════════════════════════════════════════════════════
// RÉSULTAT D'ÉTUDE
// ═══════════════════════════════════════════════════════════════════════════
const drawResultatEtude = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = yStart;

  // ── Title centered, large, official ──
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RÉSULTAT D'ÉTUDE DE FAISABILITÉ", pageWidth / 2, yPos + 6, { align: "center" });
  yPos += 14;

  // ── Congratulations banner (like CEPC) ──
  const autofinancementValid = data.resultatTransfertCharge >= 0;
  const bannerColor: [number, number, number] = autofinancementValid ? [240, 249, 244] : [254, 242, 242];
  const bannerBorder: [number, number, number] = autofinancementValid ? [34, 197, 94] : [239, 68, 68];
  const bannerIconColor: [number, number, number] = autofinancementValid ? [22, 163, 74] : [220, 38, 38];

  doc.setFillColor(...bannerColor);
  doc.setDrawColor(...bannerBorder);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, yPos, pageWidth - 28, 18, 1.5, 1.5, "FD");

  // Check icon
  doc.setFontSize(14);
  doc.setTextColor(...bannerIconColor);
  doc.text(autofinancementValid ? "✓" : "✗", 22, yPos + 8);

  // Banner text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...grisTexte);
  const bannerTitle = autofinancementValid
    ? "Le projet répond aux critères de faisabilité technique et financière."
    : "Le projet nécessite une analyse complémentaire avant mise en œuvre.";
  doc.text(bannerTitle, 30, yPos + 7);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Étude réalisée le ${data.dateEtude} pour le bénéficiaire ${data.clientPrenom} ${data.clientNom}.`, 30, yPos + 13);
  yPos += 24;

  // ── Structured data boxes (like CEPC table) ──
  const autoconsoValid = data.autoconsoPct > 0;

  // Box row 1 — two columns
  const boxW = (pageWidth - 28 - 6) / 2;
  const boxH = 16;

  // Left box: Bénéficiaire
  doc.setDrawColor(200, 205, 212);
  doc.setLineWidth(0.2);
  doc.line(14, yPos, 14 + boxW, yPos);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Bénéficiaire", 14, yPos + 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...grisTexte);
  doc.text(`${data.clientPrenom} ${data.clientNom}`.toUpperCase(), 14, yPos + 10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.clientAdresse}, ${data.clientCodePostal} ${data.clientVille}`, 14, yPos + 14);

  // Right box: Verdict
  const rightX = 14 + boxW + 6;
  doc.line(rightX, yPos, rightX + boxW, yPos);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Votre résultat", rightX, yPos + 4);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(autofinancementValid ? [22, 101, 52] as [number, number, number] : [185, 28, 28] as [number, number, number]));
  doc.text(autofinancementValid ? "Favorable" : "À approfondir", rightX, yPos + 11);
  yPos += boxH + 4;

  // Box row 2 — four columns
  const col4W = (pageWidth - 28 - 18) / 4;
  const labels2 = ["Puissance préconisée", "Résultat mensuel", "Taux autoconsommation", "Coût net estimé"];
  const values2 = [
    `${data.puissanceKwc} kWc`,
    `${data.resultatTransfertCharge >= 0 ? "+" : ""}${formatEuros(data.resultatTransfertCharge)}`,
    `${formatNumber(data.autoconsoPct, 1)}%`,
    formatEuros(data.totalAidesDeduites),
  ];
  doc.setDrawColor(200, 205, 212);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * (col4W + 6);
    doc.setLineWidth(0.2);
    doc.line(x, yPos, x + col4W, yPos);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(labels2[i], x, yPos + 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...grisTexte);
    doc.text(values2[i], x, yPos + 10);
  }
  yPos += 16;

  // ── Section "VOTRE RÉSULTAT" header bar (like CEPC) ──
  doc.setFillColor(240, 242, 245);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("VOTRE RÉSULTAT", 16, yPos + 5);
  yPos += 10;

  // Validation criteria table
  autoTable(doc, {
    startY: yPos,
    head: [["Critère de validation", "Statut", "Détail"]],
    body: [
      [
        "Autoconsommation énergétique",
        autoconsoValid ? "VALIDÉ" : "NON VALIDÉ",
        `Taux : ${formatNumber(data.autoconsoPct, 1)}%  —  Gain : ${formatEuros(data.autoconsommationEuros)}/mois`,
      ],
      [
        "Autofinancement de l'installation",
        autofinancementValid ? "VALIDÉ" : "NON VALIDÉ",
        `Résultat : ${data.resultatTransfertCharge >= 0 ? "+" : ""}${formatEuros(data.resultatTransfertCharge)}/mois  —  Mensualité : ${formatEuros(data.mensualite)}/mois`,
      ],
      [
        "Non-opposition ABF",
        "CONFORME",
        "Architecte des Bâtiments de France — Aucune restriction identifiée",
      ],
      [
        "Conformité urbanistique",
        "CONFORME",
        "Déclaration préalable de travaux — Réglementation respectée",
      ],
    ],
    theme: "plain",
    headStyles: {
      fillColor: [240, 242, 245],
      textColor: bleuMarianne,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineWidth: 0.2,
      lineColor: [200, 205, 212],
    },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      textColor: grisTexte,
      lineWidth: 0.1,
      lineColor: [220, 225, 230],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { cellWidth: 30, halign: "center", fontStyle: "bold" },
      2: { cellWidth: "auto" },
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 1 && cellData.section === "body") {
        const val = String(cellData.cell.raw);
        if (val === "VALIDÉ" || val === "CONFORME") {
          cellData.cell.styles.textColor = [22, 101, 52];
        } else if (val === "NON VALIDÉ") {
          cellData.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE },
  });
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // ── Formal body text paragraphs (like CEPC) ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...grisTexte);

  const para1 = "Le présent document, accompagné de l'ensemble des pièces justificatives du dossier, " +
    "atteste de la faisabilité technique et financière du projet d'installation sur le territoire du bénéficiaire, " +
    "sous réserve de la réintégration des aides acquises dans le plan de financement.";
  const lines1 = doc.splitTextToSize(para1, pageWidth - 28);
  doc.text(lines1, 14, yPos);
  yPos += lines1.length * 3.5 + 3;

  const para2 = "Les estimations de production et d'économies présentées dans cette étude sont calculées " +
    "sur la base des données fournies par le bénéficiaire et des conditions d'ensoleillement propres à la zone géographique. " +
    "Les résultats réels pourront varier selon les conditions climatiques effectives et l'évolution des tarifs énergétiques.";
  const lines2 = doc.splitTextToSize(para2, pageWidth - 28);
  doc.text(lines2, 14, yPos);
  yPos += lines2.length * 3.5 + 5;

  // ── "RENSEIGNEMENTS" section (like CEPC) ──
  doc.setFillColor(240, 242, 245);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RENSEIGNEMENTS", 16, yPos + 5);
  yPos += 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grisTexte);
  doc.text("→  Sur www.france-renov.gouv.fr", 16, yPos);
  yPos += 4;
  doc.text("→  Auprès de votre conseiller France Rénov' ou de votre espace territorial.", 16, yPos);
  yPos += 4;
  doc.text("→  Pour toute question relative aux aides financières et aux démarches administratives.", 16, yPos);
  yPos += 6;

  return yPos;
};

// ═══════════════════════════════════════════════════════════════════════════
// PRÉ-ÉTUDE GENERATOR (ancien format complet: diagnostic + préco + financier + verdict)
// ═══════════════════════════════════════════════════════════════════════════

const generatePreEtudePdf = async (data: EtudeData): Promise<jsPDF> => {
  const doc = new jsPDF();
  patchDocTextMethods(doc);
  const products = data.activeProducts || ["PV"];
  const isMulti = products.length > 1;

  let franceRenovBase64 = "";
  let ministereBase64 = "";
  let enedisBase64 = "";
  try { franceRenovBase64 = await loadImageAsBase64(franceRenovLogo); } catch {}
  try { ministereBase64 = await loadImageAsBase64(ministereLogoSvg); } catch {}
  try { enedisBase64 = await loadImageAsBase64(enedisLogo); } catch {}

  const subtitle = isMulti
    ? products.map(p => p === "PV" ? "PHOTOVOLTAÏQUE" : p === "PAC" ? "PAC" : "ITE").join(" + ")
    : products[0] === "PV" ? "INSTALLATION PHOTOVOLTAÏQUE"
    : products[0] === "PAC" ? "POMPE À CHALEUR"
    : "ISOLATION THERMIQUE";

  const pvCtx: PageContext = { doc, data, franceRenovBase64, ministereBase64, subtitle };

  // PAGE 1: Header + Bénéficiaire + PV sections (old format)
  drawHeader(doc, data, franceRenovBase64, subtitle, ministereBase64);
  let yPos = 42;
  yPos = drawBeneficiaire(doc, data, yPos);

  if (products.includes("PV")) {
    yPos = drawPvPage(doc, data, yPos, pvCtx);
  }

  // PAGE PAC
  if (data.pac) {
    if (products.includes("PV")) {
      doc.addPage();
      drawHeader(doc, data, franceRenovBase64, "POMPE À CHALEUR", ministereBase64);
      yPos = 42;
    }
    yPos = drawPacPage(doc, data, yPos);
  }

  // PAGE ITE
  if (data.ite) {
    if (products.includes("PV") || data.pac) {
      doc.addPage();
      drawHeader(doc, data, franceRenovBase64, "ISOLATION THERMIQUE EXTÉRIEURE", ministereBase64);
      yPos = 42;
    }
    yPos = drawItePage(doc, data, yPos);
  }

  // RÉCAP GLOBAL (multi-product only)
  if (isMulti) {
    doc.addPage();
    drawHeader(doc, data, franceRenovBase64, "RÉCAPITULATIF GLOBAL", ministereBase64);
    yPos = 42;
    yPos = drawGlobalSummary(doc, data, yPos);
  }

  // Classification section if available (old format included it)
  if (data.classification || data.classificationComment) {
    const pageWidth = doc.internal.pageSize.getWidth();
    if (pvCtx) yPos = ensureSpace(pvCtx, yPos, 40);
    doc.setFillColor(...bleuMarianne);
    doc.rect(14, yPos, pageWidth - 28, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("STATUT DU DOSSIER", 16, yPos + 5);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [["Élément", "Détail"]],
      body: [
        ["Classification", data.classification || "Non classifié"],
        ["Commentaire", data.classificationComment || "Aucun commentaire"],
      ],
      theme: "striped",
      headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2, textColor: grisTexte },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
      margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // Footers
  const totalPages = doc.getNumberOfPages();
  const logos = { franceRenov: franceRenovBase64, ministere: ministereBase64, enedis: enedisBase64 };
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, data, i, totalPages, i === totalPages, logos);
  }

  return doc;
};

// ═══════════════════════════════════════════════════════════════════════════
// CEPC-STYLE HELPERS (used exclusively by Résultat d'étude)
// ═══════════════════════════════════════════════════════════════════════════

const cepcGris: [number, number, number] = [240, 242, 245];
const cepcBorder: [number, number, number] = [200, 205, 212];

const drawCepcHeader = (doc: jsPDF, data: EtudeData, franceRenovBase64: string, subtitle: string, ministereBase64?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Thin top border line (Marianne blue)
  doc.setFillColor(...bleuMarianne);
  doc.rect(0, 0, pageWidth, 2, "F");

  // Logos
  if (franceRenovBase64) {
    try { doc.addImage(franceRenovBase64, "PNG", 14, 6, 38, 22); } catch {}
  }
  if (ministereBase64) {
    try { doc.addImage(ministereBase64, "PNG", pageWidth - 52, 6, 38, 22); } catch {}
  }

  // Title block — centered, formal
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RÉSULTAT D'ÉTUDE DE FAISABILITÉ", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, pageWidth / 2, 21, { align: "center" });

  // Metadata line
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Référence : ${data.numeroPdl || "—"}  |  Date : ${data.dateEtude}  |  Département : ${data.departement}`, pageWidth / 2, 28, { align: "center" });

  // Separator
  doc.setDrawColor(...cepcBorder);
  doc.setLineWidth(0.3);
  doc.line(14, 32, pageWidth - 14, 32);
};

// Wire up forward reference for ensureSpace
_drawCepcHeaderFn = drawCepcHeader;

const drawCepcSectionBar = (doc: jsPDF, title: string, yPos: number, color?: [number, number, number]): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...(color || cepcGris));
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setDrawColor(...cepcBorder);
  doc.setLineWidth(0.15);
  doc.rect(14, yPos, pageWidth - 28, 7, "S");
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title, 16, yPos + 5);
  return yPos + 9;
};

const cepcTableStyles = {
  theme: "plain" as const,
  headStyles: {
    fillColor: cepcGris,
    textColor: bleuMarianne,
    fontSize: 8,
    fontStyle: "bold" as const,
    cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
    lineWidth: 0.15,
    lineColor: cepcBorder,
  },
  styles: {
    fontSize: 8,
    cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 },
    textColor: grisTexte,
    lineWidth: 0.1,
    lineColor: [220, 225, 230] as [number, number, number],
  },
};

const drawCepcFooter = (doc: jsPDF, data: EtudeData, pageNum: number, totalPages: number, isLastPage = false, logos?: { franceRenov: string; ministere: string; enedis: string }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Institutional logos on last page
  if (isLastPage && logos) {
    const logoH = 16;
    const logoY = pageHeight - 52;
    const frW = 28; const minW = 34; const endW = 40; const gap = 12;
    const totalLogosWidth = frW + minW + endW + gap * 2;
    const startX = (pageWidth - totalLogosWidth) / 2;

    doc.setDrawColor(...cepcBorder);
    doc.setLineWidth(0.2);
    doc.line(startX, logoY - 3, startX + totalLogosWidth, logoY - 3);

    try {
      let x = startX;
      if (logos.franceRenov) { doc.addImage(logos.franceRenov, "PNG", x, logoY, frW, logoH); }
      x += frW + gap;
      if (logos.ministere) { doc.addImage(logos.ministere, "PNG", x, logoY, minW, logoH); }
      x += minW + gap;
      if (logos.enedis) { doc.addImage(logos.enedis, "PNG", x, logoY, endW, logoH); }
    } catch {}
  }

  const footerY = pageHeight - 24;

  doc.setDrawColor(...cepcBorder);
  doc.setLineWidth(0.2);
  doc.line(14, footerY, pageWidth - 14, footerY);

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.clientPrenom} ${data.clientNom} — ${data.clientAdresse}, ${data.clientCodePostal} ${data.clientVille}`, 14, footerY + 4);
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.text("Avis favorable sous réserve de la réintégration des aides acquises dans le plan de financement.", pageWidth / 2, footerY + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${pageNum}/${totalPages}`, pageWidth - 14, footerY + 13, { align: "right" });

  // Bottom thin line (Marianne blue)
  doc.setFillColor(...bleuMarianne);
  doc.rect(0, pageHeight - 1.5, pageWidth, 1.5, "F");
};

// ═══════════════════════════════════════════════════════════════════════════
// CEPC-STYLED SECTION DRAWERS (for Résultat)
// ═══════════════════════════════════════════════════════════════════════════

const drawCepcBeneficiaire = (doc: jsPDF, data: EtudeData, yPos: number): number => {
  yPos = drawCepcSectionBar(doc, "IDENTIFICATION DU BÉNÉFICIAIRE", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ["Nom et prénom", `${data.clientPrenom} ${data.clientNom}`],
      ["Adresse du projet", `${data.clientAdresse}, ${data.clientCodePostal} ${data.clientVille}`],
      ["Département", data.departement],
      ["N° Point de Livraison", data.numeroPdl || "Non renseigné"],
      ...(data.clientTelephone ? [["Téléphone", data.clientTelephone]] : []),
    ],
    ...cepcTableStyles,
    columnStyles: { 0: { fontStyle: "bold" as const, cellWidth: 55 } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });

  return (doc as any).lastAutoTable.finalY + 6;
};

const drawCepcPvDiagnostic = (doc: jsPDF, data: EtudeData, yStart: number, ctx?: PageContext): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = yStart;

  yPos = drawCepcSectionBar(doc, "DIAGNOSTIC TECHNIQUE — PHOTOVOLTAÏQUE", yPos);

  const colWidth = (pageWidth - 28 - 4) / 2;

  autoTable(doc, {
    startY: yPos,
    head: [["Caractéristiques Toiture", ""]],
    body: [
      ["Type de couverture", data.typeToiture],
      ["État général", data.etatToiture],
      ["Surface disponible", data.surfaceToiture],
      ["Ombrage", data.ombreToiture],
      ["Orientation", data.orientation],
      ["Inclinaison", `${data.inclinaison}°`],
    ],
    ...cepcTableStyles,
    columnStyles: { 0: { cellWidth: colWidth / 2 }, 1: { cellWidth: colWidth / 2 - 5, halign: "right" as const } },
    margin: { left: 14, right: pageWidth / 2 + 2, bottom: FOOTER_ZONE_NORMAL },
  });
  const leftY = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: yPos,
    head: [["Installation Électrique", ""]],
    body: [
      ["Type de compteur", data.typeCompteurElectrique],
      ["Raccordement", data.typeRaccordement],
      ["Calibre disjoncteur", `${data.amperageDisjoncteur}A`],
      ["Position boîtier", data.emplacementBoitier],
      ["Faisabilité technique", data.potentielFaisabilite],
    ],
    ...cepcTableStyles,
    columnStyles: { 0: { cellWidth: colWidth / 2 }, 1: { cellWidth: colWidth / 2 - 5, halign: "right" as const } },
    margin: { left: pageWidth / 2 + 2, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = Math.max(leftY, (doc as any).lastAutoTable.finalY) + 6;

  // Préconisation
  if (ctx) yPos = ensureSpace(ctx, yPos, 40);
  yPos = drawCepcSectionBar(doc, "PRÉCONISATION D'INSTALLATION", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [[`Point de Consommation de référence${data.consoIsEstimated ? " (Estimatif)" : " (Relevé client)"}`, "", "Installation Recommandée", ""]],
    body: [
      ["Consommation annuelle", `${formatNumber(data.consoAnnuelle)} kWh`, "Configuration", data.bouquetNom],
      ["Facture mensuelle moy.", formatEuros(data.factureMensuelle), "Puissance crête", `${data.puissanceKwc} kWc`],
      ["", "", "Support d'installation", data.supportInstallation],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Production
  if (ctx) yPos = ensureSpace(ctx, yPos, 35);
  autoTable(doc, {
    startY: yPos,
    head: [["Estimation de Production", "", "", ""]],
    body: [
      ["Surface panneaux", `${data.surfaceInstallation} m²`, "Point de Production Minimal", `${formatNumber(data.productionAnnuelle)} kWh`],
      ["Ensoleillement zone", `${formatNumber(data.heuresEnsoleillement)} h/an`, "Surplus revendable", `${formatNumber(data.surplusProduction)} kWh`],
      ["Rendement orientation", `${data.rendementProductivite}%`, "Taux autoconsommation", `${formatNumber(data.autoconsoPct, 1)}%`],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Coefficients de déperdition PV
  if (ctx) yPos = ensureSpace(ctx, yPos, 50);
  autoTable(doc, {
    startY: yPos,
    head: [["Coefficients de déperdition PV", "Valeur", "Impact sur la production", ""]],
    body: [
      ["Rendement modules (vs STC)", "80,2%", "Efficacité réelle des panneaux", "−19,8%"],
      ["Pertes câblage DC/AC", "98,9%", "Résistance des câbles", "−1,1%"],
      ["Rendement onduleur", "96,5%", "Conversion DC → AC", "−3,5%"],
      ["Pertes température", "95,0%", "Échauffement des cellules", "−5,0%"],
      ["Pertes salissure/poussière", "98,0%", "Encrassement panneaux", "−2,0%"],
      ["Pertes ombrage partiel", "97,0%", "Ombres portées ponctuelles", "−3,0%"],
      ["Pertes mismatch", "98,0%", "Disparité entre modules", "−2,0%"],
      ["Dégradation annuelle", "99,5%", "Vieillissement cellules (~0,5%/an)", "−0,5%"],
    ],
    ...cepcTableStyles,
    headStyles: { ...cepcTableStyles.headStyles, fontSize: 7 },
    styles: { ...cepcTableStyles.styles, fontSize: 7, cellPadding: { top: 1.2, bottom: 1.2, left: 3, right: 3 } },
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const, textColor: [220, 38, 38] as [number, number, number] } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 2;

  // Rendement global
  const rendementGlobal = (0.802 * 0.989 * 0.965 * 0.95 * 0.98 * 0.97 * 0.98 * 0.995 * 100).toFixed(1);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  const rendementText = `Rendement global combiné (hors orientation) : ${rendementGlobal}% — Ces coefficients sont appliqués en amont du calcul de production.`;
  const maxTextWidth = pageWidth - 28;
  const lines = doc.splitTextToSize(rendementText, maxTextWidth);
  doc.text(lines, 14, yPos + 3);
  yPos += 3 + lines.length * 3.5;

  // Analyse financière
  if (ctx) yPos = ensureSpace(ctx, yPos, 120);
  yPos = drawCepcSectionBar(doc, "ANALYSE FINANCIÈRE — PHOTOVOLTAÏQUE", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [["Investissement", "", "Aides Financières", ""]],
    body: [
      ["Installation TTC", formatEuros(data.prixInstallation), "Prime à l'autoconsommation", formatEuros(data.primeAutoconsommation)],
      ["Surcoût support", formatEuros(data.surcoutSupport), "Éco-participation TVA", formatEuros(data.ecoTva)],
      ["Surcoût compteur", formatEuros(data.surcoutCompteur), "", ""],
      ["Autres frais", formatEuros(data.autreSurcout), "TOTAL DES AIDES", formatEuros(data.totalAides)],
      ["COÛT TOTAL BRUT", formatEuros(data.prixTotalHorsAides), "COÛT NET (après aides)", formatEuros(data.totalAidesDeduites)],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Financement & Rentabilité
  if (ctx) yPos = ensureSpace(ctx, yPos, 65);
  autoTable(doc, {
    startY: yPos,
    head: [["Financement", "", "Rentabilité Mensuelle", ""]],
    body: [
      ["Solution", data.financementNom || "Comptant", "Économie autoconsommation", formatEuros(data.autoconsommationEuros)],
      ["Taux effectif", `${data.tauxFinancement}%`, "Revente surplus", formatEuros(data.reventeMensuelleEstimee)],
      ["Durée", `${data.dureeMois} mois`, "Mensualité financement", `-${formatEuros(data.mensualite)}`],
      ["Mensualité", formatEuros(data.mensualite), "RÉSULTAT MENSUEL", formatEuros(data.resultatTransfertCharge)],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    didParseCell: (cellData) => { if (cellData.row.index === 3 && cellData.column.index >= 2) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  return yPos;
};

const drawCepcPacPage = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  if (!data.pac) return yStart;
  const pac = data.pac;
  let yPos = yStart;

  yPos = drawCepcSectionBar(doc, "POMPE À CHALEUR (PAC)", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [["Caractéristiques PAC", "", "Performance", ""]],
    body: [
      ["Type de PAC", pac.subtype === "air_eau" ? "Air/Eau" : "Air/Air", "COP moyen", `${pac.cop}`],
      ["Surface chauffée", `${pac.surfaceChauffee} m²`, "Puissance calorifique", `${pac.puissanceCalorifique} kW`],
      ["Type émetteurs", pac.typeEmetteurs, "Niveau isolation", pac.niveauIsolation],
      ["Énergie actuelle", pac.energieActuelle, "ECS intégré", pac.ecsIntegre ? "Oui" : "Non"],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  if (pac.economies) {
    autoTable(doc, {
      startY: yPos,
      head: [["Bilan Énergétique PAC", "", "", ""]],
      body: [
        ["Besoins chauffage", `${formatNumber(pac.economies.besoinsChauffageKwh)} kWh`, "Facture chauffage actuelle", formatEuros(pac.factureChauffage)],
        ["Conso élec PAC", `${formatNumber(pac.economies.consoElecPacKwh)} kWh`, "Surcoût élec PAC", formatEuros(pac.economies.surcoutElecEuros)],
        ["", "", "ÉCONOMIE NETTE ANNUELLE", formatEuros(pac.economies.economieNetteEuros)],
      ],
      ...cepcTableStyles,
      columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
      didParseCell: (cellData) => { if (cellData.row.index === 2 && cellData.column.index >= 2) cellData.cell.styles.fontStyle = "bold"; },
      margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
    });
    yPos = (doc as any).lastAutoTable.finalY + 4;
  }

  const totalAidesPac = pac.aides.maPrimeRenov + pac.aides.cee + pac.aides.ecoTva + pac.aides.aideLocale;
  autoTable(doc, {
    startY: yPos,
    head: [["Investissement PAC", "", "Aides PAC", ""]],
    body: [
      ["Prix installation", formatEuros(pac.prixInstallation), "MaPrimeRénov'", formatEuros(pac.aides.maPrimeRenov)],
      ["", "", "CEE", formatEuros(pac.aides.cee)],
      ["", "", "Éco TVA", formatEuros(pac.aides.ecoTva)],
      ["", "", "Aide locale", formatEuros(pac.aides.aideLocale)],
      ["COÛT PAC", formatEuros(pac.prixInstallation), "TOTAL AIDES PAC", formatEuros(totalAidesPac)],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });

  return (doc as any).lastAutoTable.finalY + 6;
};

const drawCepcItePage = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  if (!data.ite) return yStart;
  const ite = data.ite;
  let yPos = yStart;

  yPos = drawCepcSectionBar(doc, "ISOLATION THERMIQUE EXTÉRIEURE (ITE)", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [["Caractéristiques ITE", "", "Performance Thermique", ""]],
    body: [
      ["Surface à isoler", `${ite.surfaceIsoler} m²`, "R actuel", `${ite.rActuel} m².K/W`],
      ["Type de façade", ite.typeFacade, "R cible", `${ite.rCible} m².K/W`],
      ["Isolant", ite.typeIsolant, "Épaisseur", `${ite.epaisseurIsolant} mm`],
      ["Nombre de façades", `${ite.nombreFacades}`, "Finition", ite.finition],
      ["Surface ouvertures", `${ite.surfaceOuvertures} m²`, "Économie chauffage", `${ite.economieChauffagePct}%`],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  const totalAidesIte = ite.aides.maPrimeRenov + ite.aides.cee + ite.aides.ecoTva + ite.aides.aideLocale;
  const economieAnnuelle = ite.factureChaufActuelle * (ite.economieChauffagePct / 100);

  autoTable(doc, {
    startY: yPos,
    head: [["Investissement ITE", "", "Aides & Économies ITE", ""]],
    body: [
      ["Prix installation", formatEuros(ite.prixInstallation), "MaPrimeRénov'", formatEuros(ite.aides.maPrimeRenov)],
      ["", "", "CEE", formatEuros(ite.aides.cee)],
      ["", "", "Éco TVA", formatEuros(ite.aides.ecoTva)],
      ["Facture chauffage actuelle", formatEuros(ite.factureChaufActuelle), "TOTAL AIDES ITE", formatEuros(totalAidesIte)],
      ["Économie annuelle estimée", formatEuros(economieAnnuelle), "COÛT NET ITE", formatEuros(ite.prixInstallation - totalAidesIte)],
    ],
    ...cepcTableStyles,
    columnStyles: { 1: { halign: "right" as const }, 3: { halign: "right" as const } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });

  return (doc as any).lastAutoTable.finalY + 6;
};

const drawCepcGlobalSummary = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const products = data.activeProducts || ["PV"];
  if (products.length <= 1) return yStart;

  let yPos = yStart;
  yPos = drawCepcSectionBar(doc, "RÉCAPITULATIF GLOBAL DU PROJET", yPos);

  let totalPrix = 0;
  let totalAides = 0;
  const rows: string[][] = [];

  if (products.includes("PV")) {
    totalPrix += data.prixTotalHorsAides;
    totalAides += data.totalAides;
    rows.push(["Photovoltaïque", `${data.puissanceKwc} kWc`, formatEuros(data.prixTotalHorsAides), formatEuros(data.totalAides), formatEuros(data.prixTotalHorsAides - data.totalAides)]);
  }
  if (data.pac) {
    const aidesPac = data.pac.aides.maPrimeRenov + data.pac.aides.cee + data.pac.aides.ecoTva + data.pac.aides.aideLocale;
    totalPrix += data.pac.prixInstallation;
    totalAides += aidesPac;
    rows.push(["PAC", `${data.pac.puissanceCalorifique} kW`, formatEuros(data.pac.prixInstallation), formatEuros(aidesPac), formatEuros(data.pac.prixInstallation - aidesPac)]);
  }
  if (data.ite) {
    const aidesIte = data.ite.aides.maPrimeRenov + data.ite.aides.cee + data.ite.aides.ecoTva + data.ite.aides.aideLocale;
    totalPrix += data.ite.prixInstallation;
    totalAides += aidesIte;
    rows.push(["ITE", `${data.ite.surfaceIsoler} m²`, formatEuros(data.ite.prixInstallation), formatEuros(aidesIte), formatEuros(data.ite.prixInstallation - aidesIte)]);
  }

  rows.push(["TOTAL PROJET", "", formatEuros(totalPrix), formatEuros(totalAides), formatEuros(totalPrix - totalAides)]);

  autoTable(doc, {
    startY: yPos,
    head: [["Produit", "Capacité", "Coût Brut", "Aides", "Coût Net"]],
    body: rows,
    ...cepcTableStyles,
    headStyles: { ...cepcTableStyles.headStyles, fillColor: cepcGris, textColor: bleuMarianne },
    styles: { ...cepcTableStyles.styles, fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
    columnStyles: {
      0: { fontStyle: "bold" as const },
      2: { halign: "right" as const },
      3: { halign: "right" as const },
      4: { halign: "right" as const },
    },
    didParseCell: (cellData) => {
      if (cellData.row.index === rows.length - 1) {
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.fillColor = cepcGris;
      }
    },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // Combined economies
  let totalEconomiesMensuelles = 0;
  const ecoRows: string[][] = [];

  if (products.includes("PV")) {
    const pvEco = data.autoconsommationEuros + data.reventeMensuelleEstimee;
    totalEconomiesMensuelles += pvEco;
    ecoRows.push(["PV — Autoconsommation + Revente", formatEuros(pvEco) + "/mois"]);
  }
  if (data.pac?.economies) {
    const pacEcoMensuel = data.pac.economies.economieNetteEuros / 12;
    totalEconomiesMensuelles += pacEcoMensuel;
    ecoRows.push(["PAC — Économie chauffage", formatEuros(pacEcoMensuel) + "/mois"]);
  }
  if (data.ite) {
    const iteEcoMensuel = (data.ite.factureChaufActuelle * data.ite.economieChauffagePct / 100) / 12;
    totalEconomiesMensuelles += iteEcoMensuel;
    ecoRows.push(["ITE — Réduction facture chauffage", formatEuros(iteEcoMensuel) + "/mois"]);
  }

  ecoRows.push(["Mensualité financement", `-${formatEuros(data.mensualite)}/mois`]);
  const resultatGlobal = totalEconomiesMensuelles - data.mensualite;
  ecoRows.push(["RÉSULTAT MENSUEL GLOBAL", `${resultatGlobal >= 0 ? "+" : ""}${formatEuros(resultatGlobal)}/mois`]);

  autoTable(doc, {
    startY: yPos,
    head: [["Économies Combinées", "Montant"]],
    body: ecoRows,
    ...cepcTableStyles,
    styles: { ...cepcTableStyles.styles, fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
    columnStyles: { 1: { halign: "right" as const, fontStyle: "bold" as const } },
    didParseCell: (cellData) => {
      if (cellData.row.index === ecoRows.length - 1) {
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.fillColor = resultatGlobal >= 0 ? [220, 252, 231] : [254, 226, 226];
      }
    },
    margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
  });

  return (doc as any).lastAutoTable.finalY + 8;
};

// ═══════════════════════════════════════════════════════════════════════════
// RÉSULTAT D'ÉTUDE GENERATOR (style CEPC formel intégral)
// ═══════════════════════════════════════════════════════════════════════════

const generateResultatPdf = async (data: EtudeData): Promise<jsPDF> => {
  const doc = new jsPDF();
  patchDocTextMethods(doc);
  const products = data.activeProducts || ["PV"];
  const isMulti = products.length > 1;

  let franceRenovBase64 = "";
  let ministereBase64 = "";
  let enedisBase64 = "";
  try { franceRenovBase64 = await loadImageAsBase64(franceRenovLogo); } catch {}
  try { ministereBase64 = await loadImageAsBase64(ministereLogoSvg); } catch {}
  try { enedisBase64 = await loadImageAsBase64(enedisLogo); } catch {}

  const subtitle = isMulti
    ? products.map(p => p === "PV" ? "PHOTOVOLTAÏQUE" : p === "PAC" ? "PAC" : "ITE").join(" + ")
    : products[0] === "PV" ? "INSTALLATION PHOTOVOLTAÏQUE"
    : products[0] === "PAC" ? "POMPE À CHALEUR"
    : "ISOLATION THERMIQUE";

  // Override PageContext to use CEPC header
  const cepcCtx: PageContext = {
    doc, data, franceRenovBase64, ministereBase64, subtitle, headerStyle: "cepc",
  };
  // Monkey-patch ensureSpace to use CEPC header
  const cepcEnsureSpace = (yPos: number, requiredHeight: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const available = pageHeight - FOOTER_ZONE_NORMAL - yPos;
    if (available < requiredHeight) {
      doc.addPage();
      drawCepcHeader(doc, data, franceRenovBase64, subtitle, ministereBase64);
      return 38;
    }
    return yPos;
  };

  // Override ctx for ensureSpace usage — pass cepcCtx but we use cepcEnsureSpace locally
  // We can't easily override ensureSpace, so we adapt the ctx subtitle for header redraws
  // Actually, ensureSpace uses drawHeader — let's just pass ctx with CEPC header approach
  // For simplicity: we replicate the logic inline

  // PAGE 1: CEPC Header + Bénéficiaire
  drawCepcHeader(doc, data, franceRenovBase64, subtitle, ministereBase64);
  let yPos = 38;
  yPos = drawCepcBeneficiaire(doc, data, yPos);

  // PV sections
  if (products.includes("PV")) {
    yPos = drawCepcPvDiagnostic(doc, data, yPos, cepcCtx);
  }

  // PAGE PAC
  if (data.pac) {
    if (products.includes("PV")) {
      doc.addPage();
      drawCepcHeader(doc, data, franceRenovBase64, "POMPE À CHALEUR", ministereBase64);
      yPos = 38;
    }
    yPos = drawCepcPacPage(doc, data, yPos);
  }

  // PAGE ITE
  if (data.ite) {
    if (products.includes("PV") || data.pac) {
      doc.addPage();
      drawCepcHeader(doc, data, franceRenovBase64, "ISOLATION THERMIQUE EXTÉRIEURE", ministereBase64);
      yPos = 38;
    }
    yPos = drawCepcItePage(doc, data, yPos);
  }

  // RÉCAP GLOBAL
  if (isMulti) {
    doc.addPage();
    drawCepcHeader(doc, data, franceRenovBase64, "RÉCAPITULATIF GLOBAL", ministereBase64);
    yPos = 38;
    yPos = drawCepcGlobalSummary(doc, data, yPos);
  }

  // CLASSIFICATION & OBSERVATIONS
  if (data.classification || data.classificationComment) {
    yPos = cepcEnsureSpace(yPos, 40);
    yPos = drawCepcSectionBar(doc, "CLASSIFICATION & OBSERVATIONS", yPos);

    autoTable(doc, {
      startY: yPos,
      head: [["Élément", "Détail"]],
      body: [
        ["Classification interne", data.classification || "Non classifié"],
        ["Observations techniques", data.classificationComment || "Aucune observation"],
      ],
      ...cepcTableStyles,
      columnStyles: { 0: { fontStyle: "bold" as const, cellWidth: 55 } },
      margin: { left: 14, right: 14, bottom: FOOTER_ZONE_NORMAL },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // PAGE FINALE: RÉSULTAT D'ÉTUDE (verdict CEPC)
  doc.addPage();
  drawCepcHeader(doc, data, franceRenovBase64, "RÉSULTAT D'ÉTUDE", ministereBase64);
  yPos = 38;
  yPos = drawResultatEtude(doc, data, yPos);

  // CEPC Footers
  const totalPages = doc.getNumberOfPages();
  const logos = { franceRenov: franceRenovBase64, ministere: ministereBase64, enedis: enedisBase64 };
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawCepcFooter(doc, data, i, totalPages, i === totalPages, logos);
  }

  return doc;
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/** Pré-étude (ancien format complet) — téléchargeable depuis le formulaire d'étude */
export const exportPreEtudePdf = async (data: EtudeData): Promise<void> => {
  const doc = await generatePreEtudePdf(data);
  const fileName = `PreEtude_${data.clientNom}_${data.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};

export const getPreEtudePdfBlob = async (data: EtudeData): Promise<Blob> => {
  const doc = await generatePreEtudePdf(data);
  return doc.output("blob");
};

/** Résultat d'étude (ultra-complet + formel) — téléchargeable depuis la fiche client */
export const exportResultatPdf = async (data: EtudeData): Promise<void> => {
  const doc = await generateResultatPdf(data);
  const fileName = `Resultat_Etude_${data.clientNom}_${data.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};

export const getResultatPdfBlob = async (data: EtudeData): Promise<Blob> => {
  const doc = await generateResultatPdf(data);
  return doc.output("blob");
};

// Legacy aliases (backward compatibility — maps to pré-étude = ancien format)
export const exportEtudePdf = exportPreEtudePdf;
export const getEtudePdfBlob = getPreEtudePdfBlob;

export const getEtudePdfDataUrl = async (data: EtudeData): Promise<string> => {
  const doc = await generatePreEtudePdf(data);
  return doc.output("datauristring");
};

export type { EtudeData, PacData, IteData };
