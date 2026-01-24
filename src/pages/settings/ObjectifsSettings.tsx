import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { 
  Target, 
  Euro, 
  FileText, 
  Calendar, 
  Loader2, 
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { startOfMonth, endOfMonth } from "date-fns";

interface Objectifs {
  id?: string;
  objectif_ca: number;
  objectif_ventes: number;
  objectif_rdv: number;
  realise_ca?: number;
  realise_ventes?: number;
  realise_rdv?: number;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const ObjectifsSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Selected month/year
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Objectifs data
  const [objectifs, setObjectifs] = useState<Objectifs>({
    objectif_ca: 50000,
    objectif_ventes: 10,
    objectif_rdv: 30,
  });
  const [originalObjectifs, setOriginalObjectifs] = useState<Objectifs>({
    objectif_ca: 50000,
    objectif_ventes: 10,
    objectif_rdv: 30,
  });
  
  // Realized values (for display)
  const [realise, setRealise] = useState({
    ca: 0,
    ventes: 0,
    rdv: 0,
  });

  useEffect(() => {
    if (user) {
      loadObjectifs();
      loadRealise();
    }
  }, [user, selectedMonth, selectedYear]);

  const loadObjectifs = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("objectifs")
      .select("*")
      .eq("user_id", user.id)
      .eq("mois", selectedMonth)
      .eq("annee", selectedYear)
      .maybeSingle();

    if (data) {
      const loaded = {
        id: data.id,
        objectif_ca: data.objectif_ca || 50000,
        objectif_ventes: data.objectif_ventes || 10,
        objectif_rdv: data.objectif_rdv || 30,
      };
      setObjectifs(loaded);
      setOriginalObjectifs(loaded);
    } else {
      // Reset to defaults if no data for this month
      const defaults = {
        objectif_ca: 50000,
        objectif_ventes: 10,
        objectif_rdv: 30,
      };
      setObjectifs(defaults);
      setOriginalObjectifs(defaults);
    }

    setLoading(false);
  };

  const loadRealise = async () => {
    if (!user) return;

    const startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const endDate = endOfMonth(new Date(selectedYear, selectedMonth - 1));

    // Fetch ventes and RDV for the month
    const [ventesRes, rdvRes] = await Promise.all([
      supabase
        .from("ventes")
        .select("montant_ttc")
        .eq("user_id", user.id)
        .gte("date_signature", startDate.toISOString())
        .lte("date_signature", endDate.toISOString())
        .neq("status", "annule"),
      supabase
        .from("rdv")
        .select("id")
        .eq("user_id", user.id)
        .gte("date_heure", startDate.toISOString())
        .lte("date_heure", endDate.toISOString()),
    ]);

    const ventes = ventesRes.data || [];
    const rdv = rdvRes.data || [];

    setRealise({
      ca: ventes.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0),
      ventes: ventes.length,
      rdv: rdv.length,
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    const payload = {
      user_id: user.id,
      mois: selectedMonth,
      annee: selectedYear,
      objectif_ca: objectifs.objectif_ca,
      objectif_ventes: objectifs.objectif_ventes,
      objectif_rdv: objectifs.objectif_rdv,
    };

    const { error } = await supabase.from("objectifs").upsert(payload, {
      onConflict: "user_id,mois,annee",
    });

    if (error) {
      console.error("Error saving objectifs:", error);
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Objectifs enregistrés");
      setOriginalObjectifs({ ...objectifs });
    }

    setSaving(false);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    }
  };

  // Detect changes
  const hasChanges = 
    objectifs.objectif_ca !== originalObjectifs.objectif_ca ||
    objectifs.objectif_ventes !== originalObjectifs.objectif_ventes ||
    objectifs.objectif_rdv !== originalObjectifs.objectif_rdv;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgress = (realise: number, objectif: number) => {
    if (objectif === 0) return 0;
    return Math.min((realise / objectif) * 100, 100);
  };

  const isCurrentMonth = 
    selectedMonth === new Date().getMonth() + 1 && 
    selectedYear === new Date().getFullYear();

  if (loading) {
    return (
      <MobileLayout title="Objectifs" showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Objectifs" showBackButton>
      <div className="p-4 space-y-6 pb-24">
        {/* Month selector */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth("prev")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h2 className="font-bold text-lg">
                  {MONTHS[selectedMonth - 1]} {selectedYear}
                </h2>
                {isCurrentMonth && (
                  <Badge variant="secondary" className="mt-1">
                    Mois en cours
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth("next")}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Objectifs form */}
        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Définir mes objectifs
            </CardTitle>
            <CardDescription>
              Personnalisez vos objectifs mensuels pour suivre votre progression
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Objectif CA */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-primary" />
                <Label htmlFor="objectif_ca" className="font-medium">
                  Objectif Chiffre d'Affaires
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="objectif_ca"
                  type="number"
                  value={objectifs.objectif_ca}
                  onChange={(e) =>
                    setObjectifs((o) => ({
                      ...o,
                      objectif_ca: Number(e.target.value),
                    }))
                  }
                  className="pl-8"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
              </div>
              {isCurrentMonth && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Réalisé: {formatCurrency(realise.ca)}
                  </span>
                  <Badge
                    variant={getProgress(realise.ca, objectifs.objectif_ca) >= 100 ? "default" : "secondary"}
                    className={getProgress(realise.ca, objectifs.objectif_ca) >= 100 ? "bg-green-500" : ""}
                  >
                    {Math.round(getProgress(realise.ca, objectifs.objectif_ca))}%
                  </Badge>
                </div>
              )}
            </div>

            {/* Objectif Ventes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <Label htmlFor="objectif_ventes" className="font-medium">
                  Objectif Nombre de Ventes
                </Label>
              </div>
              <Input
                id="objectif_ventes"
                type="number"
                value={objectifs.objectif_ventes}
                onChange={(e) =>
                  setObjectifs((o) => ({
                    ...o,
                    objectif_ventes: Number(e.target.value),
                  }))
                }
              />
              {isCurrentMonth && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Réalisé: {realise.ventes} ventes
                  </span>
                  <Badge
                    variant={getProgress(realise.ventes, objectifs.objectif_ventes) >= 100 ? "default" : "secondary"}
                    className={getProgress(realise.ventes, objectifs.objectif_ventes) >= 100 ? "bg-green-500" : ""}
                  >
                    {Math.round(getProgress(realise.ventes, objectifs.objectif_ventes))}%
                  </Badge>
                </div>
              )}
            </div>

            {/* Objectif RDV */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <Label htmlFor="objectif_rdv" className="font-medium">
                  Objectif Nombre de RDV
                </Label>
              </div>
              <Input
                id="objectif_rdv"
                type="number"
                value={objectifs.objectif_rdv}
                onChange={(e) =>
                  setObjectifs((o) => ({
                    ...o,
                    objectif_rdv: Number(e.target.value),
                  }))
                }
              />
              {isCurrentMonth && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Réalisé: {realise.rdv} RDV
                  </span>
                  <Badge
                    variant={getProgress(realise.rdv, objectifs.objectif_rdv) >= 100 ? "default" : "secondary"}
                    className={getProgress(realise.rdv, objectifs.objectif_rdv) >= 100 ? "bg-green-500" : ""}
                  >
                    {Math.round(getProgress(realise.rdv, objectifs.objectif_rdv))}%
                  </Badge>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Conseil</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Définissez des objectifs réalistes et ambitieux. Vous pouvez les ajuster à tout moment en fonction de votre activité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FloatingSaveButton
        show={hasChanges}
        saving={saving}
        onSave={handleSave}
      />
    </MobileLayout>
  );
};

export default ObjectifsSettings;
