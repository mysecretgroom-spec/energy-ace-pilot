import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IdCard, Phone, ChevronDown, X, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

// Import logos
import logoFranceRenov from "@/assets/logos/france-renov.png";
import logoMinistere from "@/assets/logos/ministere-transition-energetique.svg";
import logoRgeEcoArtisan from "@/assets/logos/rge-eco-artisan.png";
import logoQualipac from "@/assets/logos/qualipac.png";
import logoQualipv from "@/assets/logos/qualipv.png";
import logoQualitenr from "@/assets/logos/qualitenr.png";

// France Rénov' annuaire URL - the site doesn't support URL-based pre-filling
// Users will need to click "Rechercher un professionnel" tab and enter the SIRET manually
const FRANCE_RENOV_URL = "https://france-renov.gouv.fr/annuaires-professionnels/artisan-rge-architecte";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  numero_agrement: string | null;
  telephone_pro: string | null;
  nom_scene: string | null;
  prenom_scene: string | null;
}

interface CompanyInfo {
  nom: string | null;
  siret: string | null;
}

export const RGECardDialog = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [siretSearchComplete, setSiretSearchComplete] = useState(false);
  const [siretCopied, setSiretCopied] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (user && open) {
      fetchProfile();
      fetchRegieWithSiret();
    }
    if (!open) {
      setDragDistance(0);
      setCompanyInfo(null);
      setSiretSearchComplete(false);
      setSiretCopied(false);
    }
  }, [user, open]);

  const fetchCompanySiret = async (companyName: string): Promise<CompanyInfo | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('search-siret', {
        body: { companyName },
      });

      if (error) {
        console.error('Error fetching SIRET:', error);
        return null;
      }

      if (data?.siret) {
        return {
          nom: data.nom || companyName,
          siret: data.siret,
        };
      }
      return null;
    } catch (err) {
      console.error('Error calling search-siret:', err);
      return null;
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url, numero_agrement, telephone_pro, nom_scene, prenom_scene")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const fetchRegieWithSiret = async () => {
    if (!user) return;
    
    const now = new Date();
    const nowIso = now.toISOString();

    const tryGetSiret = async (regie: { nom: string; siret: string | null }): Promise<CompanyInfo | null> => {
      if (regie.siret) {
        return { nom: regie.nom, siret: regie.siret };
      }
      return await fetchCompanySiret(regie.nom);
    };

    const { data: currentRdv } = await supabase
      .from("rdv")
      .select(`
        id,
        date_heure,
        duree_minutes,
        regie_id,
        regies:regie_id (nom, siret, is_hejja)
      `)
      .eq("user_id", user.id)
      .lte("date_heure", nowIso)
      .not("status", "in", '("annule","reporte")')
      .order("date_heure", { ascending: false })
      .limit(1)
      .maybeSingle();

    let foundSiret: CompanyInfo | null = null;

    if (currentRdv?.regies) {
      const rdvStart = new Date(currentRdv.date_heure);
      const rdvEnd = new Date(rdvStart.getTime() + (currentRdv.duree_minutes || 60) * 60 * 1000);
      
      if (now <= rdvEnd) {
        const regie = currentRdv.regies as { nom: string; siret: string | null; is_hejja: boolean };
        if (!regie.is_hejja) {
          foundSiret = await tryGetSiret(regie);
        }
      }
    }

    if (!foundSiret) {
      const { data: nextRdv } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          regie_id,
          regies:regie_id (nom, siret, is_hejja)
        `)
        .eq("user_id", user.id)
        .gte("date_heure", nowIso)
        .not("status", "in", '("annule","reporte")')
        .order("date_heure", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextRdv?.regies) {
        const regie = nextRdv.regies as { nom: string; siret: string | null; is_hejja: boolean };
        if (!regie.is_hejja) {
          foundSiret = await tryGetSiret(regie);
        }
      }
    }

    if (!foundSiret) {
      const { data: allRegies } = await (supabase as any)
        .from("regies")
        .select("id, nom, siret, is_hejja")
        .eq("user_id", user.id)
        .eq("active", true)
        .eq("is_hejja", false)
        .order("nom") as { data: Array<{ id: string; nom: string; siret: string | null; is_hejja: boolean }> | null };

      if (allRegies) {
        for (const regie of allRegies) {
          const siretInfo = await tryGetSiret(regie);
          if (siretInfo) {
            foundSiret = siretInfo;
            break;
          }
        }
      }
    }

    setCompanyInfo(foundSiret);
    setSiretSearchComplete(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = Math.abs(currentX - startPosRef.current.x);
    const diffY = Math.abs(currentY - startPosRef.current.y);
    // Use the maximum distance in any direction
    const distance = Math.max(diffX, diffY);
    setDragDistance(distance);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragDistance > 60) {
      setOpen(false);
    }
    setDragDistance(0);
  };

  const displayFirstName = profile?.prenom_scene || profile?.first_name;
  const displayLastName = profile?.nom_scene || profile?.last_name;
  const fullName = displayFirstName || displayLastName
    ? `${displayFirstName || ""} ${displayLastName || ""}`.trim()
    : null;

  const handleCopySiret = async () => {
    if (companyInfo?.siret) {
      try {
        await navigator.clipboard.writeText(companyInfo.siret);
        setSiretCopied(true);
        toast.success("SIRET copié !");
        setTimeout(() => setSiretCopied(false), 2000);
      } catch (err) {
        toast.error("Impossible de copier");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-12 w-12">
          <IdCard className="h-[30px] w-[30px]" />
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="w-full h-full max-w-none max-h-none m-0 p-0 overflow-hidden rounded-none border-none bg-black/60 backdrop-blur-sm flex items-center justify-center"
        style={isMobile ? { touchAction: 'none' } : undefined}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Carte RGE Professionnelle</DialogTitle>
        </DialogHeader>
        
        {/* Close button for desktop/tablet */}
        {!isMobile && (
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 rounded-full p-2 text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Swipe indicator - mobile only */}
        {isMobile && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/60 z-10 pointer-events-none">
            <ChevronDown className="h-6 w-6 animate-bounce" />
            <span className="text-xs">Glisser pour fermer</span>
          </div>
        )}

        {/* RGE Card - Fixed horizontal orientation on mobile, fills screen */}
        <div 
          className={`flex items-center justify-center transition-all ${
            isDragging ? 'duration-0' : 'duration-200'
          }`}
          style={{ 
            opacity: isMobile ? Math.max(0.3, 1 - dragDistance / 150) : 1,
            transform: isMobile 
              ? `rotate(90deg) scale(${Math.max(0.9, 1 - dragDistance / 500)})` 
              : undefined,
            width: isMobile ? '100vh' : '100%',
            height: isMobile ? '98vw' : '100%',
            maxWidth: isMobile ? undefined : '100%',
            padding: isMobile ? '0' : '2rem',
          }}
        >
          <div 
            className={`bg-gradient-to-br from-[#1a5276] to-[#2e86ab] text-white flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] border border-white/20 overflow-hidden select-none rounded-2xl sm:rounded-3xl ${
              isMobile ? 'w-full h-full max-h-full' : 'w-full max-w-5xl'
            }`}
            style={{ aspectRatio: isMobile ? undefined : '16/9' }}
          >
            {/* Header with Ministère and France Rénov logos */}
            <div className="bg-white flex items-center justify-between shrink-0 py-3 px-4 sm:py-4 sm:px-8 lg:py-8 lg:px-16 rounded-t-2xl sm:rounded-t-3xl">
              <img 
                src={logoMinistere} 
                alt="Ministère de la Transition Énergétique" 
                className="h-10 sm:h-14 lg:h-28 object-contain"
              />
              <img 
                src={logoFranceRenov} 
                alt="France Rénov'" 
                className="h-10 sm:h-14 lg:h-28 object-contain"
              />
            </div>

            {/* Title band */}
            <div className="bg-gradient-to-r from-[#27ae60] to-[#2ecc71] text-center shrink-0 shadow-sm py-1.5 px-4 sm:py-2 sm:px-6">
              <h3 className="font-bold tracking-widest uppercase drop-shadow-sm text-xs sm:text-sm lg:text-base">
                Carte Professionnelle RGE
              </h3>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center min-h-0 p-3 sm:p-4 lg:p-6">
              <div className="bg-white/15 backdrop-blur-md w-full h-full border border-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col rounded-xl sm:rounded-2xl">
                {/* Photo and info - responsive layout */}
                <div className="flex-1 flex flex-col sm:flex-row items-center justify-center min-h-0 gap-3 sm:gap-8 lg:gap-12 p-3 sm:p-6 lg:p-8">
                  {/* Photo */}
                  <div className="relative shrink-0">
                    <div className="border-2 border-white/50 shadow-lg rounded-lg overflow-hidden bg-white/20 ring-2 ring-white/20 ring-offset-1 ring-offset-transparent h-24 w-20 sm:h-40 sm:w-32 lg:h-52 lg:w-40">
                      {profile?.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Photo" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl sm:text-3xl lg:text-4xl">
                          ?
                        </div>
                      )}
                    </div>
                    {!profile?.avatar_url && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 px-1 rounded text-white whitespace-nowrap text-[7px] sm:text-[8px] lg:text-xs">
                        Photo manquante
                      </div>
                    )}
                  </div>

                  {/* Technician info + Agrément/QR on mobile */}
                  <div className="flex flex-row sm:contents items-start gap-4 w-full sm:w-auto">
                    {/* Technician info */}
                    <div className="text-center flex-1 min-w-0">
                      {fullName ? (
                        <h4 className="font-bold mb-0.5 truncate text-base sm:text-2xl lg:text-3xl">{fullName}</h4>
                      ) : (
                        <div className="mb-0.5">
                          <p className="text-white/50 italic text-sm sm:text-xl lg:text-2xl">Nom Prénom</p>
                          <p className="text-amber-400 text-[8px] sm:text-xs">À renseigner dans le profil</p>
                        </div>
                      )}
                      <p className="text-white/80 mb-0.5 sm:mb-1 text-xs sm:text-sm lg:text-base">Technicien agréé</p>
                      {siretSearchComplete && companyInfo && (
                        <div className="mb-0.5 sm:mb-1">
                          <p className="font-semibold text-white/90 truncate text-sm sm:text-base lg:text-lg">
                            {companyInfo.nom}
                          </p>
                          <button
                            onClick={handleCopySiret}
                            className="inline-flex items-center gap-1 font-mono text-white/70 hover:text-white transition-colors cursor-pointer active:scale-95 text-xs sm:text-sm"
                            title="Cliquer pour copier le SIRET"
                          >
                            SIRET: {companyInfo.siret}
                            {siretCopied ? (
                              <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                            ) : (
                              <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                            )}
                          </button>
                        </div>
                      )}
                      {profile?.telephone_pro ? (
                        <div className={`flex items-center justify-center gap-1.5 sm:gap-2 ${!companyInfo ? 'mt-0.5 sm:mt-1' : ''} text-sm sm:text-lg lg:text-xl`}>
                          <Phone className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                          <span className="font-medium">{profile.telephone_pro}</span>
                        </div>
                      ) : (
                        <div className={`flex items-center justify-center gap-1.5 sm:gap-2 ${!companyInfo ? 'mt-0.5 sm:mt-1' : ''} text-sm sm:text-base`}>
                          <Phone className="text-white/50 h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-white/50 italic text-xs sm:text-sm">Tél. pro manquant</span>
                        </div>
                      )}
                    </div>

                    {/* Agrément number + QR Code */}
                    <div className="shrink-0 flex flex-col items-center gap-2 sm:gap-2 w-24 sm:w-36 lg:w-44">
                      {/* Agrément number */}
                      <div className="bg-white/15 rounded-lg text-center w-full p-2 sm:p-3 lg:p-4">
                        <p className="text-white/70 uppercase tracking-wider mb-0.5 text-[8px] sm:text-xs">
                          N° d'Agrément
                        </p>
                        {profile?.numero_agrement ? (
                          <p className="font-mono font-bold leading-tight text-sm sm:text-xl lg:text-2xl">
                            {profile.numero_agrement}
                          </p>
                        ) : (
                          <p className="text-white/50 italic text-xs sm:text-sm">Non renseigné</p>
                        )}
                    </div>

                      {/* QR Code */}
                      <div className="text-center flex flex-col items-center gap-1 w-full">
                        <button
                          onClick={() => window.open(FRANCE_RENOV_URL, '_blank')}
                          className="bg-white rounded-lg hover:scale-105 transition-transform cursor-pointer shadow-md p-2 sm:p-3"
                          title="Vérifier sur France Rénov'"
                        >
                          <QRCodeSVG 
                            value={FRANCE_RENOV_URL} 
                            size={isMobile ? 45 : 70}
                            level="M"
                            includeMargin={false}
                          />
                        </button>
                        <p className="text-white/70 text-[8px] sm:text-xs">Vérifier sur France Rénov'</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Certifications band */}
                <div className="bg-white shrink-0 py-2 px-3 sm:py-3 sm:px-6 lg:py-4 lg:px-8 rounded-b-lg sm:rounded-b-xl">
                  <div className="flex items-center justify-center sm:justify-between gap-2">
                    <p className="text-gray-500 uppercase tracking-wider font-medium text-xs hidden sm:block">
                      Certifications
                    </p>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <img 
                        src={logoRgeEcoArtisan} 
                        alt="RGE Eco Artisan" 
                        className="h-6 sm:h-8 lg:h-10 object-contain"
                      />
                      <img 
                        src={logoQualipac} 
                        alt="QualiPAC" 
                        className="h-6 sm:h-8 lg:h-10 object-contain"
                      />
                      <img 
                        src={logoQualipv} 
                        alt="QualiPV" 
                        className="h-6 sm:h-8 lg:h-10 object-contain"
                      />
                      <img 
                        src={logoQualitenr} 
                        alt="QualiT'EnR" 
                        className="h-6 sm:h-8 lg:h-10 object-contain"
                      />
                    </div>
                    <p className="text-gray-500 font-medium text-xs lg:text-sm hidden sm:block">
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
