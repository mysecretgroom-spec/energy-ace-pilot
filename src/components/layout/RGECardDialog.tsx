import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IdCard, Phone, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

// Import logos
import logoFranceRenov from "@/assets/logos/france-renov.png";
import logoMinistere from "@/assets/logos/ministere-transition-energetique.svg";
import logoRgeEcoArtisan from "@/assets/logos/rge-eco-artisan.png";
import logoQualipac from "@/assets/logos/qualipac.png";
import logoQualipv from "@/assets/logos/qualipv.png";
import logoQualitenr from "@/assets/logos/qualitenr.png";

const FRANCE_RENOV_URL = "https://france-renov.gouv.fr/annuaires-professionnels/artisan-rge-architecte#/tab";

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
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (user && open) {
      fetchProfile();
    }
    if (!open) {
      setDragY(0);
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

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    // Only allow dragging down
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // If dragged more than 100px, close the dialog
    if (dragY > 100) {
      setOpen(false);
    }
    setDragY(0);
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
      <DialogContent className="w-full h-full max-w-none max-h-none m-0 p-0 overflow-hidden rounded-none border-none bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <DialogHeader className="sr-only">
          <DialogTitle>Carte RGE Professionnelle</DialogTitle>
        </DialogHeader>
        
        {/* Swipe indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/60 z-10">
          <ChevronDown className="h-6 w-6 animate-bounce" />
          <span className="text-xs">Glisser pour fermer</span>
        </div>

        {/* RGE Card - Floating business card style with drag gesture */}
        <div 
          className="origin-center rotate-90 w-[100vh] h-[100vw] max-w-[100vh] max-h-[100vw] flex items-center justify-center p-4 transition-transform duration-200"
          style={{ 
            transform: `rotate(90deg) translateX(${dragY}px)`,
            opacity: Math.max(0.3, 1 - dragY / 300)
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bg-gradient-to-br from-[#1a5276] to-[#2e86ab] text-white w-full h-full flex flex-col rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] border border-white/20 overflow-hidden">
            {/* Header with Ministère and France Rénov logos - larger and more spaced */}
            <div className="bg-white py-6 px-12 flex items-center justify-between rounded-t-3xl">
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
            <div className="bg-gradient-to-r from-[#27ae60] to-[#2ecc71] py-2 px-6 text-center shrink-0 shadow-sm">
              <h3 className="text-sm font-bold tracking-widest uppercase drop-shadow-sm">
                Carte Professionnelle RGE
              </h3>
            </div>

            {/* Main content - larger floating inner card */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl w-full max-w-4xl h-full max-h-[70%] border border-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
                {/* Photo and info - centered layout */}
                <div className="flex-1 flex items-center justify-center gap-10 p-10">
                  {/* Photo - height matches the two stacked elements */}
                  <div className="relative shrink-0">
                    <div className="h-52 w-36 border-2 border-white/50 shadow-lg rounded-lg overflow-hidden bg-white/20 ring-2 ring-white/20 ring-offset-2 ring-offset-transparent">
                      {profile?.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Photo" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
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

                  {/* Technician info - centered */}
                  <div className="text-center">
                    {fullName ? (
                      <h4 className="text-3xl font-bold mb-2">{fullName}</h4>
                    ) : (
                      <div className="mb-2">
                        <p className="text-xl text-white/50 italic">Nom Prénom</p>
                        <p className="text-[10px] text-amber-400">À renseigner dans le profil</p>
                      </div>
                    )}
                    <p className="text-white/80 text-base mb-3">Technicien agréé</p>
                    {profile?.telephone_pro ? (
                      <div className="flex items-center justify-center gap-2 text-base">
                        <Phone className="h-5 w-5" />
                        <span>{profile.telephone_pro}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-base">
                        <Phone className="h-5 w-5 text-white/50" />
                        <span className="text-white/50 italic">Tél. pro manquant</span>
                      </div>
                    )}
                  </div>

                  {/* Agrément number + QR Code stacked vertically */}
                  <div className="shrink-0 flex flex-col items-center gap-4 w-40">
                    {/* Agrément number */}
                    <div className="bg-white/15 rounded-lg p-5 text-center w-full">
                      <p className="text-[10px] text-white/70 uppercase tracking-wider mb-1">
                        N° d'Agrément
                      </p>
                      {profile?.numero_agrement ? (
                        <p className="text-2xl font-mono font-bold">
                          {profile.numero_agrement}
                        </p>
                      ) : (
                        <p className="text-sm text-white/50 italic">Non renseigné</p>
                      )}
                    </div>

                    {/* QR Code - same width */}
                    <div className="text-center flex flex-col items-center gap-2 w-full">
                      <button
                        onClick={() => window.open(FRANCE_RENOV_URL, '_blank')}
                        className="bg-white p-3 rounded-lg hover:scale-105 transition-transform cursor-pointer shadow-md w-full flex justify-center"
                        title="Vérifier sur France Rénov'"
                      >
                        <QRCodeSVG 
                          value={FRANCE_RENOV_URL} 
                          size={70}
                          level="M"
                          includeMargin={false}
                        />
                      </button>
                      <p className="text-[9px] text-white/70">Vérifier sur France Rénov'</p>
                    </div>
                  </div>
                </div>

                {/* Certifications band inside the central card */}
                <div className="bg-white py-4 px-6 rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      Certifications
                    </p>
                    <div className="flex items-center gap-6">
                      <img 
                        src={logoRgeEcoArtisan} 
                        alt="RGE Eco Artisan" 
                        className="h-12 object-contain"
                      />
                      <img 
                        src={logoQualipac} 
                        alt="QualiPAC" 
                        className="h-12 object-contain"
                      />
                      <img 
                        src={logoQualipv} 
                        alt="QualiPV" 
                        className="h-12 object-contain"
                      />
                      <img 
                        src={logoQualitenr} 
                        alt="QualiT'EnR" 
                        className="h-12 object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Reconnu Garant de l'Environnement
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
