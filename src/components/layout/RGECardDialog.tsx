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
  nom_scene: string | null;
  prenom_scene: string | null;
}

interface CompanyInfo {
  nom: string | null;
  siret: string | null;
}

export const RGECardDialog = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [siretSearchComplete, setSiretSearchComplete] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (user && open) {
      fetchProfile();
      fetchRegieWithSiret();
    }
    if (!open) {
      setDragY(0);
      setCompanyInfo(null);
      setSiretSearchComplete(false);
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

    // Helper function to try to get SIRET from a regie
    const tryGetSiret = async (regie: { nom: string; siret: string | null }): Promise<CompanyInfo | null> => {
      if (regie.siret) {
        return { nom: regie.nom, siret: regie.siret };
      }
      // Try API search
      return await fetchCompanySiret(regie.nom);
    };

    // First, try to find current RDV (date_heure <= now, ordered by most recent)
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

    // If no SIRET found from current RDV, try next RDV
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

    // If still no SIRET, search through all non-HEJJA regies
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

  // Use stage name if available, otherwise fallback to real name
  const displayFirstName = profile?.prenom_scene || profile?.first_name;
  const displayLastName = profile?.nom_scene || profile?.last_name;
  const fullName = displayFirstName || displayLastName
    ? `${displayFirstName || ""} ${displayLastName || ""}`.trim()
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
          className="origin-center w-[100vh] h-[100vw] flex items-center justify-center p-2 transition-transform duration-200"
          style={{ 
            transform: `rotate(90deg) translateX(${dragY}px)`,
            opacity: Math.max(0.3, 1 - dragY / 300)
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bg-gradient-to-br from-[#1a5276] to-[#2e86ab] text-white w-full h-full flex flex-col rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] border border-white/20 overflow-hidden">
            {/* Header with Ministère and France Rénov logos */}
            <div className="bg-white py-4 px-6 flex items-center justify-between rounded-t-2xl shrink-0">
              <img 
                src={logoMinistere} 
                alt="Ministère de la Transition Énergétique" 
                className="h-16 object-contain"
              />
              <img 
                src={logoFranceRenov} 
                alt="France Rénov'" 
                className="h-16 object-contain"
              />
            </div>

            {/* Title band */}
            <div className="bg-gradient-to-r from-[#27ae60] to-[#2ecc71] py-1.5 px-4 text-center shrink-0 shadow-sm">
              <h3 className="text-xs font-bold tracking-widest uppercase drop-shadow-sm">
                Carte Professionnelle RGE
              </h3>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center p-3 min-h-0">
              <div className="bg-white/15 backdrop-blur-md rounded-xl w-full h-full border border-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
                {/* Photo and info - responsive layout */}
                <div className="flex-1 flex items-center justify-center gap-4 p-4 min-h-0">
                  {/* Photo */}
                  <div className="relative shrink-0">
                    <div className="h-32 w-24 border-2 border-white/50 shadow-lg rounded-lg overflow-hidden bg-white/20 ring-2 ring-white/20 ring-offset-1 ring-offset-transparent">
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
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-[6px] px-1 rounded text-white whitespace-nowrap">
                        Photo manquante
                      </div>
                    )}
                  </div>

                  {/* Technician info */}
                  <div className="text-center flex-1 min-w-0">
                    {fullName ? (
                      <h4 className="text-lg font-bold mb-0.5 truncate">{fullName}</h4>
                    ) : (
                      <div className="mb-0.5">
                        <p className="text-base text-white/50 italic">Nom Prénom</p>
                        <p className="text-[8px] text-amber-400">À renseigner dans le profil</p>
                      </div>
                    )}
                    <p className="text-white/80 text-xs mb-1">Technicien agréé</p>
                    {siretSearchComplete && companyInfo && (
                      <div className="mb-1">
                        <p className="text-sm font-semibold text-white/90 truncate">
                          {companyInfo.nom}
                        </p>
                        <p className="text-xs text-white/70 font-mono">
                          SIRET: {companyInfo.siret}
                        </p>
                      </div>
                    )}
                    {profile?.telephone_pro ? (
                      <div className={`flex items-center justify-center gap-2 text-sm ${!companyInfo ? 'mt-1' : ''}`}>
                        <Phone className="h-4 w-4" />
                        <span className="font-medium">{profile.telephone_pro}</span>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center gap-2 text-sm ${!companyInfo ? 'mt-1' : ''}`}>
                        <Phone className="h-4 w-4 text-white/50" />
                        <span className="text-white/50 italic text-xs">Tél. pro manquant</span>
                      </div>
                    )}
                  </div>

                  {/* Agrément number + QR Code */}
                  <div className="shrink-0 flex flex-col items-center gap-2 w-28">
                    {/* Agrément number */}
                    <div className="bg-white/15 rounded-lg p-2 text-center w-full">
                      <p className="text-[8px] text-white/70 uppercase tracking-wider mb-0.5">
                        N° d'Agrément
                      </p>
                      {profile?.numero_agrement ? (
                        <p className="text-base font-mono font-bold leading-tight">
                          {profile.numero_agrement}
                        </p>
                      ) : (
                        <p className="text-xs text-white/50 italic">Non renseigné</p>
                      )}
                    </div>

                    {/* QR Code */}
                    <div className="text-center flex flex-col items-center gap-1 w-full">
                      <button
                        onClick={() => window.open(FRANCE_RENOV_URL, '_blank')}
                        className="bg-white p-2 rounded-lg hover:scale-105 transition-transform cursor-pointer shadow-md"
                        title="Vérifier sur France Rénov'"
                      >
                        <QRCodeSVG 
                          value={FRANCE_RENOV_URL} 
                          size={50}
                          level="M"
                          includeMargin={false}
                        />
                      </button>
                      <p className="text-[7px] text-white/70">Vérifier sur France Rénov'</p>
                    </div>
                  </div>
                </div>

                {/* Certifications band */}
                <div className="bg-white py-2 px-4 rounded-b-lg shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider font-medium">
                      Certifications
                    </p>
                    <div className="flex items-center gap-2">
                      <img 
                        src={logoRgeEcoArtisan} 
                        alt="RGE Eco Artisan" 
                        className="h-6 object-contain"
                      />
                      <img 
                        src={logoQualipac} 
                        alt="QualiPAC" 
                        className="h-6 object-contain"
                      />
                      <img 
                        src={logoQualipv} 
                        alt="QualiPV" 
                        className="h-6 object-contain"
                      />
                      <img 
                        src={logoQualitenr} 
                        alt="QualiT'EnR" 
                        className="h-6 object-contain"
                      />
                    </div>
                    <p className="text-[8px] text-gray-500 font-medium">
                      RGE
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
