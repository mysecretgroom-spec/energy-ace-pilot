import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Phone, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProfileConfigStepProps {
  onComplete: () => void;
}

export function ProfileConfigStep({ onComplete }: ProfileConfigStepProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setFormData({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!formData.first_name.trim() || !formData.phone.trim()) {
      toast.error("Prénom et téléphone sont requis");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim() || null,
          phone: formData.phone.trim(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Silent save
      onComplete();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first_name" className="text-xs">
            Prénom *
          </Label>
          <Input
            id="first_name"
            placeholder="Jean"
            value={formData.first_name}
            onChange={(e) => setFormData((s) => ({ ...s, first_name: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name" className="text-xs">
            Nom
          </Label>
          <Input
            id="last_name"
            placeholder="Durand"
            value={formData.last_name}
            onChange={(e) => setFormData((s) => ({ ...s, last_name: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-xs flex items-center gap-1.5">
          <Phone className="h-3 w-3" />
          Téléphone *
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="06 12 34 56 78"
          value={formData.phone}
          onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
          className="h-9 text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Utilisé pour l'agent WhatsApp et les notifications
        </p>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || !formData.first_name.trim() || !formData.phone.trim()}
        className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Enregistrer et continuer
      </Button>
    </div>
  );
}
