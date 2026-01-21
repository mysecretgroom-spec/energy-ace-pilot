import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Phone,
  MapPin,
  ChevronRight,
  Plus,
  Calendar,
  FileText,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  created_at: string;
}

const Clients = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  };

  const filteredClients = clients.filter(
    (client) =>
      client.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.prenom && client.prenom.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.telephone && client.telephone.includes(searchQuery)) ||
      (client.ville && client.ville.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine(s)`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <MobileLayout title="Clients">
      <div className="p-4 space-y-4">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats rapides */}
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">
            {filteredClients.length} client{filteredClients.length > 1 ? "s" : ""}
          </span>
          <Button size="sm" className="bg-gradient-hero gap-1">
            <Plus className="h-4 w-4" />
            Nouveau
          </Button>
        </div>

        {/* Liste des clients */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client, index) => (
              <Card
                key={client.id}
                className="shadow-card overflow-hidden animate-slide-up cursor-pointer hover:shadow-lg transition-shadow"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      {/* Nom */}
                      <h3 className="font-semibold text-foreground">
                        {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
                      </h3>

                      {/* Infos contact */}
                      <div className="space-y-1">
                        {client.telephone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{client.telephone}</span>
                          </div>
                        )}
                        {(client.adresse || client.ville) && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              {client.ville || client.adresse}
                              {client.code_postal && ` (${client.code_postal})`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(client.created_at)}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* État vide */}
        {!loading && filteredClients.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {clients.length === 0 ? "Aucun client" : "Aucun client trouvé"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {clients.length === 0
                ? "Commencez par ajouter votre premier client"
                : "Essayez avec d'autres termes de recherche"}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Clients;
