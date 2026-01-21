import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Plus,
  Calendar,
  FileText,
} from "lucide-react";

// Données de démonstration
const clientsData = [
  {
    id: "1",
    name: "M. Dupont Jean",
    email: "jean.dupont@email.com",
    phone: "06 12 34 56 78",
    address: "12 rue de la Paix, 69001 Lyon",
    lastRdvStatus: "nouveau" as RdvStatus,
    rdvCount: 1,
    studiesCount: 0,
    lastContact: "Aujourd'hui",
  },
  {
    id: "2",
    name: "Mme Martin Sophie",
    email: "sophie.martin@email.com",
    phone: "06 98 76 54 32",
    address: "45 avenue Victor Hugo, 69100 Villeurbanne",
    lastRdvStatus: "r2" as RdvStatus,
    rdvCount: 2,
    studiesCount: 1,
    lastContact: "Hier",
  },
  {
    id: "3",
    name: "M. Bernard Pierre",
    email: "p.bernard@email.com",
    phone: "06 55 44 33 22",
    address: "8 place Bellecour, 69002 Lyon",
    lastRdvStatus: "r2_prestudy" as RdvStatus,
    rdvCount: 2,
    studiesCount: 1,
    lastContact: "Il y a 2 jours",
  },
  {
    id: "4",
    name: "Mme Leroy Marie",
    email: "marie.leroy@email.com",
    phone: "06 11 22 33 44",
    address: "23 rue de la République, 69003 Lyon",
    lastRdvStatus: "signe" as RdvStatus,
    rdvCount: 3,
    studiesCount: 2,
    lastContact: "Cette semaine",
  },
  {
    id: "5",
    name: "M. Petit François",
    email: "francois.petit@email.com",
    phone: "06 77 88 99 00",
    address: "15 boulevard des Belges, 69006 Lyon",
    lastRdvStatus: "negatif" as RdvStatus,
    rdvCount: 1,
    studiesCount: 1,
    lastContact: "La semaine dernière",
  },
];

const Clients = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = clientsData.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery) ||
      client.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="space-y-3">
          {filteredClients.map((client, index) => (
            <Card
              key={client.id}
              className="shadow-card overflow-hidden animate-slide-up cursor-pointer hover:shadow-lg transition-shadow"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    {/* Nom et statut */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">
                        {client.name}
                      </h3>
                      <StatusBadge status={client.lastRdvStatus} />
                    </div>

                    {/* Infos contact */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{client.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>{client.address}</span>
                      </div>
                    </div>

                    {/* Stats client */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{client.rdvCount} RDV</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{client.studiesCount} étude{client.studiesCount > 1 ? "s" : ""}</span>
                      </div>
                      <span>• {client.lastContact}</span>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* État vide */}
        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              Aucun client trouvé
            </h3>
            <p className="text-sm text-muted-foreground">
              Essayez avec d'autres termes de recherche
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Clients;
