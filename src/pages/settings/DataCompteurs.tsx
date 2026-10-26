import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Zap, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User } from "lucide-react";

interface CompteurData {
  id: string;
  type_compteur: string;
  montant: number;
  description: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataCompteurs = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CompteurData[]>([]);
  const [originalData, setOriginalData] = useState<CompteurData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: compteurData, error } = await supabase
        .from("data_compteurs")
        .select("*")
        .order("type_compteur", { ascending: true });

      if (error) throw error;
      const formattedData = (compteurData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement compteurs:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: CompteurData = {
      id: `new-${Date.now()}`,
      type_compteur: "NOUVEAU",
      montant: 0,
      description: null,
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof CompteurData, value: any) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value, isModified: true };
      }
      return item;
    }));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    const item = data.find(d => d.id === id);
    if (item?.isGlobal && !item.isNew) {
      toast.error("Impossible de supprimer les données globales");
      return;
    }
    if (!confirm("Supprimer ce type de compteur ?")) return;
    setData(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setData(JSON.parse(JSON.stringify(originalData)));
    setHasChanges(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    const invalidItems = data.filter(item => !item.isGlobal && !item.type_compteur);
    if (invalidItems.length > 0) {
      toast.error("Le type est obligatoire pour tous les compteurs");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(data.filter(d => !d.isNew && !d.isGlobal).map(d => d.id));
      const toDelete = originalData.filter(o => !o.isGlobal && !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("data_compteurs").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of data) {
        if (item.isGlobal && !item.isNew) continue;
        
        const payload = {
          type_compteur: item.type_compteur.toUpperCase(),
          montant: item.montant,
          description: item.description,
          actif: item.actif,
          user_id: user.id,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_compteurs").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_compteurs").update(payload).eq("id", item.id);
          if (error) throw error;
        }
      }

      // Silent save
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Types de compteurs" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Types de compteurs</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un type
        </Button>

        {/* Liste */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Types de compteurs</span>
              <Badge variant="secondary">{data.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : data.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Aucun type configuré</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 space-y-2 ${item.isModified ? "bg-amber-500/5" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.type_compteur}
                        onChange={(e) => handleFieldChange(item.id, "type_compteur", e.target.value)}
                        className="h-11 font-medium text-sm flex-1 min-w-0"
                        placeholder="Type"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.montant}
                          onChange={(e) => handleFieldChange(item.id, "montant", parseFloat(e.target.value) || 0)}
                          className="h-11 text-sm w-20"
                        />
                        <span className="text-sm text-muted-foreground">€</span>
                      </div>
                      {item.isNew && <Badge className="bg-green-500 text-xs">Nouveau</Badge>}
                      {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Modifié</Badge>}
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <Switch
                          checked={item.actif}
                          onCheckedChange={(c) => handleFieldChange(item.id, "actif", c)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={item.description || ""}
                      onChange={(e) => handleFieldChange(item.id, "description", e.target.value || null)}
                      className="h-8 text-xs"
                      placeholder="Description optionnelle..."
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom bar with save button */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex gap-3 z-50 transition-all duration-300 ease-out ${
          hasChanges 
            ? "translate-y-0 opacity-100" 
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleReset}
          disabled={saving}
        >
          <RotateCcw className="h-4 w-4" />
          Annuler
        </Button>
        <Button
          className="flex-1 gap-2 bg-gradient-hero"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </MobileLayout>
  );
};

export default DataCompteurs;
