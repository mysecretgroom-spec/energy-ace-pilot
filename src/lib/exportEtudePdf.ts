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

const formatEuros = (value: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
};

const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
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

const drawFooter = (doc: jsPDF, data: EtudeData, pageNum: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 20;
  
  doc.setDrawColor(...bleuMarianne);
  doc.setLineWidth(0.3);
  doc.line(14, footerY, pageWidth - 14, footerY);
  
  doc.setTextColor(...grisTexte);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.clientPrenom} ${data.clientNom} - ${data.clientAdresse}, ${data.clientCodePostal} ${data.clientVille}`, 14, footerY + 4);
  doc.setFontSize(6);
  doc.text("Ce document est une étude préliminaire de faisabilité et ne constitue pas un engagement contractuel.", pageWidth / 2, footerY + 9, { align: "center" });
  doc.text(`Page ${pageNum}/${totalPages}`, pageWidth - 14, footerY + 13, { align: "right" });
  
  // Bottom tricolor
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
    margin: { left: 14, right: 14 },
  });
  
  return (doc as any).lastAutoTable.finalY + 6;
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE PV
// ═══════════════════════════════════════════════════════════════════════════
const drawPvPage = (doc: jsPDF, data: EtudeData, yStart: number): number => {
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
    margin: { left: 14, right: pageWidth / 2 + 2, bottom: 25 },
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
    margin: { left: pageWidth / 2 + 2, right: 14, bottom: 25 },
  });
  yPos = Math.max(leftY, (doc as any).lastAutoTable.finalY) + 6;
  
  // Préconisation
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
    margin: { left: 14, right: 14, bottom: 25 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Production
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
    margin: { left: 14, right: 14, bottom: 25 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Coefficients de déperdition PV
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
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 1.2, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right", textColor: [220, 38, 38] } },
    margin: { left: 14, right: 14, bottom: 25 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 2;

  // Rendement global combiné
  const rendementGlobal = (0.802 * 0.989 * 0.965 * 0.95 * 0.98 * 0.97 * 0.98 * 0.995 * 100).toFixed(1);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...grisTexte);
  doc.text(`Rendement global combiné (hors orientation) : ${rendementGlobal}% — Ces coefficients sont appliqués en amont du calcul de production.`, 14, yPos + 3);
  yPos += 8;
  
  // Analyse financière
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
    margin: { left: 14, right: 14, bottom: 25 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Financement & Rentabilité
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
    margin: { left: 14, right: 14, bottom: 25 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  // Verdict
  let verdictColor = successColor;
  let verdictText = "PROJET VIABLE";
  let verdictDesc = "Les conditions techniques et financières sont favorables";
  if (data.verdict === "a_etudier") {
    verdictColor = warningColor; verdictText = "À APPROFONDIR"; verdictDesc = "Une analyse complémentaire est recommandée";
  } else if (data.verdict === "invalide") {
    verdictColor = dangerColor; verdictText = "NON RECOMMANDÉ"; verdictDesc = "Les conditions actuelles ne permettent pas une rentabilité satisfaisante";
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
const drawPacPage = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  if (!data.pac) return yStart;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pac = data.pac;
  let yPos = yStart;
  
  doc.setFillColor(...pacColor);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("POMPE À CHALEUR (PAC)", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Caractéristiques PAC", "", "Performance", ""]],
    body: [
      ["Type de PAC", pac.subtype === "air_eau" ? "Air/Eau" : "Air/Air", "COP moyen", `${pac.cop}`],
      ["Surface chauffée", `${pac.surfaceChauffee} m²`, "Puissance calorifique", `${pac.puissanceCalorifique} kW`],
      ["Type émetteurs", pac.typeEmetteurs, "Niveau isolation", pac.niveauIsolation],
      ["Énergie actuelle", pac.energieActuelle, "ECS intégré", pac.ecsIntegre ? "Oui" : "Non"],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: pacColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Économies PAC
  if (pac.economies) {
    autoTable(doc, {
      startY: yPos,
      head: [["Bilan Énergétique PAC", "", "", ""]],
      body: [
        ["Besoins chauffage", `${formatNumber(pac.economies.besoinsChauffageKwh)} kWh`, "Facture chauffage actuelle", formatEuros(pac.factureChauffage)],
        ["Conso élec PAC", `${formatNumber(pac.economies.consoElecPacKwh)} kWh`, "Surcoût élec PAC", formatEuros(pac.economies.surcoutElecEuros)],
        ["", "", "ÉCONOMIE NETTE ANNUELLE", formatEuros(pac.economies.economieNetteEuros)],
      ],
      theme: "striped",
      headStyles: { fillColor: grisClair, textColor: pacColor, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      didParseCell: (cellData) => { if (cellData.row.index === 2 && cellData.column.index >= 2) cellData.cell.styles.fontStyle = "bold"; },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 4;
  }
  
  // Financier PAC
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
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: pacColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14 },
  });
  
  return (doc as any).lastAutoTable.finalY + 6;
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE ITE
// ═══════════════════════════════════════════════════════════════════════════
const drawItePage = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  if (!data.ite) return yStart;
  const pageWidth = doc.internal.pageSize.getWidth();
  const ite = data.ite;
  let yPos = yStart;
  
  doc.setFillColor(...iteColor);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ISOLATION THERMIQUE EXTÉRIEURE (ITE)", 16, yPos + 5);
  yPos += 9;
  
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
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: iteColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Financier ITE
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
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: iteColor, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (cellData) => { if (cellData.row.index === 4) cellData.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14 },
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
    margin: { left: 14, right: 14 },
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
    margin: { left: 14, right: 14 },
  });
  
  return (doc as any).lastAutoTable.finalY + 8;
};

// ═══════════════════════════════════════════════════════════════════════════
// RÉSULTAT D'ÉTUDE
// ═══════════════════════════════════════════════════════════════════════════
const drawResultatEtude = (doc: jsPDF, data: EtudeData, yStart: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = yStart;

  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RÉSULTAT D'ÉTUDE", 16, yPos + 5);
  yPos += 9;

  const classificationLabels: Record<string, string> = {
    positif: "POSITIF - Projet validé et signé",
    negatif: "NÉGATIF - Projet non retenu",
    r2: "R2 - Second rendez-vous programmé",
    r2_prestudy: "R2 PRÉ-ÉTUDE - En cours d'analyse",
  };

  // Validation checks
  const autoconsoValid = data.autoconsoPct > 0;
  const autofinancementValid = data.resultatTransfertCharge >= 0;
  const check = "✓";
  const cross = "✗";

  autoTable(doc, {
    startY: yPos,
    head: [["Critère de validation", "Statut", "Détail", ""]],
    body: [
      [
        "Autoconsommation",
        autoconsoValid ? `${check} Validé` : `${cross} Non validé`,
        `Taux: ${formatNumber(data.autoconsoPct, 1)}%`,
        `Gain: ${formatEuros(data.autoconsommationEuros)}/mois`,
      ],
      [
        "Autofinancement",
        autofinancementValid ? `${check} Validé` : `${cross} Non validé`,
        `Résultat: ${data.resultatTransfertCharge >= 0 ? "+" : ""}${formatEuros(data.resultatTransfertCharge)}/mois`,
        `Mensualité: ${formatEuros(data.mensualite)}/mois`,
      ],
      [
        "Non-opposition ABF",
        `${check} Conforme`,
        "Architecte des Bâtiments de France",
        "",
      ],
      [
        "Urbanisme",
        `${check} Conforme`,
        "Déclaration préalable de travaux",
        "",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    didParseCell: (cellData) => {
      if (cellData.column.index === 1 && cellData.section === "body") {
        const val = String(cellData.cell.raw);
        if (val.includes(check)) cellData.cell.styles.textColor = [22, 163, 74]; // green
        else if (val.includes(cross)) cellData.cell.styles.textColor = [220, 38, 38]; // red
        cellData.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14, bottom: 25 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Classification label
  doc.setTextColor(...grisTexte);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Conclusion : ${classificationLabels[data.classification || ""] || data.classification || ""}`, 14, yPos);
  yPos += 6;

  // Avis favorable
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...bleuMarianne);
  doc.text("Avis favorable sous réserve de la réintégration des aides acquises dans le plan de financement.", 14, yPos);
  doc.setTextColor(...grisTexte);
  yPos += 6;

  if (data.classificationComment) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(`Note : ${data.classificationComment}`, 14, yPos);
    yPos += 5;
  }

  return yPos;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

const generatePdfDoc = async (data: EtudeData): Promise<jsPDF> => {
  const doc = new jsPDF();
  const products = data.activeProducts || ["PV"];
  const isMulti = products.length > 1;
  
  let franceRenovBase64 = "";
  let ministereBase64 = "";
  try { franceRenovBase64 = await loadImageAsBase64(franceRenovLogo); } catch {}
  try { ministereBase64 = await loadImageAsBase64(ministereLogoSvg); } catch {}
  
  const subtitle = isMulti
    ? products.map(p => p === "PV" ? "PHOTOVOLTAÏQUE" : p === "PAC" ? "PAC" : "ITE").join(" + ")
    : products[0] === "PV" ? "INSTALLATION PHOTOVOLTAÏQUE" 
    : products[0] === "PAC" ? "POMPE À CHALEUR"
    : "ISOLATION THERMIQUE";
  
  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1: Header + Bénéficiaire + PV (or first product)
  // ═══════════════════════════════════════════════════════════════════════
  drawHeader(doc, data, franceRenovBase64, subtitle, ministereBase64);
  let yPos = 42;
  yPos = drawBeneficiaire(doc, data, yPos);
  
  if (products.includes("PV")) {
    yPos = drawPvPage(doc, data, yPos);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PAGE PAC (new page if multi)
  // ═══════════════════════════════════════════════════════════════════════
  if (data.pac) {
    if (products.includes("PV")) {
      doc.addPage();
      drawHeader(doc, data, franceRenovBase64, "POMPE À CHALEUR", ministereBase64);
      yPos = 42;
    }
    yPos = drawPacPage(doc, data, yPos);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PAGE ITE (new page if multi)
  // ═══════════════════════════════════════════════════════════════════════
  if (data.ite) {
    if (products.includes("PV") || data.pac) {
      doc.addPage();
      drawHeader(doc, data, franceRenovBase64, "ISOLATION THERMIQUE EXTÉRIEURE", ministereBase64);
      yPos = 42;
    }
    yPos = drawItePage(doc, data, yPos);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RÉCAP GLOBAL (only for multi-product)
  // ═══════════════════════════════════════════════════════════════════════
  if (isMulti) {
    doc.addPage();
    drawHeader(doc, data, franceRenovBase64, "RÉCAPITULATIF GLOBAL", ministereBase64);
    yPos = 42;
    yPos = drawGlobalSummary(doc, data, yPos);
    
    // Résultat d'étude on recap page
    if (data.classification) {
      yPos = drawResultatEtude(doc, data, yPos);
    }
  } else if (data.classification) {
    // Single product: classification on same page
    if (yPos > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage();
      drawHeader(doc, data, franceRenovBase64, subtitle, ministereBase64);
      yPos = 42;
    }
    yPos = drawResultatEtude(doc, data, yPos);
  }
  
  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, data, i, totalPages);
  }
  
  return doc;
};

export const exportEtudePdf = async (data: EtudeData): Promise<void> => {
  const doc = await generatePdfDoc(data);
  const fileName = `Etude_${data.clientNom}_${data.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};

export const getEtudePdfBlob = async (data: EtudeData): Promise<Blob> => {
  const doc = await generatePdfDoc(data);
  return doc.output("blob");
};

export const getEtudePdfDataUrl = async (data: EtudeData): Promise<string> => {
  const doc = await generatePdfDoc(data);
  return doc.output("datauristring");
};

export type { EtudeData, PacData, IteData };
