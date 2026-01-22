import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EtudeData {
  // Client
  clientNom: string;
  clientPrenom: string;
  clientAdresse: string;
  clientVille: string;
  departement: string;
  
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
}

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

const generatePdfDoc = (data: EtudeData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Couleurs
  const primaryColor: [number, number, number] = [245, 158, 11]; // Amber-500
  const darkColor: [number, number, number] = [30, 41, 59]; // Slate-800
  const successColor: [number, number, number] = [34, 197, 94]; // Green-500
  const warningColor: [number, number, number] = [234, 179, 8]; // Yellow-500
  const dangerColor: [number, number, number] = [239, 68, 68]; // Red-500
  
  let yPos = 15;
  
  // === EN-TÊTE ===
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 30, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ÉTUDE PHOTOVOLTAÏQUE", pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.clientPrenom} ${data.clientNom} • ${data.clientVille}`, pageWidth / 2, 23, { align: "center" });
  
  yPos = 40;
  
  // === INFORMATIONS CLIENT ===
  doc.setTextColor(...darkColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMATIONS CLIENT", 14, yPos);
  yPos += 2;
  
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ["Client", `${data.clientPrenom} ${data.clientNom}`],
      ["Adresse", data.clientAdresse],
      ["Ville", `${data.clientVille} (${data.departement})`],
      ["N° PDL", data.numeroPdl || "Non renseigné"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  // === ÉTUDE TECHNIQUE ===
  doc.setFillColor(240, 240, 240);
  doc.rect(14, yPos - 2, pageWidth - 28, 8, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("ÉTUDE TECHNIQUE", 16, yPos + 4);
  yPos += 12;
  
  // Visite technique
  autoTable(doc, {
    startY: yPos,
    head: [["Visite Technique - Toiture", ""]],
    body: [
      ["Type de toiture", data.typeToiture],
      ["État toiture", data.etatToiture],
      ["Surface toiture", data.surfaceToiture],
      ["Ombre sur toiture", data.ombreToiture],
      ["Orientation", data.orientation],
      ["Inclinaison", `${data.inclinaison}°`],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, halign: "right" },
    },
    margin: { left: 14, right: pageWidth / 2 + 5 },
  });
  
  const leftTableY = yPos;
  
  // Compteur électrique
  autoTable(doc, {
    startY: leftTableY,
    head: [["Compteur & Tableau", ""]],
    body: [
      ["Type compteur", data.typeCompteurElectrique],
      ["Raccordement", data.typeRaccordement],
      ["Ampérage disjoncteur", `${data.amperageDisjoncteur}A`],
      ["Emplacement boîtier", data.emplacementBoitier],
      ["Potentiel faisabilité", data.potentielFaisabilite],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, halign: "right" },
    },
    margin: { left: pageWidth / 2 + 5, right: 14 },
  });
  
  yPos = Math.max((doc as any).lastAutoTable.finalY, (doc as any).lastAutoTable.finalY) + 8;
  
  // Consommations & Préconisation
  autoTable(doc, {
    startY: yPos,
    head: [["Consommations", "", "Préconisation", ""]],
    body: [
      ["Conso. annuelle", `${formatNumber(data.consoAnnuelle)} kWh`, "Bouquet", data.bouquetNom],
      ["Facture mensuelle", formatEuros(data.factureMensuelle), "Puissance", `${data.puissanceKwc} kWc`],
      ["", "", "Type revente", data.typeRevente],
      ["", "", "Support", data.supportInstallation],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  // Données techniques & Résultats
  autoTable(doc, {
    startY: yPos,
    head: [["Données Techniques", "", "Résultats Production", ""]],
    body: [
      ["Surface installation", `${data.surfaceInstallation} m²`, "Production annuelle", `${formatNumber(data.productionAnnuelle)} kWh`],
      ["Ensoleillement", `${formatNumber(data.heuresEnsoleillement)} h/an`, "Surplus production", `${formatNumber(data.surplusProduction)} kWh`],
      ["Rendement productivité", `${data.rendementProductivite}%`, "Autoconsommation", `${formatNumber(data.autoconsoPct, 2)}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // === PRÉ-ÉTUDE FINANCIÈRE ===
  doc.setFillColor(240, 240, 240);
  doc.rect(14, yPos - 2, pageWidth - 28, 8, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("PRÉ-ÉTUDE FINANCIÈRE", 16, yPos + 4);
  yPos += 12;
  
  // Prix & Aides
  autoTable(doc, {
    startY: yPos,
    head: [["PRIX", "", "AIDES", ""]],
    body: [
      ["Installation TTC", formatEuros(data.prixInstallation), "Prime Autoconso", formatEuros(data.primeAutoconsommation)],
      ["Surcoût Support", formatEuros(data.surcoutSupport), "ECO TVA", formatEuros(data.ecoTva)],
      ["Surcoût Compteur", formatEuros(data.surcoutCompteur), "TOTAL Aides", formatEuros(data.totalAides)],
      ["Autre Surcoût", formatEuros(data.autreSurcout), "", ""],
      ["TOTAL Hors Aides", formatEuros(data.prixTotalHorsAides), "Aides Déduites", formatEuros(data.totalAidesDeduites)],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  // Financement
  autoTable(doc, {
    startY: yPos,
    head: [["FINANCEMENT", ""]],
    body: [
      ["Mode financement", data.financementNom || "Non défini"],
      ["Taux effectif", `${data.tauxFinancement}%`],
      ["Durée", `${data.dureeMois} mois`],
      ["Mensualité", formatEuros(data.mensualite)],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, halign: "right" },
    },
    margin: { left: 14, right: pageWidth / 2 + 5 },
  });
  
  const financementTableY = yPos;
  
  // Rentabilité
  autoTable(doc, {
    startY: financementTableY,
    head: [["RENTABILITÉ MENSUELLE", ""]],
    body: [
      ["Autoconsommation €", formatEuros(data.autoconsommationEuros)],
      ["Revente estimée", formatEuros(data.reventeMensuelleEstimee)],
      ["Mensualité", `-${formatEuros(data.mensualite)}`],
      ["Résultat transfert", formatEuros(data.resultatTransfertCharge)],
    ],
    theme: "striped",
    headStyles: { fillColor: darkColor, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, halign: "right" },
    },
    margin: { left: pageWidth / 2 + 5, right: 14 },
  });
  
  yPos = Math.max((doc as any).lastAutoTable.finalY, (doc as any).lastAutoTable.finalY) + 12;
  
  // === VERDICT ===
  let verdictColor = successColor;
  let verdictText = "VALIDE";
  if (data.verdict === "a_etudier") {
    verdictColor = warningColor;
    verdictText = "À ÉTUDIER";
  } else if (data.verdict === "invalide") {
    verdictColor = dangerColor;
    verdictText = "INVALIDE";
  }
  
  doc.setFillColor(...verdictColor);
  doc.roundedRect(pageWidth / 2 - 40, yPos, 80, 20, 3, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(verdictText, pageWidth / 2, yPos + 8, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(
    `${data.resultatTransfertCharge >= 0 ? "+" : ""}${formatEuros(data.resultatTransfertCharge)}/mois`,
    pageWidth / 2,
    yPos + 16,
    { align: "center" }
  );
  
  yPos += 30;
  
  // === CLASSIFICATION (si présente) ===
  if (data.classification) {
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 2, pageWidth - 28, 8, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("CLASSIFICATION DOSSIER", 16, yPos + 4);
    yPos += 12;
    
    const classificationLabels: Record<string, string> = {
      positif: "POSITIF - Vente signée",
      negatif: "NÉGATIF - Projet abandonné",
      r2: "R2 - Second rendez-vous planifié",
      r2_prestudy: "R2 PRÉ-ÉTUDE - En attente d'analyse",
    };
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(classificationLabels[data.classification] || data.classification, 14, yPos);
    yPos += 6;
    
    if (data.classificationComment) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(data.classificationComment, pageWidth - 28);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 4 + 4;
    }
  }
  
  // === PIED DE PAGE ===
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Étude générée le ${today} • SolarFlow`, pageWidth / 2, 285, { align: "center" });
  
  return doc;
};

export const exportEtudePdf = (data: EtudeData): void => {
  const doc = generatePdfDoc(data);
  const fileName = `Etude_${data.clientNom}_${data.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};

export const getEtudePdfBlob = (data: EtudeData): Blob => {
  const doc = generatePdfDoc(data);
  return doc.output("blob");
};

export const getEtudePdfDataUrl = (data: EtudeData): string => {
  const doc = generatePdfDoc(data);
  return doc.output("datauristring");
};

export type { EtudeData };
