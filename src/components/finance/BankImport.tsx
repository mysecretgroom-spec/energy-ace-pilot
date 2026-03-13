import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Upload, 
  Loader2, 
  Check, 
  X, 
  FileSpreadsheet, 
  Calendar,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  selected: boolean;
  isExpense: boolean;
}

interface BankImportProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const categoryKeywords: Record<string, string[]> = {
  carburant: ["total", "shell", "bp", "esso", "intermarche", "leclerc", "auchan", "carrefour", "station", "essence", "gasoil", "diesel", "fuel"],
  peage: ["sanef", "vinci", "autoroute", "cofiroute", "aprr", "area", "asf", "péage", "peage", "toll"],
  repas: ["restaurant", "brasserie", "bistro", "pizza", "burger", "mcdonald", "kfc", "subway", "paul", "boulangerie", "patisserie", "cafe", "bar", "tabac", "relay", "sodexo", "elior", "flunch", "buffalo", "courtepaille", "hippopotamus", "leon"],
  hotel: ["hotel", "ibis", "novotel", "mercure", "accor", "b&b", "formule 1", "premiere classe", "campanile", "kyriad", "best western", "airbnb", "booking"],
  parking: ["parking", "effia", "indigo", "vinci park", "q-park", "interparking", "saemes", "zenpark"],
  train: ["sncf", "ouigo", "tgv", "ter", "eurostar", "thalys", "inoui", "intercites", "trainline", "gare"],
  location_vehicule: ["hertz", "avis", "europcar", "sixt", "enterprise", "budget", "national", "alamo", "getaround", "drivy", "ada", "rent a car", "rentacar", "location voiture"],
};

function detectCategory(description: string): string {
  const lowerDesc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category;
    }
  }
  return "autre";
}

function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Try to detect CSV format (different banks have different formats)
  const header = lines[0].toLowerCase();
  const delimiter = header.includes(';') ? ';' : ',';
  
  const transactions: ParsedTransaction[] = [];
  
  // Common column patterns for French banks
  const datePatterns = ['date', 'date operation', 'date opération', 'date de l\'opération'];
  const descPatterns = ['libelle', 'libellé', 'description', 'intitulé', 'designation'];
  const amountPatterns = ['montant', 'debit', 'crédit', 'credit', 'amount'];
  
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/\"/g, ''));
  
  let dateCol = headers.findIndex(h => datePatterns.some(p => h.includes(p)));
  let descCol = headers.findIndex(h => descPatterns.some(p => h.includes(p)));
  let amountCol = headers.findIndex(h => amountPatterns.some(p => h.includes(p)));
  
  // Fallback: if not found, try positional
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1;
  if (amountCol === -1) amountCol = headers.length - 1;
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/\"/g, ''));
    if (values.length < 3) continue;
    
    const dateStr = values[dateCol];
    const description = values[descCol];
    let amountStr = values[amountCol];
    
    // Parse amount (handle French format: 1 234,56)
    amountStr = amountStr.replace(/\s/g, '').replace(',', '.');
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount)) continue;
    
    // Parse date (handle multiple formats)
    let parsedDate = parseDate(dateStr);
    if (!parsedDate) continue;
    
    const isExpense = amount < 0;
    const category = isExpense ? detectCategory(description) : null;
    
    transactions.push({
      id: `${i}-${Date.now()}`,
      date: parsedDate,
      description,
      amount: Math.abs(amount),
      category,
      selected: isExpense, // Only expenses are selected by default
      isExpense,
    });
  }
  
  return transactions;
}

function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // Basic OFX parser for STMTTRN elements
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  let idx = 0;
  
  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/);
    const amountMatch = block.match(/<TRNAMT>([+-]?\d+\.?\d*)/);
    const nameMatch = block.match(/<NAME>([^<]+)/);
    const memoMatch = block.match(/<MEMO>([^<]+)/);
    
    if (!dateMatch || !amountMatch) continue;
    
    const dateStr = dateMatch[1];
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const parsedDate = `${year}-${month}-${day}`;
    
    const amount = parseFloat(amountMatch[1]);
    const description = nameMatch?.[1] || memoMatch?.[1] || "Transaction";
    
    const isExpense = amount < 0;
    const category = isExpense ? detectCategory(description) : null;
    
    transactions.push({
      id: `ofx-${idx++}-${Date.now()}`,
      date: parsedDate,
      description: description.trim(),
      amount: Math.abs(amount),
      category,
      selected: isExpense,
      isExpense,
    });
  }
  
  return transactions;
}

function parseDate(dateStr: string): string | null {
  // Try common French date formats
  const formats = [
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD-MM-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // DD.MM.YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[2]) {
        // Already YYYY-MM-DD
        return dateStr;
      }
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

// Filter for work week: Sunday to Friday
function filterWorkWeek(transactions: ParsedTransaction[]): ParsedTransaction[] {
  return transactions.filter(t => {
    const date = new Date(t.date);
    const dayOfWeek = date.getDay();
    // Sunday = 0, Monday = 1, ..., Friday = 5, Saturday = 6
    // Keep Sunday (0) to Friday (5)
    return dayOfWeek >= 0 && dayOfWeek <= 5;
  });
}

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  peage: "Péage",
  repas: "Repas",
  hotel: "Hôtel",
  parking: "Parking",
  autre: "Autre",
};

const categoryColors: Record<string, string> = {
  carburant: "bg-orange-500/10 text-orange-600",
  peage: "bg-blue-500/10 text-blue-600",
  repas: "bg-green-500/10 text-green-600",
  hotel: "bg-purple-500/10 text-purple-600",
  parking: "bg-cyan-500/10 text-cyan-600",
  autre: "bg-gray-500/10 text-gray-600",
};

export function BankImport({ onSuccess, onCancel }: BankImportProps) {
  const { user } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setFileName(file.name);

    try {
      const content = await file.text();
      const isOFX = file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx');
      
      let parsed = isOFX ? parseOFX(content) : parseCSV(content);
      
      // Filter to work week only (Sunday-Friday)
      parsed = filterWorkWeek(parsed);
      
      // Sort by date descending
      parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTransactions(parsed);
      
      const expenses = parsed.filter(t => t.isExpense);
      toast.success(`${expenses.length} dépenses trouvées sur ${parsed.length} transactions`);
    } catch (err) {
      console.error("Parse error:", err);
      toast.error("Erreur lors de l'analyse du fichier");
    } finally {
      setParsing(false);
    }
  }, []);

  const toggleTransaction = (id: string) => {
    setTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    );
  };

  const toggleAll = (selected: boolean) => {
    setTransactions(prev => 
      prev.map(t => t.isExpense ? { ...t, selected } : t)
    );
  };

  const updateCategory = (id: string, category: string) => {
    setTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, category } : t)
    );
  };

  const handleSave = async () => {
    if (!user) return;
    
    const selectedExpenses = transactions.filter(t => t.selected && t.isExpense);
    if (selectedExpenses.length === 0) {
      toast.error("Sélectionnez au moins une dépense à importer");
      return;
    }

    setSaving(true);
    try {
      const fraisToInsert = selectedExpenses.map(t => ({
        user_id: user.id,
        montant: t.amount,
        date_frais: clampDateToToday(t.date),
        categorie: (t.category || "autre") as "carburant" | "peage" | "repas" | "hotel" | "parking" | "autre",
        description: t.description,
        ocr_data: {
          source: "bank_import",
          original_description: t.description,
          auto_categorized: true,
        } as any,
      }));

      const { error } = await supabase.from("frais").insert(fraisToInsert);

      if (error) throw error;

      toast.success(`${selectedExpenses.length} frais importés avec succès`);
      onSuccess?.();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erreur lors de l'import");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = transactions.filter(t => t.selected && t.isExpense).length;
  const expenseCount = transactions.filter(t => t.isExpense).length;
  const totalSelected = transactions
    .filter(t => t.selected && t.isExpense)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import relevé bancaire
        </CardTitle>
        <CardDescription>
          Importez votre relevé CSV ou OFX. Les dépenses du dimanche au vendredi seront filtrées automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File input */}
        {!fileName && (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv,.ofx,.qfx"
              onChange={handleFileSelect}
              className="hidden"
              id="bank-file-input"
            />
            <label
              htmlFor="bank-file-input"
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Sélectionner un fichier
              </span>
              <span className="text-xs text-muted-foreground/70">
                Formats: CSV, OFX, QFX
              </span>
            </label>
          </div>
        )}

        {/* Parsing indicator */}
        {parsing && (
          <div className="flex items-center justify-center p-8 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Analyse du fichier...</span>
          </div>
        )}

        {/* File loaded */}
        {fileName && !parsing && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFileName(null);
                  setTransactions([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedCount} / {expenseCount} dépenses sélectionnées
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAll(true)}
                >
                  Tout sélectionner
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAll(false)}
                >
                  Tout désélectionner
                </Button>
              </div>
            </div>

            {/* Transactions list */}
            <ScrollArea className="h-[300px] rounded-lg border">
              <div className="p-2 space-y-2">
                {transactions.filter(t => t.isExpense).map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      transaction.selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={transaction.selected}
                      onCheckedChange={() => toggleTransaction(transaction.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary"
                          className={`text-xs ${categoryColors[transaction.category || "autre"]}`}
                        >
                          {categoryLabels[transaction.category || "autre"]}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-destructive">
                        -{transaction.amount.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Info notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-blue-700 dark:text-blue-400">
                <p className="font-medium">Période filtrée : Dimanche → Vendredi</p>
                <p className="text-xs opacity-80">
                  Les transactions du samedi ne sont pas incluses. Vous pouvez désélectionner les frais personnels.
                </p>
              </div>
            </div>

            <Separator />

            {/* Total and actions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total sélectionné</p>
                <p className="text-xl font-bold">
                  {totalSelected.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onCancel}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  className="bg-gradient-hero"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Importer ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
