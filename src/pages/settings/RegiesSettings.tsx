import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Mail,
  Phone,
  MessageSquare,
  Euro,
  ChevronRight,
  Trash2,
  Star,
  Palette,
  Edit,
  Check,
} from "lucide-react";

// Données mockup pour démonstration
const mockRegies = [
  {
    id: "1",
    nom: "EDF ENR",
    couleur: "#0066CC",
    actif: true,
    emails: [
      { id: "e1", email: "contact@edf-enr.fr", nom_source: "EDF Principal", actif: true },
      { id: "e2", email: "rdv@edf-enr.fr", nom_source: "RDV EDF", actif: true },
    ],
    contacts: [
      { id: "c1", nom: "Sophie Martin", telephone: "06 12 34 56 78", is_principal: true },
      { id: "c2", nom: "Pierre Durand", telephone: "06 98 76 54 32", is_principal: false },
    ],
    bouquets: [
      { id: "b1", nom_bouquet: "Kit 3kWc EDF", puissance_kwc: 3, prix_recommande: 8500, commission_fixe: 450 },
      { id: "b2", nom_bouquet: "Kit 6kWc EDF", puissance_kwc: 6, prix_recommande: 14500, commission_fixe: 750 },
    ],
    stats: { rdv: 24, ventes: 8, ca: 98500 },
  },
  {
    id: "2",
    nom: "Engie Solar",
    couleur: "#00A86B",
    actif: true,
    emails: [
      { id: "e3", email: "leads@engie-solar.com", nom_source: "Engie Leads", actif: true },
    ],
    contacts: [
      { id: "c3", nom: "Marc Lefebvre", telephone: "07 11 22 33 44", is_principal: true },
    ],
    bouquets: [
      { id: "b3", nom_bouquet: "Pack Engie 3kWc", puissance_kwc: 3, prix_recommande: 9200, commission_fixe: 500 },
      { id: "b4", nom_bouquet: "Pack Engie 6kWc", puissance_kwc: 6, prix_recommande: 15800, commission_fixe: 850 },
      { id: "b5", nom_bouquet: "Pack Engie 9kWc", puissance_kwc: 9, prix_recommande: 21500, commission_fixe: 1100 },
    ],
    stats: { rdv: 18, ventes: 5, ca: 72000 },
  },
];

const colorOptions = [
  "#0066CC", "#00A86B", "#FF6B35", "#9B59B6", "#E74C3C", "#3498DB", "#F39C12", "#1ABC9C"
];

const RegiesSettings = () => {
  const [regies] = useState(mockRegies);
  const [selectedRegie, setSelectedRegie] = useState<typeof mockRegies[0] | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <MobileLayout title="Régies" showBackButton>
      <div className="p-4 pb-8 space-y-4">
        {/* Header avec bouton d'ajout */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Gérez vos sources de RDV et leurs tarifs
            </p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouvelle Régie</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de la régie</label>
                  <Input placeholder="Ex: EDF ENR, Engie Solar..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Couleur</label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded-full border-2 border-transparent hover:border-foreground/50 transition-colors"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <Button className="w-full">Créer la régie</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Liste des régies */}
        <div className="space-y-3">
          {regies.map((regie) => (
            <Card
              key={regie.id}
              className="shadow-card cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
              onClick={() => setSelectedRegie(regie)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Indicateur couleur */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: regie.couleur + "20" }}
                  >
                    <Building2 className="h-6 w-6" style={{ color: regie.couleur }} />
                  </div>

                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{regie.nom}</h3>
                      {regie.actif ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Inactif</Badge>
                      )}
                    </div>

                    {/* Stats rapides */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {regie.emails.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {regie.contacts.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Euro className="h-3 w-3" />
                        {regie.bouquets.length} bouquets
                      </span>
                    </div>

                    {/* Stats performance */}
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {regie.stats.rdv} RDV
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {regie.stats.ventes} ventes
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {formatCurrency(regie.stats.ca)}
                      </Badge>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dialog détail régie */}
        <Dialog open={!!selectedRegie} onOpenChange={() => setSelectedRegie(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
            {selectedRegie && (
              <>
                {/* Header avec couleur */}
                <div
                  className="p-4 text-white"
                  style={{ backgroundColor: selectedRegie.couleur }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-8 w-8" />
                      <div>
                        <h2 className="text-xl font-bold">{selectedRegie.nom}</h2>
                        <p className="text-sm opacity-80">
                          {selectedRegie.stats.ventes} ventes • {formatCurrency(selectedRegie.stats.ca)} CA
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                        <Palette className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tabs pour les différentes sections */}
                <Tabs defaultValue="emails" className="w-full">
                  <TabsList className="w-full rounded-none border-b">
                    <TabsTrigger value="emails" className="flex-1 gap-1">
                      <Mail className="h-4 w-4" />
                      Emails
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="flex-1 gap-1">
                      <MessageSquare className="h-4 w-4" />
                      WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="bouquets" className="flex-1 gap-1">
                      <Euro className="h-4 w-4" />
                      Tarifs
                    </TabsTrigger>
                  </TabsList>

                  {/* Onglet Emails */}
                  <TabsContent value="emails" className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Emails d'import RDV automatique
                      </p>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Plus className="h-3 w-3" />
                        Ajouter
                      </Button>
                    </div>

                    {selectedRegie.emails.map((email) => (
                      <Card key={email.id}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Mail className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{email.email}</p>
                            <p className="text-xs text-muted-foreground">{email.nom_source}</p>
                          </div>
                          <Switch checked={email.actif} />
                          <Button size="icon" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  {/* Onglet Contacts WhatsApp */}
                  <TabsContent value="contacts" className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Contacts pour envoi WhatsApp
                      </p>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Plus className="h-3 w-3" />
                        Ajouter
                      </Button>
                    </div>

                    {selectedRegie.contacts.map((contact) => (
                      <Card key={contact.id} className={contact.is_principal ? "ring-2 ring-primary" : ""}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${contact.is_principal ? "bg-primary text-primary-foreground" : "bg-green-500/10"}`}>
                            <MessageSquare className={`h-4 w-4 ${contact.is_principal ? "" : "text-green-600"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{contact.nom}</p>
                              {contact.is_principal && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-primary">
                                  <Star className="h-2.5 w-2.5 mr-0.5" />
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{contact.telephone}</p>
                          </div>
                          {!contact.is_principal && (
                            <Button size="sm" variant="outline" className="text-xs gap-1">
                              <Check className="h-3 w-3" />
                              Principal
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}

                    <Card className="bg-muted/50 border-dashed">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground text-center">
                          💡 Le contact <strong>Principal</strong> recevra les messages WhatsApp automatiques lors des changements de statut.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Onglet Bouquets/Tarifs */}
                  <TabsContent value="bouquets" className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Tarifs et commissions spécifiques
                      </p>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Plus className="h-3 w-3" />
                        Ajouter
                      </Button>
                    </div>

                    {selectedRegie.bouquets.map((bouquet) => (
                      <Card key={bouquet.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{bouquet.nom_bouquet}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {bouquet.puissance_kwc} kWc
                              </p>
                            </div>
                            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-4 mt-3">
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix reco.</p>
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(bouquet.prix_recommande)}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Commission</p>
                              <p className="text-sm font-semibold text-green-600">
                                {formatCurrency(bouquet.commission_fixe)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>

                {/* Footer actions */}
                <div className="p-4 border-t flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedRegie(null)}>
                    Fermer
                  </Button>
                  <Button className="flex-1 gap-2">
                    <Check className="h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Info mockup */}
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
              ⚠️ <strong>Mockup</strong> - Données de démonstration pour validation de l'interface
            </p>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default RegiesSettings;
