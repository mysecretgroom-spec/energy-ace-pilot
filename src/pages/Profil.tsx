import { useState, useEffect, useMemo } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Phone, MapPin } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  zone_geographique: string | null;
  avatar_url: string | null;
  created_at: string;
}

const Profil = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    zone_geographique: "",
  });
  const [originalFormData, setOriginalFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    zone_geographique: "",
  });

  const hasChanges = useMemo(() => {
    return (
      formData.first_name !== originalFormData.first_name ||
      formData.last_name !== originalFormData.last_name ||
      formData.phone !== originalFormData.phone ||
      formData.zone_geographique !== originalFormData.zone_geographique
    );
  }, [formData, originalFormData]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile(data);
        const newFormData = {
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
          zone_geographique: data.zone_geographique || "",
        };
        setFormData(newFormData);
        setOriginalFormData(newFormData);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le profil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone: formData.phone || null,
          zone_geographique: formData.zone_geographique || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées",
      });
      
      // Update original values to reset dirty state
      setOriginalFormData({ ...formData });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    const first = formData.first_name?.[0] || "";
    const last = formData.last_name?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  if (loading) {
    return (
      <MobileLayout title="Mon Profil" showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Mon Profil" showBackButton>
      <div className="p-4 space-y-6 pb-24">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4">
          <Avatar className="h-24 w-24 border-4 border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-hero text-primary-foreground text-2xl font-bold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              {formData.first_name || formData.last_name
                ? `${formData.first_name} ${formData.last_name}`.trim()
                : "Nouveau Utilisateur"}
            </h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Form */}
        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  placeholder="Durand"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                Téléphone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="zone_geographique"
                className="flex items-center gap-2"
              >
                <MapPin className="h-3 w-3" />
                Zone géographique
              </Label>
              <Input
                id="zone_geographique"
                value={formData.zone_geographique}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    zone_geographique: e.target.value,
                  })
                }
                placeholder="Rhône-Alpes"
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center">
              Compte créé le{" "}
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("fr-FR")
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Floating save button */}
      <FloatingSaveButton
        show={hasChanges}
        saving={saving}
        onSave={handleSubmit}
      />
    </MobileLayout>
  );
};

export default Profil;
