import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export interface AideManuelle {
  id: string;
  nom: string;
  type_calcul: "fixe" | "par_kwc" | "pourcentage";
  valeur: number;
  montant_calcule?: number;
}

interface HejjaAidesEditorProps {
  aides: AideManuelle[];
  onAidesChange: (aides: AideManuelle[]) => void;
  puissanceKwc: number;
  prixTotal: number;
  ecoTva: number;
  primeAutoconso?: number;
}

const typeCalculLabels: Record<string, string> = {
  fixe: "Montant fixe (€)",
  par_kwc: "Par kWc",
  pourcentage: "Pourcentage (%)",
};

export function HejjaAidesEditor({
  aides,
  onAidesChange,
  puissanceKwc,
  prixTotal,
  ecoTva,
  primeAutoconso = 0,
}: HejjaAidesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AideManuelle>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAide, setNewAide] = useState<Partial<AideManuelle>>({
    nom: "",
    type_calcul: "fixe",
    valeur: 0,
  });

  const calculateMontant = (aide: AideManuelle): number => {
    switch (aide.type_calcul) {
      case "fixe":
        return aide.valeur;
      case "par_kwc":
        return aide.valeur * puissanceKwc;
      case "pourcentage":
        return (aide.valeur / 100) * prixTotal;
      default:
        return aide.valeur;
    }
  };

  const handleAddAide = () => {
    if (!newAide.nom?.trim()) return;
    
    const aide: AideManuelle = {
      id: `aide_${Date.now()}`,
      nom: newAide.nom.trim(),
      type_calcul: newAide.type_calcul || "fixe",
      valeur: Number(newAide.valeur) || 0,
    };
    aide.montant_calcule = calculateMontant(aide);
    
    onAidesChange([...aides, aide]);
    setNewAide({ nom: "", type_calcul: "fixe", valeur: 0 });
    setShowAddForm(false);
  };

  const handleUpdateAide = (id: string) => {
    const updatedAides = aides.map(a => {
      if (a.id === id) {
        const updated = { ...a, ...editForm };
        updated.montant_calcule = calculateMontant(updated);
        return updated;
      }
      return a;
    });
    onAidesChange(updatedAides);
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteAide = (id: string) => {
    onAidesChange(aides.filter(a => a.id !== id));
  };

  const startEditing = (aide: AideManuelle) => {
    setEditingId(aide.id);
    setEditForm({ nom: aide.nom, type_calcul: aide.type_calcul, valeur: aide.valeur });
  };

  const totalAidesManuelles = aides.reduce((sum, a) => sum + (a.montant_calcule || calculateMontant(a)), 0);
  const totalAidesGlobal = ecoTva + primeAutoconso + totalAidesManuelles;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-4 w-4 text-red-500" />
          <span className="text-xs font-medium text-red-500">Mode HEJJA - Aides modifiables</span>
        </div>
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
          HEJJA
        </Badge>
      </div>

      {/* Aides standards (lecture seule, affichage) */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Prime Coup de Pouce Producteur (standard)</span>
          <span className="font-medium text-status-signed">
            {primeAutoconso.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
          </span>
        </div>
        <div className="flex justify-between">
          <span>ECO TVA (standard)</span>
          <span className="font-medium text-status-signed">
            {ecoTva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
          </span>
        </div>
      </div>

      <Separator />

      {/* Aides manuelles HEJJA */}
      <div className="space-y-2">
        <Label className="text-xs">Aides manuelles HEJJA</Label>
        
        {aides.map((aide) => (
          <div
            key={aide.id}
            className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            {editingId === aide.id ? (
              <>
                <Input
                  value={editForm.nom || ""}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  placeholder="Nom"
                  className="h-7 text-xs flex-1"
                />
                <Select
                  value={editForm.type_calcul}
                  onValueChange={(v) => setEditForm({ ...editForm, type_calcul: v as AideManuelle["type_calcul"] })}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixe">Fixe</SelectItem>
                    <SelectItem value="par_kwc">Par kWc</SelectItem>
                    <SelectItem value="pourcentage">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={editForm.valeur || ""}
                  onChange={(e) => setEditForm({ ...editForm, valeur: Number(e.target.value) })}
                  className="h-7 w-20 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleUpdateAide(aide.id)}
                >
                  <Check className="h-3 w-3 text-green-500" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{aide.nom}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {typeCalculLabels[aide.type_calcul]}: {aide.valeur}
                  </p>
                </div>
                <span className="text-xs font-bold text-red-600">
                  {calculateMontant(aide).toLocaleString("fr-FR")}€
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => startEditing(aide)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-red-500 hover:text-red-600"
                  onClick={() => handleDeleteAide(aide.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}

        {/* Add new aide form */}
        {showAddForm ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-dashed">
            <Input
              value={newAide.nom || ""}
              onChange={(e) => setNewAide({ ...newAide, nom: e.target.value })}
              placeholder="Nom de l'aide"
              className="h-7 text-xs flex-1"
            />
            <Select
              value={newAide.type_calcul}
              onValueChange={(v) => setNewAide({ ...newAide, type_calcul: v as AideManuelle["type_calcul"] })}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixe">Fixe</SelectItem>
                <SelectItem value="par_kwc">Par kWc</SelectItem>
                <SelectItem value="pourcentage">%</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={newAide.valeur || ""}
              onChange={(e) => setNewAide({ ...newAide, valeur: Number(e.target.value) })}
              placeholder="Valeur"
              className="h-7 w-20 text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleAddAide}
            >
              <Check className="h-3 w-3 text-green-500" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setShowAddForm(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs border-dashed"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter une aide HEJJA
          </Button>
        )}
      </div>

      <Separator />

      {/* Total */}
      <div className="flex justify-between font-bold text-sm bg-red-500/10 rounded p-2">
        <span>TOTAL AIDES (HEJJA)</span>
        <span className="text-red-600">{totalAidesGlobal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
      </div>
    </div>
  );
}
