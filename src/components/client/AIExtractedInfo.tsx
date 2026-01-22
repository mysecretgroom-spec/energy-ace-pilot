import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Home,
  Users,
  Flame,
  Zap,
  Euro,
  Sun,
  Clock,
  Compass,
  Building2,
  Calendar,
  Heart,
  Target,
} from "lucide-react";

interface ClientMetadata {
  situation_familiale?: string;
  proprietaire?: boolean;
  type_habitation?: string;
  surface_habitable?: number;
  annee_construction?: number;
  type_chauffage?: string;
  facture_energie?: number;
  revenus_fiscaux?: number;
  nb_personnes_foyer?: number;
  type_toiture?: string;
  orientation_toiture?: string;
  projet_motivation?: string;
  budget_estime?: number;
  urgence?: string;
  notes_supplementaires?: string;
  last_email_update?: string;
}

interface RdvMetadata {
  ai_extracted?: boolean;
  extraction_date?: string;
  motivation?: string;
  budget_estime?: number;
  urgence?: string;
  type_toiture?: string;
  orientation_toiture?: string;
  facture_energie?: number;
  type_chauffage?: string;
}

interface AIExtractedInfoProps {
  metadata: ClientMetadata | RdvMetadata | null;
  type: "client" | "rdv";
}

const situationLabels: Record<string, string> = {
  celibataire: "Célibataire",
  marie: "Marié(e)",
  pacse: "Pacsé(e)",
  divorce: "Divorcé(e)",
  veuf: "Veuf/Veuve",
};

const habitationLabels: Record<string, string> = {
  maison: "Maison",
  appartement: "Appartement",
  immeuble: "Immeuble",
};

const chauffageLabels: Record<string, string> = {
  electrique: "Électrique",
  gaz: "Gaz",
  fioul: "Fioul",
  bois: "Bois",
  pac: "Pompe à chaleur",
  autre: "Autre",
};

const toitureLabels: Record<string, string> = {
  tuiles: "Tuiles",
  ardoises: "Ardoises",
  bac_acier: "Bac acier",
  tole: "Tôle",
  autre: "Autre",
};

const orientationLabels: Record<string, string> = {
  sud: "Sud",
  "sud-est": "Sud-Est",
  "sud-ouest": "Sud-Ouest",
  est: "Est",
  ouest: "Ouest",
  nord: "Nord",
};

const urgenceLabels: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-destructive text-destructive-foreground" },
  moyen_terme: { label: "Moyen terme", color: "bg-status-reported text-black" },
  informatif: { label: "Informatif", color: "bg-muted text-muted-foreground" },
};

export function AIExtractedInfo({ metadata, type }: AIExtractedInfoProps) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  const clientMeta = metadata as ClientMetadata;
  const rdvMeta = metadata as RdvMetadata;

  // Check if we have any displayable data
  const hasClientData = type === "client" && (
    clientMeta.situation_familiale ||
    clientMeta.proprietaire !== undefined ||
    clientMeta.type_habitation ||
    clientMeta.surface_habitable ||
    clientMeta.type_chauffage ||
    clientMeta.facture_energie ||
    clientMeta.revenus_fiscaux ||
    clientMeta.nb_personnes_foyer ||
    clientMeta.type_toiture ||
    clientMeta.orientation_toiture ||
    clientMeta.budget_estime ||
    clientMeta.urgence
  );

  const hasRdvData = type === "rdv" && (
    rdvMeta.ai_extracted ||
    rdvMeta.motivation ||
    rdvMeta.budget_estime ||
    rdvMeta.urgence ||
    rdvMeta.type_toiture ||
    rdvMeta.orientation_toiture
  );

  if (!hasClientData && !hasRdvData) {
    return null;
  }

  return (
    <Card className="shadow-card border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Infos extraites par IA
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Client-specific fields */}
          {type === "client" && (
            <>
              {clientMeta.proprietaire !== undefined && (
                <InfoItem
                  icon={<Home className="h-3.5 w-3.5" />}
                  label="Statut"
                  value={clientMeta.proprietaire ? "Propriétaire" : "Locataire"}
                />
              )}
              
              {clientMeta.situation_familiale && (
                <InfoItem
                  icon={<Heart className="h-3.5 w-3.5" />}
                  label="Situation"
                  value={situationLabels[clientMeta.situation_familiale] || clientMeta.situation_familiale}
                />
              )}
              
              {clientMeta.nb_personnes_foyer && (
                <InfoItem
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Foyer"
                  value={`${clientMeta.nb_personnes_foyer} pers.`}
                />
              )}
              
              {clientMeta.type_habitation && (
                <InfoItem
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label="Habitat"
                  value={habitationLabels[clientMeta.type_habitation] || clientMeta.type_habitation}
                />
              )}
              
              {clientMeta.surface_habitable && (
                <InfoItem
                  icon={<Home className="h-3.5 w-3.5" />}
                  label="Surface"
                  value={`${clientMeta.surface_habitable} m²`}
                />
              )}
              
              {clientMeta.annee_construction && (
                <InfoItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Construction"
                  value={clientMeta.annee_construction.toString()}
                />
              )}
              
              {clientMeta.type_chauffage && (
                <InfoItem
                  icon={<Flame className="h-3.5 w-3.5" />}
                  label="Chauffage"
                  value={chauffageLabels[clientMeta.type_chauffage] || clientMeta.type_chauffage}
                />
              )}
              
              {clientMeta.facture_energie && (
                <InfoItem
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label="Facture énergie"
                  value={`${clientMeta.facture_energie.toLocaleString("fr-FR")} €`}
                />
              )}
              
              {clientMeta.revenus_fiscaux && (
                <InfoItem
                  icon={<Euro className="h-3.5 w-3.5" />}
                  label="Revenus fiscaux"
                  value={`${clientMeta.revenus_fiscaux.toLocaleString("fr-FR")} €`}
                />
              )}
              
              {clientMeta.type_toiture && (
                <InfoItem
                  icon={<Sun className="h-3.5 w-3.5" />}
                  label="Toiture"
                  value={toitureLabels[clientMeta.type_toiture] || clientMeta.type_toiture}
                />
              )}
              
              {clientMeta.orientation_toiture && (
                <InfoItem
                  icon={<Compass className="h-3.5 w-3.5" />}
                  label="Orientation"
                  value={orientationLabels[clientMeta.orientation_toiture] || clientMeta.orientation_toiture}
                />
              )}
              
              {clientMeta.budget_estime && (
                <InfoItem
                  icon={<Euro className="h-3.5 w-3.5" />}
                  label="Budget"
                  value={`${clientMeta.budget_estime.toLocaleString("fr-FR")} €`}
                />
              )}
            </>
          )}

          {/* RDV-specific fields */}
          {type === "rdv" && (
            <>
              {rdvMeta.type_toiture && (
                <InfoItem
                  icon={<Sun className="h-3.5 w-3.5" />}
                  label="Toiture"
                  value={toitureLabels[rdvMeta.type_toiture] || rdvMeta.type_toiture}
                />
              )}
              
              {rdvMeta.orientation_toiture && (
                <InfoItem
                  icon={<Compass className="h-3.5 w-3.5" />}
                  label="Orientation"
                  value={orientationLabels[rdvMeta.orientation_toiture] || rdvMeta.orientation_toiture}
                />
              )}
              
              {rdvMeta.type_chauffage && (
                <InfoItem
                  icon={<Flame className="h-3.5 w-3.5" />}
                  label="Chauffage"
                  value={chauffageLabels[rdvMeta.type_chauffage] || rdvMeta.type_chauffage}
                />
              )}
              
              {rdvMeta.facture_energie && (
                <InfoItem
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label="Facture"
                  value={`${rdvMeta.facture_energie.toLocaleString("fr-FR")} €`}
                />
              )}
              
              {rdvMeta.budget_estime && (
                <InfoItem
                  icon={<Euro className="h-3.5 w-3.5" />}
                  label="Budget"
                  value={`${rdvMeta.budget_estime.toLocaleString("fr-FR")} €`}
                />
              )}
            </>
          )}
        </div>

        {/* Urgence badge - full width */}
        {(clientMeta.urgence || rdvMeta.urgence) && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Urgence:</span>
              <Badge className={urgenceLabels[clientMeta.urgence || rdvMeta.urgence || ""]?.color || "bg-muted"}>
                {urgenceLabels[clientMeta.urgence || rdvMeta.urgence || ""]?.label || clientMeta.urgence || rdvMeta.urgence}
              </Badge>
            </div>
          </div>
        )}

        {/* Motivation - full width */}
        {(clientMeta.projet_motivation || rdvMeta.motivation) && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <div className="flex items-start gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Motivation:</span>
                <p className="text-xs mt-0.5">{clientMeta.projet_motivation || rdvMeta.motivation}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
