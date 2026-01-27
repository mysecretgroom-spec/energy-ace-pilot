import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IdCard, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Import logos
import logoFranceRenov from "@/assets/logos/france-renov.png";
import logoMinistere from "@/assets/logos/ministere-transition-energetique.svg";
import logoRgeEcoArtisan from "@/assets/logos/rge-eco-artisan.png";
import logoQualipac from "@/assets/logos/qualipac.png";
import logoQualipv from "@/assets/logos/qualipv.png";
import logoQualitenr from "@/assets/logos/qualitenr.png";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  numero_agrement: string | null;
  telephone_pro: string | null;
}

export const RGECardDialog = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchProfile();
    }
  }, [user, open]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url, numero_agrement, telephone_pro")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const getInitials = () => {
    const first = profile?.first_name?.[0] || "";
    const last = profile?.last_name?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  const fullName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : "Commercial";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <IdCard className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full h-full max-w-none max-h-none m-0 p-0 overflow-hidden rounded-none border-none flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Carte RGE Professionnelle</DialogTitle>
        </DialogHeader>
        
        {/* RGE Card - Official Format */}
        <div className="bg-gradient-to-br from-[#1a5276] to-[#2e86ab] text-white">
          {/* Header with Ministère logo */}
          <div className="bg-white p-3 flex items-center justify-between">
            <img 
              src={logoMinistere} 
              alt="Ministère de la Transition Énergétique" 
              className="h-10 object-contain"
            />
            <img 
              src={logoFranceRenov} 
              alt="France Rénov'" 
              className="h-10 object-contain"
            />
          </div>

          {/* Title band */}
          <div className="bg-[#27ae60] py-2 px-4 text-center">
            <h3 className="text-lg font-bold tracking-wide uppercase">
              Carte Professionnelle RGE
            </h3>
          </div>

          {/* Main content */}
          <div className="p-5">
            {/* Photo and info */}
            <div className="flex gap-4 items-start mb-5">
              <Avatar className="h-24 w-24 border-4 border-white/30 shadow-lg">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="text-xl font-bold mb-1">{fullName}</h4>
                <p className="text-white/80 text-sm mb-2">Commercial Énergie</p>
                {profile?.telephone_pro && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    <span>{profile.telephone_pro}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Agrément number */}
            {profile?.numero_agrement && (
              <div className="bg-white/10 rounded-lg p-3 mb-4">
                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">
                  N° d'Agrément
                </p>
                <p className="text-lg font-mono font-bold">
                  {profile.numero_agrement}
                </p>
              </div>
            )}

            {/* Certifications logos */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 text-center">
                Certifications
              </p>
              <div className="grid grid-cols-4 gap-2 items-center justify-items-center">
                <img 
                  src={logoRgeEcoArtisan} 
                  alt="RGE Eco Artisan" 
                  className="h-10 object-contain"
                />
                <img 
                  src={logoQualipac} 
                  alt="QualiPAC" 
                  className="h-10 object-contain"
                />
                <img 
                  src={logoQualipv} 
                  alt="QualiPV" 
                  className="h-10 object-contain"
                />
                <img 
                  src={logoQualitenr} 
                  alt="QualiT'EnR" 
                  className="h-10 object-contain"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-[#1a5276] py-2 px-4 text-center">
            <p className="text-xs text-white/70">
              Reconnu Garant de l'Environnement
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
