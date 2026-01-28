import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushToGoogleCalendar } from "@/hooks/usePushToGoogleCalendar";
import { CalendarPlus, Loader2, Check, X, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { geocodeAndUpdateClient, geocodeAndUpdateRdv } from "@/hooks/useGeocode";

interface QuickRdvFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultDate?: Date;
}

interface ClientOption {
  id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
}

interface RegieOption {
  id: string;
  nom: string;
  couleur: string | null;
}

const projectTypes = [
  { value: "photovoltaique", label: "Photovoltaïque" },
  { value: "pompe_chaleur", label: "Pompe à chaleur" },
  { value: "isolation", label: "Isolation" },
  { value: "ballon_thermo", label: "Ballon thermodynamique" },
  { value: "autre", label: "Autre" },
];

export function QuickRdvForm({ onSuccess, onCancel, defaultDate }: QuickRdvFormProps) {
  const { user } = useAuth();
  const { pushRdvToCalendar } = usePushToGoogleCalendar();
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [regies, setRegies] = useState<RegieOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(true);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedRegieId, setSelectedRegieId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [dateRdv, setDateRdv] = useState(
    defaultDate?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0]
  );
  const [timeRdv, setTimeRdv] = useState("10:00");
  const [duration, setDuration] = useState("90");
  const [projectType, setProjectType] = useState("photovoltaique");
  const [commentaire, setCommentaire] = useState("");

  // Fetch regies on mount
  useEffect(() => {
    const fetchRegies = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("regies")
        .select("id, nom, couleur")
        .eq("user_id", user.id)
        .eq("actif", true)
        .order("nom");
      if (data) setRegies(data);
    };
    fetchRegies();
  }, [user]);

  // Search clients
  useEffect(() => {
    if (!user || searchTerm.length < 2) {
      setClients([]);
      return;
    }

    const searchClients = async () => {
      setLoadingClients(true);
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("id, nom, prenom, telephone, adresse, ville, code_postal")
          .eq("user_id", user.id)
          .or(`nom.ilike.%${searchTerm}%,prenom.ilike.%${searchTerm}%,telephone.ilike.%${searchTerm}%`)
          .limit(5);

        if (error) throw error;
        setClients(data || []);
      } catch (err) {
        console.error("Error searching clients:", err);
      } finally {
        setLoadingClients(false);
      }
    };

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, user]);

  const selectClient = (client: ClientOption) => {
    setSelectedClientId(client.id);
    setClientName(`${client.prenom || ""} ${client.nom}`.trim());
    setClientPhone(client.telephone || "");
    setAddress(client.adresse || "");
    setCity(client.ville || "");
    setPostalCode(client.code_postal || "");
    setShowClientSearch(false);
    setSearchTerm("");
    setClients([]);
  };

  const createNewClient = async (): Promise<string | null> => {
    if (!user) return null;

    const nameParts = clientName.trim().split(" ");
    const prenom = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : null;
    const nom = nameParts.length > 1 ? nameParts[nameParts.length - 1] : clientName;

    const fullAddress = [address, postalCode, city].filter(Boolean).join(", ");

    const { data, error } = await supabase
      .from("clients")
      .insert({
        user_id: user.id,
        nom,
        prenom,
        telephone: clientPhone || null,
        adresse: address || null,
        ville: city || null,
        code_postal: postalCode || null,
        regie_id: selectedRegieId || null, // Link client to the selected régie
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return null;
    }

    // Geocode the address in background
    if (fullAddress) {
      geocodeAndUpdateClient(data.id, fullAddress).catch(console.error);
    }

    return data.id;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!clientName.trim()) {
      toast.error("Nom du client obligatoire");
      return;
    }
    if (!selectedRegieId) {
      toast.error("Veuillez sélectionner une régie");
      return;
    }

    setSaving(true);
    try {
      // Get or create client
      let clientId = selectedClientId;
      if (!clientId) {
        clientId = await createNewClient() as string;
        if (!clientId) {
          toast.error("Erreur lors de la création du client");
          return;
        }
      }

      // Create RDV
      const dateHeure = new Date(`${dateRdv}T${timeRdv}`);
      const fullAddress = [address, postalCode, city].filter(Boolean).join(", ");

      const { data: rdvData, error } = await supabase.from("rdv").insert({
        user_id: user.id,
        client_id: clientId,
        date_heure: dateHeure.toISOString(),
        duree_minutes: parseInt(duration),
        type_projet: projectType as "photovoltaique" | "pompe_chaleur" | "isolation" | "ballon_thermo" | "autre",
        adresse: fullAddress || null,
        commentaire: commentaire || null,
        status: "nouveau",
        regie_id: selectedRegieId || null,
      }).select("id").single();

      if (error) throw error;

      // Geocode the RDV address in background
      if (rdvData && fullAddress) {
        geocodeAndUpdateRdv(rdvData.id, fullAddress).catch(console.error);
      }

      // Push to Google Calendar in background (non-blocking)
      if (rdvData) {
        pushRdvToCalendar(rdvData.id).then((result) => {
          if (result?.success) {
            console.log("RDV synced to Google Calendar:", result.action);
          }
        }).catch(console.error);
      }

      toast.success("RDV créé avec succès");
      onSuccess?.();
    } catch (err) {
      console.error("Error creating RDV:", err);
      toast.error("Erreur lors de la création du RDV");
    } finally {
      setSaving(false);
    }
  };

  const resetClientSelection = () => {
    setSelectedClientId("");
    setSelectedRegieId("");
    setClientName("");
    setClientPhone("");
    setAddress("");
    setCity("");
    setPostalCode("");
    setShowClientSearch(true);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5" />
          Nouveau rendez-vous
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client search or display */}
        {showClientSearch ? (
          <div className="space-y-2">
            <Label>Rechercher un client</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nom, prénom ou téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {loadingClients && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Recherche...
              </div>
            )}
            {clients.length > 0 && (
              <div className="border rounded-lg divide-y">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => selectClient(client)}
                    className="w-full p-3 text-left hover:bg-muted transition-colors"
                  >
                    <p className="font-medium text-foreground">
                      {client.prenom} {client.nom}
                    </p>
                    {client.telephone && (
                      <p className="text-sm text-muted-foreground">{client.telephone}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            {searchTerm.length >= 2 && clients.length === 0 && !loadingClients && (
              <p className="text-sm text-muted-foreground">
                Aucun client trouvé. Les informations ci-dessous créeront un nouveau client.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="font-medium text-foreground">{clientName}</p>
              {clientPhone && (
                <p className="text-sm text-muted-foreground">{clientPhone}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={resetClientSelection}>
              Changer
            </Button>
          </div>
        )}

        {/* Client info (for new client) */}
        {showClientSearch && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nom *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Téléphone</Label>
                <Input
                  id="clientPhone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="06..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rue, numéro..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="75000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris"
                />
              </div>
            </div>
          </>
        )}

        {/* Date and time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="dateRdv">Date</Label>
            <Input
              id="dateRdv"
              type="date"
              value={dateRdv}
              onChange={(e) => setDateRdv(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeRdv">Heure</Label>
            <Input
              id="timeRdv"
              type="time"
              value={timeRdv}
              onChange={(e) => setTimeRdv(e.target.value)}
            />
          </div>
        </div>

        {/* Duration and project type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="duration">Durée (min)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1h</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2h</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectType">Type de projet</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Régie selection (required) */}
        <div className="space-y-2">
          <Label htmlFor="regie" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Régie <span className="text-destructive">*</span>
          </Label>
          <Select 
            value={selectedRegieId || ""} 
            onValueChange={setSelectedRegieId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une régie" />
            </SelectTrigger>
            <SelectContent>
              {regies.map((regie) => (
                <SelectItem key={regie.id} value={regie.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: regie.couleur || "#888" }}
                    />
                    {regie.nom}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {regies.length === 0 && (
            <p className="text-xs text-destructive">Aucune régie configurée</p>
          )}
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <Label htmlFor="commentaire">Commentaire</Label>
          <Textarea
            id="commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Notes sur le rendez-vous..."
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-hero"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Créer le RDV
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
