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
import { Plus, Trash2, Mail, Loader2 } from "lucide-react";

interface EmailAutorise {
  id: string;
  email: string;
  nom_source: string | null;
  actif: boolean;
}

const EmailsAutorises = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailAutorise[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newNomSource, setNewNomSource] = useState("");
  const [adding, setAdding] = useState(false);

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
      setEmails(data || []);
    } catch (error) {
      console.error("Erreur chargement emails:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !newEmail.trim()) return;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error("Format d'email invalide");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from("emails_autorises").insert({
        user_id: user.id,
        email: newEmail.trim().toLowerCase(),
        nom_source: newNomSource.trim() || null,
        actif: true,
      });

      if (error) throw error;
      
      toast.success("Email ajouté");
      setNewEmail("");
      setNewNomSource("");
      fetchEmails();
    } catch (error: any) {
      console.error("Erreur ajout email:", error);
      if (error.code === "23505") {
        toast.error("Cet email existe déjà");
      } else {
        toast.error("Erreur lors de l'ajout");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, actif: boolean) => {
    try {
      const { error } = await supabase
        .from("emails_autorises")
        .update({ actif: !actif })
        .eq("id", id);

      if (error) throw error;
      
      setEmails(prev => prev.map(e => e.id === id ? { ...e, actif: !actif } : e));
    } catch (error) {
      console.error("Erreur toggle:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("emails_autorises")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setEmails(prev => prev.filter(e => e.id !== id));
      toast.success("Email supprimé");
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <MobileLayout title="Emails autorisés" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Seuls les emails de ces expéditeurs pourront créer des RDV via l'import email.
            </p>
          </CardContent>
        </Card>

        {/* Ajouter un email */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ajouter un expéditeur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="email@exemple.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="email"
            />
            <Input
              placeholder="Nom source (optionnel)"
              value={newNomSource}
              onChange={(e) => setNewNomSource(e.target.value)}
            />
            <Button 
              className="w-full" 
              onClick={handleAdd}
              disabled={!newEmail.trim() || adding}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Ajouter
            </Button>
          </CardContent>
        </Card>

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
                  <div key={email.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{email.email}</p>
                      {email.nom_source && (
                        <p className="text-xs text-muted-foreground">{email.nom_source}</p>
                      )}
                    </div>
                    <Switch
                      checked={email.actif}
                      onCheckedChange={() => handleToggle(email.id, email.actif)}
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default EmailsAutorises;
