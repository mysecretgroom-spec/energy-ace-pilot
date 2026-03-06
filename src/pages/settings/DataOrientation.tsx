import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Compass, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User } from "lucide-react";

interface OrientationData {
  id: string;
  orientation: string;
  inclinaison: number;
  coefficient: number;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const orientationOptions = [
  { value: "sud", label: "Sud" },
  { value: "sud_est", label: "Sud-Est" },
  { value: "sud_ouest", label: "Sud-Ouest" },
  { value: "est", label: "Est" },
  { value: "ouest", label: "Ouest" },
  { value: "nord", label: "Nord" },
];

const orientationLabels: Record<string, string> = {
  sud: "Sud",
  sud_est: "Sud-Est",
  sud_ouest: "Sud-Ouest",
  est: "Est",
  ouest: "Ouest",
  nord: "Nord",
};

const DataOrientation = () => {
  const { user } = useAuth();
  const [data, setData] = useState<OrientationData[]>([]);
  const [originalData, setOriginalData] = useState<OrientationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: orientationData, error } = await supabase
        .from("data_orientation")
        .select("*")
        .order("orientation", { ascending: true })
        .order("inclinaison", { ascending: true });

      if (error) throw error;
      const formattedData = (orientationData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement orientation:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: OrientationData = {
      id: `new-${Date.now()}`,
      orientation: "sud",
      inclinaison: 30,
      coefficient: 1,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof OrientationData, value: any) => {
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
    if (!confirm("Supprimer ce coefficient ?")) return;
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
    
    setSaving(true);
    try {
      const currentIds = new Set(data.filter(d => !d.isNew && !d.isGlobal).map(d => d.id));
      const toDelete = originalData.filter(o => !o.isGlobal && !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("data_orientation").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of data) {
        if (item.isGlobal && !item.isNew) continue;
        
        const payload = {
          orientation: item.orientation,
          inclinaison: item.inclinaison,
          coefficient: item.coefficient,
          user_id: user.id,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_orientation").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_orientation").update(payload).eq("id", item.id);
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

  const getCoeffColor = (coeff: number) => {
    if (coeff >= 0.95) return "text-green-600 bg-green-100";
    if (coeff >= 0.85) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  };

  // Grouper par orientation
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.orientation]) {
      acc[item.orientation] = [];
    }
    acc[item.orientation].push(item);
    return acc;
  }, {} as Record<string, OrientationData[]>);

  return (
    <MobileLayout title="Coefficients orientation" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Compass className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Coefficients de production</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un coefficient
        </Button>

        {/* Liste par orientation */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Aucune donnée disponible</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedData).map(([orientation, items]) => (
            <Card key={orientation}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  {orientationLabels[orientation] || orientation}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className={`p-3 flex items-center gap-3 ${item.isModified ? "bg-amber-500/5" : ""}`}>
                      <Select
                        value={item.orientation}
                        onValueChange={(v) => handleFieldChange(item.id, "orientation", v)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {orientationOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.inclinaison}
                          onChange={(e) => handleFieldChange(item.id, "inclinaison", parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">°</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.coefficient}
                          onChange={(e) => handleFieldChange(item.id, "coefficient", parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-xs"
                        />
                      </div>
                      <Badge className={getCoeffColor(item.coefficient)}>
                        ×{item.coefficient.toFixed(2)}
                      </Badge>
                      {item.isNew && <Badge className="bg-green-500 text-xs">Nouveau</Badge>}
                      {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Modifié</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive ml-auto"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
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

export default DataOrientation;
