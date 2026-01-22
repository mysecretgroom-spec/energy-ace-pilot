import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Sun, Search, Loader2, Plus, Pencil, Trash2, Clock, CloudSun } from "lucide-react";

interface PSHData {
  id: string;
  department_code: string;
  department_name: string;
  psh_value: number;
  max_psh_value: number;
  jours_ensoleillement_riche: number;
  jours_ensoleillement_pauvre: number;
  heures_ensoleillement_annuel: number;
}

const DataPSH = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [data, setData] = useState<PSHData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<PSHData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    department_code: "",
    department_name: "",
    psh_value: "",
    max_psh_value: "",
    jours_ensoleillement_riche: "",
    jours_ensoleillement_pauvre: "",
    heures_ensoleillement_annuel: "",
  });
  const [saving, setSaving] = useState(false);

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
      setData(pshData || []);
    } catch (error) {
      console.error("Erreur chargement PSH:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      department_code: "",
      department_name: "",
      psh_value: "1200",
      max_psh_value: "1200",
      jours_ensoleillement_riche: "150",
      jours_ensoleillement_pauvre: "215",
      heures_ensoleillement_annuel: "2800",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: PSHData) => {
    setEditItem(item);
    setFormData({
      department_code: item.department_code,
      department_name: item.department_name,
      psh_value: item.psh_value.toString(),
      max_psh_value: item.max_psh_value.toString(),
      jours_ensoleillement_riche: item.jours_ensoleillement_riche?.toString() || "0",
      jours_ensoleillement_pauvre: item.jours_ensoleillement_pauvre?.toString() || "0",
      heures_ensoleillement_annuel: item.heures_ensoleillement_annuel?.toString() || "0",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.department_code || !formData.department_name) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        department_code: formData.department_code,
        department_name: formData.department_name,
        psh_value: parseFloat(formData.psh_value) || 1200,
        max_psh_value: parseFloat(formData.max_psh_value) || 1200,
        jours_ensoleillement_riche: parseInt(formData.jours_ensoleillement_riche) || 0,
        jours_ensoleillement_pauvre: parseInt(formData.jours_ensoleillement_pauvre) || 0,
        heures_ensoleillement_annuel: parseInt(formData.heures_ensoleillement_annuel) || 0,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_psh")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Département modifié");
      } else {
        const { error } = await supabase.from("data_psh").insert(payload);
        if (error) throw error;
        toast.success("Département ajouté");
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce département ?")) return;

    try {
      const { error } = await supabase.from("data_psh").delete().eq("id", id);
      if (error) throw error;
      toast.success("Département supprimé");
      fetchData();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const filteredData = data.filter(
    (d) =>
      d.department_name.toLowerCase().includes(search.toLowerCase()) ||
      d.department_code.includes(search)
  );

  return (
    <MobileLayout title="PSH par département" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Sun className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Peak Sun Hours (PSH)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Données d'ensoleillement par département : jours riches/pauvres, heures annuelles et PSH (kWh/kWc/an).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions admin */}
        {isAdmin && (
          <Button onClick={openAddDialog} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un département
          </Button>
        )}

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
            {loading || roleLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Aucun résultat</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filteredData.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {item.department_code}
                        </Badge>
                        <span className="font-medium text-sm">
                          {item.department_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Données détaillées */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Sun className="h-3 w-3 text-amber-500" />
                        <span>Jours riches: <strong className="text-foreground">{item.jours_ensoleillement_riche}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CloudSun className="h-3 w-3 text-slate-400" />
                        <span>Jours pauvres: <strong className="text-foreground">{item.jours_ensoleillement_pauvre}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3 text-blue-500" />
                        <span>Heures/an: <strong className="text-foreground">{item.heures_ensoleillement_annuel?.toLocaleString()}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sun className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">PSH: </span>
                        <strong className="text-primary">{item.psh_value} kWh/kWc/an</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog d'édition */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Modifier le département" : "Ajouter un département"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code département</label>
                  <Input
                    value={formData.department_code}
                    onChange={(e) =>
                      setFormData({ ...formData, department_code: e.target.value })
                    }
                    placeholder="01, 02, 2A..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nom</label>
                  <Input
                    value={formData.department_name}
                    onChange={(e) =>
                      setFormData({ ...formData, department_name: e.target.value })
                    }
                    placeholder="Ain, Aisne..."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Jours ensoleillement riche</label>
                  <Input
                    type="number"
                    value={formData.jours_ensoleillement_riche}
                    onChange={(e) =>
                      setFormData({ ...formData, jours_ensoleillement_riche: e.target.value })
                    }
                    placeholder="182"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Jours ensoleillement pauvre</label>
                  <Input
                    type="number"
                    value={formData.jours_ensoleillement_pauvre}
                    onChange={(e) =>
                      setFormData({ ...formData, jours_ensoleillement_pauvre: e.target.value })
                    }
                    placeholder="183"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Heures d'ensoleillement annuel</label>
                <Input
                  type="number"
                  value={formData.heures_ensoleillement_annuel}
                  onChange={(e) =>
                    setFormData({ ...formData, heures_ensoleillement_annuel: e.target.value })
                  }
                  placeholder="2918"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">PSH (kWh/kWc/an)</label>
                  <Input
                    type="number"
                    value={formData.psh_value}
                    onChange={(e) =>
                      setFormData({ ...formData, psh_value: e.target.value })
                    }
                    placeholder="1337"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">PSH Max (kWh/kWc/an)</label>
                  <Input
                    type="number"
                    value={formData.max_psh_value}
                    onChange={(e) =>
                      setFormData({ ...formData, max_psh_value: e.target.value })
                    }
                    placeholder="1337"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editItem ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
};

export default DataPSH;
