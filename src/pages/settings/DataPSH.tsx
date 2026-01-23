import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sun, Search, Loader2, Plus, Trash2, Save, RotateCcw, Clock, CloudSun, Globe, User } from "lucide-react";

interface PSHData {
  id: string;
  department_code: string;
  department_name: string;
  psh_value: number;
  max_psh_value: number;
  jours_ensoleillement_riche: number;
  jours_ensoleillement_pauvre: number;
  heures_ensoleillement_annuel: number;
  user_id?: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataPSH = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PSHData[]>([]);
  const [originalData, setOriginalData] = useState<PSHData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pshData, error } = await supabase
        .from("data_psh")
        .select("*")
        .order("department_code", { ascending: true });

      if (error) throw error;
      const formattedData = (pshData || []).map(item => {
        const itemWithUserId = item as typeof item & { user_id?: string | null };
        return {
          ...item,
          user_id: itemWithUserId.user_id,
          isNew: false,
          isModified: false,
          isGlobal: itemWithUserId.user_id === null,
        };
      });
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement PSH:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: PSHData = {
      id: `new-${Date.now()}`,
      department_code: "",
      department_name: "Nouveau département",
      psh_value: 1200,
      max_psh_value: 1200,
      jours_ensoleillement_riche: 150,
      jours_ensoleillement_pauvre: 215,
      heures_ensoleillement_annuel: 2800,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof PSHData, value: any) => {
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
    if (!confirm("Supprimer ce département ?")) return;
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
    
    const invalidItems = data.filter(item => !item.isGlobal && (!item.department_code || !item.department_name));
    if (invalidItems.length > 0) {
      toast.error("Code et nom obligatoires pour tous les départements");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(data.filter(d => !d.isNew && !d.isGlobal).map(d => d.id));
      const toDelete = originalData.filter(o => !o.isGlobal && !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("data_psh").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of data) {
        if (item.isGlobal && !item.isNew) continue;
        
        const payload = {
          department_code: item.department_code,
          department_name: item.department_name,
          psh_value: item.psh_value,
          max_psh_value: item.max_psh_value,
          jours_ensoleillement_riche: item.jours_ensoleillement_riche,
          jours_ensoleillement_pauvre: item.jours_ensoleillement_pauvre,
          heures_ensoleillement_annuel: item.heures_ensoleillement_annuel,
          user_id: user.id,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_psh").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_psh").update(payload).eq("id", item.id);
          if (error) throw error;
        }
      }

      toast.success("Modifications enregistrées");
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const filteredData = data.filter(
    (d) =>
      d.department_name.toLowerCase().includes(search.toLowerCase()) ||
      d.department_code.includes(search)
  );

  return (
    <MobileLayout title="PSH par département" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Sun className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Peak Sun Hours (PSH)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un département
        </Button>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un département..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Liste */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Départements</span>
              <Badge variant="secondary">{filteredData.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Aucun résultat</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                {filteredData.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 space-y-3 ${item.isModified ? "bg-amber-500/5" : ""}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={item.department_code}
                        onChange={(e) => handleFieldChange(item.id, "department_code", e.target.value)}
                        className="h-8 w-16 font-mono text-xs"
                        placeholder="Code"
                      />
                      <Input
                        value={item.department_name}
                        onChange={(e) => handleFieldChange(item.id, "department_name", e.target.value)}
                        className="h-8 flex-1 text-sm font-medium"
                        placeholder="Nom du département"
                      />
                      {item.isNew && <Badge className="bg-green-500 text-xs">Nouveau</Badge>}
                      {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Modifié</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Données détaillées */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1">
                        <Sun className="h-3 w-3 text-amber-500" />
                        <span className="text-xs text-muted-foreground">Jours riches:</span>
                        <Input
                          type="number"
                          value={item.jours_ensoleillement_riche}
                          onChange={(e) => handleFieldChange(item.id, "jours_ensoleillement_riche", parseInt(e.target.value) || 0)}
                          className="h-6 w-14 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <CloudSun className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-muted-foreground">Jours pauvres:</span>
                        <Input
                          type="number"
                          value={item.jours_ensoleillement_pauvre}
                          onChange={(e) => handleFieldChange(item.id, "jours_ensoleillement_pauvre", parseInt(e.target.value) || 0)}
                          className="h-6 w-14 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Heures/an:</span>
                        <Input
                          type="number"
                          value={item.heures_ensoleillement_annuel}
                          onChange={(e) => handleFieldChange(item.id, "heures_ensoleillement_annuel", parseInt(e.target.value) || 0)}
                          className="h-6 w-16 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Sun className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground">PSH:</span>
                        <Input
                          type="number"
                          value={item.psh_value}
                          onChange={(e) => handleFieldChange(item.id, "psh_value", parseFloat(e.target.value) || 0)}
                          className="h-6 w-16 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom bar with save button */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex gap-3 z-50">
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
      )}
    </MobileLayout>
  );
};

export default DataPSH;
