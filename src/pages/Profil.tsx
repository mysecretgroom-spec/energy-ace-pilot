import { useState, useEffect, useMemo, useRef } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { MFAProtectedContent } from "@/components/auth/MFAProtectedContent";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Phone, MapPin, Shield, IdCard, Briefcase, Camera } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  zone_geographique: string | null;
  avatar_url: string | null;
  created_at: string;
  numero_agrement: string | null;
  telephone_pro: string | null;
  nom_scene: string | null;
  prenom_scene: string | null;
}

const Profil = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mfaVerified, setMfaVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    zone_geographique: "",
    numero_agrement: "",
    telephone_pro: "",
    nom_scene: "",
    prenom_scene: "",
  });
  const [originalFormData, setOriginalFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    zone_geographique: "",
    numero_agrement: "",
    telephone_pro: "",
    nom_scene: "",
    prenom_scene: "",
  });

  const hasChanges = useMemo(() => {
    return (
      formData.first_name !== originalFormData.first_name ||
      formData.last_name !== originalFormData.last_name ||
      formData.phone !== originalFormData.phone ||
      formData.zone_geographique !== originalFormData.zone_geographique ||
      formData.numero_agrement !== originalFormData.numero_agrement ||
      formData.telephone_pro !== originalFormData.telephone_pro ||
      formData.nom_scene !== originalFormData.nom_scene ||
      formData.prenom_scene !== originalFormData.prenom_scene
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
          numero_agrement: data.numero_agrement || "",
          telephone_pro: data.telephone_pro || "",
          nom_scene: data.nom_scene || "",
          prenom_scene: data.prenom_scene || "",
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
          numero_agrement: formData.numero_agrement || null,
          telephone_pro: formData.telephone_pro || null,
          nom_scene: formData.nom_scene || null,
          prenom_scene: formData.prenom_scene || null,
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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      console.log("No file or user", { file: !!file, user: !!user });
      return;
    }

    console.log("Starting photo upload", { fileName: file.name, fileType: file.type, fileSize: file.size });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erreur",
        description: "L'image ne doit pas dépasser 5 Mo",
        variant: "destructive",
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      console.log("Uploading to path:", fileName);

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      console.log("Upload result:", { uploadData, uploadError });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log("Public URL:", urlData.publicUrl);

      // Update profile with new avatar URL - add cache buster
      const avatarUrlWithCacheBuster = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrlWithCacheBuster })
        .eq('user_id', user.id);

      console.log("Profile update result:", { updateError });

      if (updateError) {
        console.error("Profile update error:", updateError);
        throw updateError;
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrlWithCacheBuster } : null);

      toast({
        title: "Photo mise à jour",
        description: "Votre photo de profil a été enregistrée",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de télécharger la photo",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-hero text-primary-foreground text-2xl font-bold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              {formData.first_name || formData.last_name
                ? `${formData.first_name} ${formData.last_name}`.trim()
                : "Nouveau Utilisateur"}
            </h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Appuyez sur l'icône caméra pour changer la photo
            </p>
          </div>
        </div>

        {/* Form - Protected by MFA for modifications */}
        <MFAProtectedContent
          requireExplicitAction={!mfaVerified}
          actionButtonText="Modifier le profil"
          title="Modification du profil"
          description="Pour modifier vos informations personnelles, veuillez vérifier votre identité."
          onVerified={() => setMfaVerified(true)}
          placeholder={
            <Card className="shadow-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Informations personnelles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input value={formData.first_name || "—"} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input value={formData.last_name || "—"} disabled className="bg-muted" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    Email
                  </Label>
                  <Input value={user?.email || ""} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    Téléphone personnel
                  </Label>
                  <Input value={formData.phone || "—"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="h-3 w-3" />
                    Téléphone professionnel
                  </Label>
                  <Input value={formData.telephone_pro || "—"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    Zone géographique
                  </Label>
                  <Input value={formData.zone_geographique || "—"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IdCard className="h-3 w-3" />
                    N° Agrément RGE
                  </Label>
                  <Input value={formData.numero_agrement || "—"} disabled className="bg-muted" />
                </div>
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Cliquez sur "Modifier le profil" pour éditer vos informations
                </p>
              </CardContent>
            </Card>
          }
        >
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

            {/* Stage name section */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <IdCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Nom de scène</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Utilisés uniquement dans les études et sur la carte RGE. L'agent IA utilisera votre vrai nom.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom_scene">Prénom de scène</Label>
                  <Input
                    id="prenom_scene"
                    value={formData.prenom_scene}
                    onChange={(e) =>
                      setFormData({ ...formData, prenom_scene: e.target.value })
                    }
                    placeholder="Ex: Jean-Pierre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom_scene">Nom de scène</Label>
                  <Input
                    id="nom_scene"
                    value={formData.nom_scene}
                    onChange={(e) =>
                      setFormData({ ...formData, nom_scene: e.target.value })
                    }
                    placeholder="Ex: Martin"
                  />
                </div>
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
                Téléphone personnel
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
              <p className="text-xs text-muted-foreground">
                Utilisé pour contacter l'agent WhatsApp
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone_pro" className="flex items-center gap-2">
                <Briefcase className="h-3 w-3" />
                Téléphone professionnel
              </Label>
              <Input
                id="telephone_pro"
                type="tel"
                value={formData.telephone_pro}
                onChange={(e) =>
                  setFormData({ ...formData, telephone_pro: e.target.value })
                }
                placeholder="01 23 45 67 89"
              />
              <p className="text-xs text-muted-foreground">
                Affiché sur la carte RGE
              </p>
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

            <div className="space-y-2">
              <Label htmlFor="numero_agrement" className="flex items-center gap-2">
                <IdCard className="h-3 w-3" />
                N° Agrément RGE
              </Label>
              <Input
                id="numero_agrement"
                value={formData.numero_agrement}
                onChange={(e) =>
                  setFormData({ ...formData, numero_agrement: e.target.value })
                }
                placeholder="RGE-XXXXX-XXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Affiché sur la carte RGE professionnelle
              </p>
            </div>
          </CardContent>
        </Card>
        </MFAProtectedContent>

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
