import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FraisItem {
  id: string;
  montant: number;
  date_frais: string;
  categorie: string;
  description?: string;
}

interface ExportFraisPDFProps {
  frais: FraisItem[];
  periode: string;
}

export function ExportFraisPDF({ frais, periode }: ExportFraisPDFProps) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user || frais.length === 0) {
      toast.error("Aucun frais à exporter");
      return;
    }

    setExporting(true);

    try {
      // Generate HTML content for PDF
      const total = frais.reduce((sum, f) => sum + f.montant, 0);
      
      const categoryLabels: Record<string, string> = {
        carburant: "Carburant",
        peage: "Péage",
        repas: "Repas",
        hotel: "Hôtel",
        parking: "Parking",
        train: "Trains",
        location_vehicule: "Location Véhicule",
        autre: "Autre",
      };

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Note de frais - ${periode}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f5f9; padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .total { font-weight: bold; font-size: 1.2em; text-align: right; margin-top: 20px; padding: 15px; background: #f1f5f9; }
    .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Note de Frais</h1>
  <div class="info">
    <p><strong>Période :</strong> ${periode}</p>
    <p><strong>Date d'export :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
    <p><strong>Nombre de justificatifs :</strong> ${frais.length}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Catégorie</th>
        <th>Description</th>
        <th style="text-align: right;">Montant</th>
      </tr>
    </thead>
    <tbody>
      ${frais.map(f => `
        <tr>
          <td>${new Date(f.date_frais).toLocaleDateString("fr-FR")}</td>
          <td>${categoryLabels[f.categorie] || f.categorie}</td>
          <td>${f.description || "-"}</td>
          <td style="text-align: right;">${f.montant.toFixed(2)} €</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <div class="total">
    Total : ${total.toFixed(2)} €
  </div>
  
  <div class="footer">
    Document généré automatiquement par DébalePro
  </div>
</body>
</html>
      `;

      // Create a Blob and download
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      // Create a link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `note-de-frais-${periode.replace(/\s/g, "-")}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Export généré avec succès");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleExport}
      disabled={exporting || frais.length === 0}
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
    </Button>
  );
}
