import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Loader2, Save, RotateCcw } from "lucide-react";

interface EmailAutorise {
  id: string;
  email: string;
  nom_source: string | null;
  actif: boolean;
  isNew?: boolean;
  isModified?: boolean;
}

const EmailsAutorises = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailAutorise[]>([]);
  const [originalEmails, setOriginalEmails] = useState<EmailAutorise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user) fetchEmails();
  }, [user]);

  const fetchEmails = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("emails_autorises")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
      }));
      setEmails(formattedData);
      setOriginalEmails(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement emails:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: EmailAutorise = {
      id: `new-${Date.now()}`,
      email: "",
      nom_source: null,
      actif: true,
      isNew: true,
      isModified: true,
    };
    setEmails([newItem, ...emails]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof EmailAutorise, value: any) => {
    setEmails(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value, isModified: true };
      }
      return item;
    }));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Supprimer cet email ?")) return;
    setEmails(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setEmails(JSON.parse(JSON.stringify(originalEmails)));
    setHasChanges(false);
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate
    const invalidItems = emails.filter(item => !item.email);
    if (invalidItems.length > 0) {
      toast.error("L'email est obligatoire");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(item => !emailRegex.test(item.email.trim()));
    if (invalidEmails.length > 0) {
      toast.error("Format d'email invalide");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(emails.filter(d => !d.isNew).map(d => d.id));
      const toDelete = originalEmails.filter(o => !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("emails_autorises").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of emails) {
        const payload = {
          user_id: user.id,
          email: item.email.trim().toLowerCase(),
          nom_source: item.nom_source?.trim() || null,
          actif: item.actif,
        };

        if (item.isNew) {
          const { error } = await supabase.from("emails_autorises").insert(payload);
          if (error) {
            if (error.code === "23505") {
              toast.error(`L'email ${item.email} existe déjà`);
              return;
            }
            throw error;
          }
        } else if (item.isModified) {
          const { error } = await supabase.from("emails_autorises").update(payload).eq("id", item.id);
          if (error) throw error;
        }
      }

      toast.success("Modifications enregistrées");
      fetchEmails();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Emails autorisés" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Modifiez directement les emails puis cliquez sur "Enregistrer".
            </p>
          </CardContent>
        </Card>

        {/* Ajouter un email */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un expéditeur
        </Button>

        {/* Liste des emails */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Expéditeurs autorisés</span>
              <Badge variant="secondary">{emails.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : emails.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun email configuré</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {emails.map((email) => (
                  <div key={email.id} className={`p-4 space-y-2 ${email.isModified ? "bg-amber-500/5" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        value={email.email}
                        onChange={(e) => handleFieldChange(email.id, "email", e.target.value)}
                        className="h-8 flex-1 text-sm"
                        placeholder="email@exemple.com"
                      />
                      {email.isNew && <Badge className="bg-green-500 text-xs">Nouveau</Badge>}
                      {email.isModified && !email.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Modifié</Badge>}
                      <Switch
                        checked={email.actif}
                        onCheckedChange={(c) => handleFieldChange(email.id, "actif", c)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(email.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={email.nom_source || ""}
                      onChange={(e) => handleFieldChange(email.id, "nom_source", e.target.value || null)}
                      className="h-8 text-xs"
                      placeholder="Nom source (optionnel)"
                    />
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

export default EmailsAutorises;
