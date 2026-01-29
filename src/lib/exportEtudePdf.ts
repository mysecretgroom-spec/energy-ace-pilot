import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import franceRenovLogo from "@/assets/logos/france-renov.png";
import ministereLogoSvg from "@/assets/logos/ministere-transition-energetique.svg";

interface EtudeData {
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

// Fonction pour charger une image et la convertir en base64
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

const generatePdfDoc = async (data: EtudeData): Promise<jsPDF> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Couleurs officielles
  const bleuMarianne: [number, number, number] = [0, 0, 145]; // #000091
  const rougeMarianne: [number, number, number] = [225, 0, 15]; // #E1000F
  const grisTexte: [number, number, number] = [58, 58, 58]; // #3A3A3A
  const grisClair: [number, number, number] = [240, 240, 240];
  const successColor: [number, number, number] = [34, 197, 94];
  const warningColor: [number, number, number] = [234, 179, 8];
  const dangerColor: [number, number, number] = [239, 68, 68];
  
  // Charger les logos
  let franceRenovBase64 = "";
  try {
    franceRenovBase64 = await loadImageAsBase64(franceRenovLogo);
  } catch (e) {
    console.warn("Could not load France Rénov logo");
  }
  
  let yPos = 10;
  
  // === EN-TÊTE OFFICIEL ===
  // Bande tricolore en haut
  doc.setFillColor(...bleuMarianne);
  doc.rect(0, 0, 3, 35, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(3, 0, 3, 35, "F");
  doc.setFillColor(...rougeMarianne);
  doc.rect(6, 0, 3, 35, "F");
  
  // Logo France Rénov' à gauche
  if (franceRenovBase64) {
    try {
      doc.addImage(franceRenovBase64, "PNG", 14, 4, 45, 28);
    } catch (e) {
      console.warn("Could not add France Rénov logo to PDF");
    }
  }
  
  // Titre central officiel
  doc.setTextColor(...bleuMarianne);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ÉTUDE DE FAISABILITÉ", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(14);
  doc.text("INSTALLATION PHOTOVOLTAÏQUE", pageWidth / 2, 22, { align: "center" });
  
  // Numéro de référence
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grisTexte);
  const refNumber = `REF-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  doc.text(`Réf. ${refNumber}`, pageWidth - 14, 10, { align: "right" });
  doc.text(`Date: ${data.dateEtude}`, pageWidth - 14, 15, { align: "right" });
  
  // Ligne de séparation
  doc.setDrawColor(...bleuMarianne);
  doc.setLineWidth(0.5);
  doc.line(14, 36, pageWidth - 14, 36);
  
  yPos = 42;
  
  // === INFORMATIONS BÉNÉFICIAIRE ===
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
      ["Adresse du projet", `${data.clientAdresse}`],
      ["Ville", `${data.clientCodePostal} ${data.clientVille}`],
      ["Département", data.departement],
      ["N° Point de Livraison (PDL)", data.numeroPdl || "Non renseigné"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: grisTexte },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 6;
  
  // === DIAGNOSTIC TECHNIQUE ===
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DIAGNOSTIC TECHNIQUE DU SITE", 16, yPos + 5);
  yPos += 9;
  
  // Deux colonnes: Toiture et Installation électrique
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
    columnStyles: {
      0: { cellWidth: colWidth / 2 },
      1: { cellWidth: colWidth / 2 - 5, halign: "right" },
    },
    margin: { left: 14, right: pageWidth / 2 + 2 },
  });
  
  const leftTableEndY = (doc as any).lastAutoTable.finalY;
  
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
    columnStyles: {
      0: { cellWidth: colWidth / 2 },
      1: { cellWidth: colWidth / 2 - 5, halign: "right" },
    },
    margin: { left: pageWidth / 2 + 2, right: 14 },
  });
  
  yPos = Math.max(leftTableEndY, (doc as any).lastAutoTable.finalY) + 6;
  
  // === PRÉCONISATION D'INSTALLATION ===
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PRÉCONISATION D'INSTALLATION", 16, yPos + 5);
  yPos += 9;
  
  autoTable(doc, {
    startY: yPos,
    head: [["Consommation Actuelle", "", "Installation Recommandée", ""]],
    body: [
      ["Consommation annuelle", `${formatNumber(data.consoAnnuelle)} kWh`, "Configuration", data.bouquetNom],
      ["Facture mensuelle moy.", formatEuros(data.factureMensuelle), "Puissance crête", `${data.puissanceKwc} kWc`],
      ["", "", "Type d'injection", data.typeRevente],
      ["", "", "Support d'installation", data.supportInstallation],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: {
      1: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Production estimée
  autoTable(doc, {
    startY: yPos,
    head: [["Estimation de Production", "", "", ""]],
    body: [
      ["Surface panneaux", `${data.surfaceInstallation} m²`, "Production annuelle", `${formatNumber(data.productionAnnuelle)} kWh`],
      ["Ensoleillement zone", `${formatNumber(data.heuresEnsoleillement)} h/an`, "Surplus revendable", `${formatNumber(data.surplusProduction)} kWh`],
      ["Rendement système", `${data.rendementProductivite}%`, "Taux autoconsommation", `${formatNumber(data.autoconsoPct, 1)}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: {
      1: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 6;
  
  // === ANALYSE FINANCIÈRE ===
  doc.setFillColor(...bleuMarianne);
  doc.rect(14, yPos, pageWidth - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ANALYSE FINANCIÈRE", 16, yPos + 5);
  yPos += 9;
  
  // Investissement et Aides
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
    columnStyles: {
      1: { halign: "right" },
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 4;
  
  // Financement et Rentabilité
  autoTable(doc, {
    startY: yPos,
    head: [["Financement", "", "Rentabilité Mensuelle", ""]],
    body: [
      ["Solution de financement", data.financementNom || "Comptant", "Économie autoconsommation", formatEuros(data.autoconsommationEuros)],
      ["Taux effectif", `${data.tauxFinancement}%`, "Revente surplus estimée", formatEuros(data.reventeMensuelleEstimee)],
      ["Durée", `${data.dureeMois} mois`, "Mensualité de financement", `-${formatEuros(data.mensualite)}`],
      ["Mensualité", formatEuros(data.mensualite), "RÉSULTAT MENSUEL", formatEuros(data.resultatTransfertCharge)],
    ],
    theme: "striped",
    headStyles: { fillColor: grisClair, textColor: bleuMarianne, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 1.5, textColor: grisTexte },
    columnStyles: {
      1: { halign: "right" },
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.row.index === 3 && data.column.index >= 2) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  // === VERDICT ENCADRÉ ===
  let verdictColor = successColor;
  let verdictText = "PROJET VIABLE";
  let verdictDesc = "Les conditions techniques et financières sont favorables";
  if (data.verdict === "a_etudier") {
    verdictColor = warningColor;
    verdictText = "À APPROFONDIR";
    verdictDesc = "Une analyse complémentaire est recommandée";
  } else if (data.verdict === "invalide") {
    verdictColor = dangerColor;
    verdictText = "NON RECOMMANDÉ";
    verdictDesc = "Les conditions actuelles ne permettent pas une rentabilité satisfaisante";
  }
  
  // Cadre du verdict
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
  doc.text(
    `${data.resultatTransfertCharge >= 0 ? "+" : ""}${formatEuros(data.resultatTransfertCharge)}/mois`,
    pageWidth / 2,
    yPos + 20,
    { align: "center" }
  );
  
  yPos += 28;
  
  // === CLASSIFICATION (si présente) ===
  if (data.classification) {
    doc.setFillColor(...grisClair);
    doc.rect(14, yPos, pageWidth - 28, 7, "F");
    doc.setTextColor(...bleuMarianne);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("STATUT DU DOSSIER", 16, yPos + 5);
    yPos += 10;
    
    const classificationLabels: Record<string, string> = {
      positif: "POSITIF - Projet validé et signé",
      negatif: "NÉGATIF - Projet non retenu",
      r2: "R2 - Second rendez-vous programmé",
      r2_prestudy: "R2 PRÉ-ÉTUDE - En cours d'analyse",
    };
    
    doc.setTextColor(...grisTexte);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(classificationLabels[data.classification] || data.classification, 14, yPos);
    yPos += 5;
    
    if (data.classificationComment) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(data.classificationComment, pageWidth - 28);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 4 + 2;
    }
  }
  
  // === PIED DE PAGE OFFICIEL ===
  const footerY = pageHeight - 25;
  
  // Ligne de séparation
  doc.setDrawColor(...bleuMarianne);
  doc.setLineWidth(0.3);
  doc.line(14, footerY, pageWidth - 14, footerY);
  
  // Infos client en pied de page
  doc.setTextColor(...grisTexte);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Bénéficiaire :", 14, footerY + 4);
  doc.setFont("helvetica", "normal");
  const clientFullName = `${data.clientPrenom} ${data.clientNom}`;
  const clientFullAddress = `${data.clientAdresse}, ${data.clientCodePostal} ${data.clientVille}`;
  const clientPhone = data.clientTelephone ? ` - Tél: ${data.clientTelephone}` : "";
  doc.text(`${clientFullName}${clientPhone}`, 35, footerY + 4);
  doc.text(clientFullAddress, 35, footerY + 8);
  
  // Mentions légales
  doc.setFontSize(6);
  doc.text("Ce document est une étude préliminaire de faisabilité et ne constitue pas un engagement contractuel.", pageWidth / 2, footerY + 13, { align: "center" });
  
  // Logo Ministère et mentions légales
  doc.text("France Rénov' - Le service public pour mieux rénover mon habitat", 14, footerY + 18);
  doc.text("Ministère de la Transition Énergétique", 14, footerY + 21);
  
  // Date et numéro de page
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Document généré le ${today}`, pageWidth - 14, footerY + 18, { align: "right" });
  doc.text("Page 1/1", pageWidth - 14, footerY + 21, { align: "right" });
  
  // Bande tricolore en bas
  doc.setFillColor(...bleuMarianne);
  doc.rect(0, pageHeight - 3, pageWidth / 3, 3, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(pageWidth / 3, pageHeight - 3, pageWidth / 3, 3, "F");
  doc.setFillColor(...rougeMarianne);
  doc.rect((pageWidth / 3) * 2, pageHeight - 3, pageWidth / 3, 3, "F");
  
  return doc;
};

export const exportEtudePdf = async (data: EtudeData): Promise<void> => {
  const doc = await generatePdfDoc(data);
  const fileName = `Etude_PV_${data.clientNom}_${data.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
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

export type { EtudeData };
