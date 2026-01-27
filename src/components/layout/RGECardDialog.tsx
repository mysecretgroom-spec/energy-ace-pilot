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

  const fullName = profile?.first_name || profile?.last_name
    ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <IdCard className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full h-full max-w-none max-h-none m-0 p-0 overflow-hidden rounded-none border-none bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <DialogHeader className="sr-only">
          <DialogTitle>Carte RGE Professionnelle</DialogTitle>
        </DialogHeader>
        
        {/* RGE Card - Floating business card style */}
        <div className="origin-center rotate-90 w-[100vh] h-[100vw] max-w-[100vh] max-h-[100vw] flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-[#1a5276] to-[#2e86ab] text-white w-full h-full flex flex-col rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] border border-white/20 overflow-hidden">
            {/* Header with Ministère and France Rénov logos */}
            <div className="bg-white py-5 px-8 flex items-center justify-center gap-16 rounded-t-3xl">
              <img 
                src={logoMinistere} 
                alt="Ministère de la Transition Énergétique" 
                className="h-20 object-contain"
              />
              <img 
                src={logoFranceRenov} 
                alt="France Rénov'" 
                className="h-20 object-contain"
              />
            </div>

            {/* Title band */}
            <div className="bg-gradient-to-r from-[#27ae60] to-[#2ecc71] py-2.5 px-6 text-center shrink-0 shadow-sm">
              <h3 className="text-base font-bold tracking-widest uppercase drop-shadow-sm">
                Carte Professionnelle RGE
              </h3>
            </div>

            {/* Main content - floating inner card */}
            <div className="flex-1 flex items-center justify-center p-5">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 w-full max-w-2xl border border-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(0,0,0,0.3)]">
                {/* Photo and info */}
                <div className="flex gap-5 items-center">
                  <div className="relative shrink-0">
                    <div className="h-24 w-[4.5rem] border-2 border-white/50 shadow-lg rounded-lg overflow-hidden bg-white/20 ring-2 ring-white/20 ring-offset-2 ring-offset-transparent">
                      {profile?.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Photo" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                          ?
                        </div>
                      )}
                    </div>
                    {!profile?.avatar_url && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-[8px] px-1 rounded text-white whitespace-nowrap">
                        Photo manquante
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    {fullName ? (
                      <h4 className="text-2xl font-bold mb-1">{fullName}</h4>
                    ) : (
                      <div className="mb-1">
                        <p className="text-lg text-white/50 italic">Nom Prénom</p>
                        <p className="text-[10px] text-amber-400">À renseigner dans le profil</p>
                      </div>
                    )}
                    <p className="text-white/80 text-sm mb-2">Technicien agréé</p>
                    {profile?.telephone_pro ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4" />
                        <span>{profile.telephone_pro}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-white/50" />
                        <span className="text-white/50 italic">Tél. pro manquant</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Agrément number */}
                  <div className="bg-white/15 rounded-lg p-3 shrink-0 text-center">
                    <p className="text-[10px] text-white/70 uppercase tracking-wider mb-1">
                      N° d'Agrément
                    </p>
                    {profile?.numero_agrement ? (
                      <p className="text-lg font-mono font-bold">
                        {profile.numero_agrement}
                      </p>
                    ) : (
                      <p className="text-sm text-white/50 italic">Non renseigné</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with certifications */}
            <div className="bg-white py-4 px-6 shrink-0 rounded-b-3xl">
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">
                  Certifications
                </p>
                <div className="flex items-center gap-4">
                  <img 
                    src={logoRgeEcoArtisan} 
                    alt="RGE Eco Artisan" 
                    className="h-10 object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                  <img 
                    src={logoQualipac} 
                    alt="QualiPAC" 
                    className="h-10 object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                  <img 
                    src={logoQualipv} 
                    alt="QualiPV" 
                    className="h-10 object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                  <img 
                    src={logoQualitenr} 
                    alt="QualiT'EnR" 
                    className="h-10 object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                </div>
                <p className="text-[9px] text-gray-500 font-medium">
                  Reconnu Garant de l'Environnement
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
