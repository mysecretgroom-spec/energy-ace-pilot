import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Loader2, 
  Pencil, 
  Trash2, 
  Star, 
  Check,
  GripVertical,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const emptyPlan: Omit<SubscriptionPlan, "id" | "created_at"> = {
  name: "",
  description: "",
  price_monthly: 29,
  price_yearly: null,
  stripe_price_id_monthly: null,
  stripe_price_id_yearly: null,
  features: [],
  is_popular: false,
  is_active: true,
  sort_order: 0,
};

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    plan: Partial<SubscriptionPlan> | null;
  }>({ open: false, plan: null });
  const [featureInput, setFeatureInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_subscription_plans");
      if (error) throw error;
      return (data as SubscriptionPlan[]) || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan>) => {
      const { data, error } = await supabase.rpc("upsert_subscription_plan", {
        p_id: plan.id || null,
        p_name: plan.name || "",
        p_description: plan.description || "",
        p_price_monthly: plan.price_monthly || 29,
        p_price_yearly: plan.price_yearly || null,
        p_stripe_price_id_monthly: plan.stripe_price_id_monthly || null,
        p_stripe_price_id_yearly: plan.stripe_price_id_yearly || null,
        p_features: plan.features || [],
        p_is_popular: plan.is_popular || false,
        p_is_active: plan.is_active ?? true,
        p_sort_order: plan.sort_order || 0,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Offre enregistrée");
      setEditDialog({ open: false, plan: null });
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_subscription_plan", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offre supprimée");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const openCreateDialog = () => {
    setEditDialog({
      open: true,
      plan: { ...emptyPlan, sort_order: (plans?.length || 0) + 1 },
    });
    setFeatureInput("");
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditDialog({ open: true, plan: { ...plan } });
    setFeatureInput("");
  };

  const updatePlanField = <K extends keyof SubscriptionPlan>(
    field: K,
    value: SubscriptionPlan[K]
  ) => {
    setEditDialog((prev) => ({
      ...prev,
      plan: prev.plan ? { ...prev.plan, [field]: value } : null,
    }));
  };

  const addFeature = () => {
    if (!featureInput.trim() || !editDialog.plan) return;
    updatePlanField("features", [...(editDialog.plan.features || []), featureInput.trim()]);
    setFeatureInput("");
  };

  const removeFeature = (index: number) => {
    if (!editDialog.plan) return;
    const newFeatures = [...(editDialog.plan.features || [])];
    newFeatures.splice(index, 1);
    updatePlanField("features", newFeatures);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Offres d'Abonnement</h1>
            <p className="text-muted-foreground mt-1">Gérez vos plans tarifaires</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Offre
          </Button>
        </div>

        {/* Plans Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : plans?.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune offre configurée</p>
                <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                  Créer une offre
                </Button>
              </CardContent>
            </Card>
          ) : (
            plans?.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative ${plan.is_popular ? "border-primary shadow-lg" : ""} ${!plan.is_active ? "opacity-60" : ""}`}
              >
                {plan.is_popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Star className="h-3 w-3 mr-1" />
                    Populaire
                  </Badge>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription className="mt-1">{plan.description}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(plan.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-2">
                    <span className="text-3xl font-bold">{plan.price_monthly}€</span>
                    <span className="text-muted-foreground">/mois</span>
                    {plan.price_yearly && (
                      <p className="text-sm text-muted-foreground">
                        ou {plan.price_yearly}€/an
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {(plan.features || []).slice(0, 5).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {(plan.features || []).length > 5 && (
                      <li className="text-sm text-muted-foreground">
                        +{plan.features.length - 5} autres...
                      </li>
                    )}
                  </ul>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Ordre: {plan.sort_order}</span>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Plans Table */}
        {plans && plans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Configuration des Offres</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prix/mois</TableHead>
                    <TableHead>Prix/an</TableHead>
                    <TableHead>Stripe ID (mensuel)</TableHead>
                    <TableHead>Populaire</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{plan.price_monthly}€</TableCell>
                      <TableCell>{plan.price_yearly ? `${plan.price_yearly}€` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {plan.stripe_price_id_monthly || "—"}
                      </TableCell>
                      <TableCell>
                        {plan.is_popular && <Star className="h-4 w-4 text-yellow-500" />}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, plan: null })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.plan?.id ? "Modifier l'offre" : "Nouvelle offre"}</DialogTitle>
            <DialogDescription>Configurez les détails de l'offre d'abonnement</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de l'offre *</Label>
              <Input
                value={editDialog.plan?.name || ""}
                onChange={(e) => updatePlanField("name", e.target.value)}
                placeholder="Premium, Pro, Business..."
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDialog.plan?.description || ""}
                onChange={(e) => updatePlanField("description", e.target.value)}
                placeholder="Accès complet à toutes les fonctionnalités..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prix mensuel (€) *</Label>
                <Input
                  type="number"
                  value={editDialog.plan?.price_monthly || 0}
                  onChange={(e) => updatePlanField("price_monthly", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Prix annuel (€)</Label>
                <Input
                  type="number"
                  value={editDialog.plan?.price_yearly || ""}
                  onChange={(e) => updatePlanField("price_yearly", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stripe Price ID (mensuel)</Label>
                <Input
                  value={editDialog.plan?.stripe_price_id_monthly || ""}
                  onChange={(e) => updatePlanField("stripe_price_id_monthly", e.target.value || null)}
                  placeholder="price_xxx"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Stripe Price ID (annuel)</Label>
                <Input
                  value={editDialog.plan?.stripe_price_id_yearly || ""}
                  onChange={(e) => updatePlanField("stripe_price_id_yearly", e.target.value || null)}
                  placeholder="price_xxx"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fonctionnalités incluses</Label>
              <div className="flex gap-2">
                <Input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="Ajouter une fonctionnalité..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                />
                <Button type="button" onClick={addFeature} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-1 mt-2">
                {(editDialog.plan?.features || []).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="flex-1">{feature}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFeature(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editDialog.plan?.is_popular || false}
                  onCheckedChange={(checked) => updatePlanField("is_popular", checked)}
                />
                <Label>Offre populaire</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editDialog.plan?.is_active ?? true}
                  onCheckedChange={(checked) => updatePlanField("is_active", checked)}
                />
                <Label>Actif</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ordre d'affichage</Label>
              <Input
                type="number"
                value={editDialog.plan?.sort_order || 0}
                onChange={(e) => updatePlanField("sort_order", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, plan: null })}>
              Annuler
            </Button>
            <Button 
              onClick={() => editDialog.plan && saveMutation.mutate(editDialog.plan)}
              disabled={saveMutation.isPending || !editDialog.plan?.name}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette offre ?</DialogTitle>
            <DialogDescription>Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
