import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, Calculator, TrendingDown, TrendingUp } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface FraisWithOCR {
  id: string;
  montant: number;
  date_frais: string;
  categorie: string;
  description: string | null;
  ocr_data: Json | null;
}

interface VATReportProps {
  frais: FraisWithOCR[];
  periode: string;
}

interface OCRData {
  montant_ttc?: number;
  montant_ht?: number;
  tva?: number;
  taux_tva?: number;
  commercant?: string;
}

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  repas: "Repas",
  hotel: "Hôtel",
  peage: "Péage",
  parking: "Parking",
  autre: "Autre",
};

export function VATReport({ frais, periode }: VATReportProps) {
  const [open, setOpen] = useState(false);

  // Calculate VAT totals from OCR data
  const vatData = frais.map((f) => {
    const ocr = f.ocr_data as OCRData | null;
    const ttc = ocr?.montant_ttc ?? Number(f.montant);
    const tva = ocr?.tva ?? null;
    const ht = ocr?.montant_ht ?? (tva !== null ? ttc - tva : null);
    const taux = ocr?.taux_tva ?? null;
    
    return {
      ...f,
      ttc,
      ht,
      tva,
      taux,
      commercant: ocr?.commercant ?? null,
    };
  });

  // Sum totals
  const totalTTC = vatData.reduce((sum, item) => sum + item.ttc, 0);
  const totalTVA = vatData.reduce((sum, item) => sum + (item.tva ?? 0), 0);
  const totalHT = vatData.reduce((sum, item) => sum + (item.ht ?? item.ttc), 0);
  const itemsWithVAT = vatData.filter((v) => v.tva !== null).length;

  // Group by VAT rate
  const byRate: Record<number, { ht: number; tva: number; count: number }> = {};
  vatData.forEach((item) => {
    if (item.taux !== null && item.tva !== null) {
      const rate = item.taux;
      if (!byRate[rate]) {
        byRate[rate] = { ht: 0, tva: 0, count: 0 };
      }
      byRate[rate].ht += item.ht ?? 0;
      byRate[rate].tva += item.tva;
      byRate[rate].count += 1;
    }
  });

  const downloadCSV = () => {
    const headers = ["Date", "Commerçant", "Catégorie", "Description", "Montant TTC", "Montant HT", "TVA", "Taux TVA"];
    const rows = vatData.map((item) => [
      new Date(item.date_frais).toLocaleDateString("fr-FR"),
      item.commercant ?? "",
      categoryLabels[item.categorie] ?? item.categorie,
      item.description ?? "",
      item.ttc.toFixed(2),
      item.ht?.toFixed(2) ?? "",
      item.tva?.toFixed(2) ?? "",
      item.taux ? `${item.taux}%` : "",
    ]);

    // Add totals row
    rows.push([]);
    rows.push(["TOTAUX", "", "", "", totalTTC.toFixed(2), totalHT.toFixed(2), totalTVA.toFixed(2), ""]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport_tva_${periode.replace(/\s/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calculator className="h-4 w-4" />
          Rapport TVA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapport TVA - {periode}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total TTC</p>
                <p className="text-lg font-bold text-foreground">
                  {totalTTC.toFixed(2)} €
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total HT</p>
                <p className="text-lg font-bold text-foreground">
                  {totalHT.toFixed(2)} €
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm bg-status-signed/10 border-status-signed/30">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  TVA récupérable
                </p>
                <p className="text-lg font-bold text-status-signed">
                  {totalTVA.toFixed(2)} €
                </p>
              </CardContent>
            </Card>
          </div>

          {/* VAT by Rate */}
          {Object.keys(byRate).length > 0 && (
            <Card className="shadow-sm mb-4">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">Détail par taux de TVA</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-2">
                  {Object.entries(byRate)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([rate, data]) => (
                      <div
                        key={rate}
                        className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2"
                      >
                        <span className="font-medium">TVA {rate}%</span>
                        <span className="text-muted-foreground">
                          {data.count} facture{data.count > 1 ? "s" : ""}
                        </span>
                        <span className="font-medium text-foreground">
                          HT: {data.ht.toFixed(2)} €
                        </span>
                        <span className="font-bold text-status-signed">
                          TVA: {data.tva.toFixed(2)} €
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Table */}
          <Card className="shadow-sm mb-4">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm">
                Détail des frais ({itemsWithVAT}/{frais.length} avec TVA extraite)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">TTC</TableHead>
                    <TableHead className="text-xs text-right">HT</TableHead>
                    <TableHead className="text-xs text-right">TVA</TableHead>
                    <TableHead className="text-xs text-right">Taux</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vatData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs py-2">
                        {new Date(item.date_frais).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-xs py-2 max-w-32 truncate">
                        {item.commercant || item.description || categoryLabels[item.categorie]}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-medium">
                        {item.ttc.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right">
                        {item.ht !== null ? `${item.ht.toFixed(2)} €` : "-"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right text-status-signed font-medium">
                        {item.tva !== null ? `${item.tva.toFixed(2)} €` : "-"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right text-muted-foreground">
                        {item.taux !== null ? `${item.taux}%` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 pt-2 border-t flex gap-2">
          <Button onClick={downloadCSV} className="flex-1 gap-2">
            <Download className="h-4 w-4" />
            Exporter CSV comptable
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
