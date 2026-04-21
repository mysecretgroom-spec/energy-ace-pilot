import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Sparkles, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RegieAIConfigMultiImport } from "@/components/regie/RegieAIConfigMultiImport";
import { toast } from "sonner";

interface Regie {
  id: string;
  nom: string;
  couleur: string | null;
}

export default function AutoConfigRegie() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [regies, setRegies] = useState<Regie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegieId, setSelectedRegieId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("regies")
          .select("id, nom, couleur")
          .eq("user_id", user.id)
          .order("nom");
        if (error) throw error;
        setRegies(data || []);
        if (data && data.length === 1) setSelectedRegieId(data[0].id);
      } catch (e) {
        console.error(e);
        toast.error("Impossible de charger les régies");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const selectedRegie = regies.find((r) => r.id === selectedRegieId);

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/parametres")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Paramètres automatiques
            </h1>
            <p className="text-xs text-muted-foreground">
              Importez les bouquets, surcoûts et financements d'une régie via screenshots
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Régie cible</h2>
            </div>

            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : regies.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Aucune régie créée pour l'instant.
                </p>
                <Button size="sm" onClick={() => navigate("/parametres/regies")}>
                  <Building2 className="h-4 w-4 mr-1" /> Créer une régie
                </Button>
              </div>
            ) : (
              <>
                <Select value={selectedRegieId} onValueChange={setSelectedRegieId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez la régie à configurer" />
                  </SelectTrigger>
                  <SelectContent>
                    {regies.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2">
                          {r.couleur && (
                            <span
                              className="inline-block h-3 w-3 rounded-full border"
                              style={{ backgroundColor: r.couleur }}
                            />
                          )}
                          {r.nom}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedRegie && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary" className="text-[10px]">PV</Badge>
                    <Badge variant="secondary" className="text-[10px]">PAC</Badge>
                    <Badge variant="secondary" className="text-[10px]">ITE</Badge>
                    <Badge variant="outline" className="text-[10px]">Surcoûts</Badge>
                    <Badge variant="outline" className="text-[10px]">Financements</Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {selectedRegieId && user && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">Import IA multi-screenshots</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/parametres/regies")}>
                  <Settings className="h-4 w-4 mr-1" /> Détails régie
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Ajoutez un ou plusieurs screenshots/PDF (jusqu'à 8). L'IA extraira en une seule analyse les
                bouquets PV/PAC/ITE, les surcoûts par produit et les options de financement.
              </p>

              <RegieAIConfigMultiImport
                regieId={selectedRegieId}
                userId={user.id}
                onComplete={() => {
                  toast.success("Configuration enregistrée");
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
