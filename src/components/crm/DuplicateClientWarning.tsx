import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface DuplicateClient {
  id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
}

interface DuplicateClientWarningProps {
  nom: string;
  prenom?: string | null;
  telephone?: string | null;
  excludeClientId?: string;
  onSelectExisting?: (client: DuplicateClient) => void;
}

export function DuplicateClientWarning({ nom, prenom, telephone, excludeClientId, onSelectExisting }: DuplicateClientWarningProps) {
  const { user } = useAuth();
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);

  useEffect(() => {
    if (!user || !nom || nom.trim().length < 2) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      const conditions: string[] = [];
      
      // Search by name similarity
      const nomLower = nom.trim().toLowerCase();
      
      let query = supabase
        .from("clients")
        .select("id, nom, prenom, telephone, adresse, ville")
        .eq("user_id", user.id)
        .ilike("nom", `%${nomLower}%`)
        .limit(5);
      
      if (excludeClientId) {
        query = query.neq("id", excludeClientId);
      }

      const { data: nameMatches } = await query;
      
      let phoneMatches: DuplicateClient[] = [];
      
      // Also search by phone if provided
      if (telephone && telephone.replace(/\D/g, "").length >= 8) {
        const cleanPhone = telephone.replace(/\D/g, "");
        const { data } = await supabase
          .from("clients")
          .select("id, nom, prenom, telephone, adresse, ville")
          .eq("user_id", user.id)
          .limit(5);
        
        phoneMatches = (data || []).filter(c => {
          if (excludeClientId && c.id === excludeClientId) return false;
          const cPhone = (c.telephone || "").replace(/\D/g, "");
          return cPhone.length >= 8 && (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone));
        });
      }

      // Merge and deduplicate
      const allMatches = [...(nameMatches || []), ...phoneMatches];
      const unique = Array.from(new Map(allMatches.map(c => [c.id, c])).values());
      
      // Filter by better matching
      const filtered = unique.filter(c => {
        const cNom = c.nom.toLowerCase();
        const cPrenom = (c.prenom || "").toLowerCase();
        const searchPrenom = (prenom || "").toLowerCase();
        
        // Name match
        const nameMatch = cNom.includes(nomLower) || nomLower.includes(cNom);
        
        // Phone match
        const cleanPhone = (telephone || "").replace(/\D/g, "");
        const cPhone = (c.telephone || "").replace(/\D/g, "");
        const phoneMatch = cleanPhone.length >= 8 && cPhone.length >= 8 && 
          (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone));

        return nameMatch || phoneMatch;
      });

      setDuplicates(filtered.slice(0, 3));
    }, 500);

    return () => clearTimeout(timer);
  }, [nom, prenom, telephone, user, excludeClientId]);

  if (duplicates.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-amber-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          {duplicates.length} client{duplicates.length > 1 ? "s" : ""} similaire{duplicates.length > 1 ? "s" : ""} trouvé{duplicates.length > 1 ? "s" : ""}
        </span>
      </div>
      
      <div className="space-y-1.5">
        {duplicates.map(dup => (
          <div key={dup.id} className="flex items-center justify-between gap-2 text-sm bg-background/60 rounded px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="font-medium truncate">
                {dup.prenom} {dup.nom}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {[dup.telephone, dup.ville].filter(Boolean).join(" • ")}
              </p>
            </div>
            {onSelectExisting && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800 shrink-0"
                onClick={() => onSelectExisting(dup)}
              >
                <Users className="h-3 w-3 mr-1" />
                Utiliser
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
