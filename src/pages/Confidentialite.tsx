import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, Database, UserCheck, Mail } from "lucide-react";

const Confidentialite = () => {
  return (
    <MobileLayout title="Confidentialité" showBackButton showNav={false}>
      <div className="p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Politique de Confidentialité
          </h1>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              DébalePro s'engage à protéger votre vie privée. Cette politique de confidentialité 
              explique comment nous collectons, utilisons et protégeons vos données personnelles 
              lors de l'utilisation de notre application.
            </p>
          </CardContent>
        </Card>

        {/* Données collectées */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Données collectées
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Informations de compte</h4>
              <p className="text-xs text-muted-foreground">
                Email, nom, prénom, numéro de téléphone professionnel.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Données professionnelles</h4>
              <p className="text-xs text-muted-foreground">
                Rendez-vous, clients, études techniques, ventes et commissions.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Documents</h4>
              <p className="text-xs text-muted-foreground">
                Photos, scans de documents clients avec leur consentement.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Données de localisation</h4>
              <p className="text-xs text-muted-foreground">
                Adresses pour l'optimisation des tournées (avec votre autorisation).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Utilisation des données */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-primary" />
              Utilisation des données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Gestion de votre activité commerciale (planning, CRM, études)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Synchronisation avec Google Calendar et Gmail
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Calcul des commissions et suivi financier
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Amélioration continue de l'application
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Protection des données */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" />
              Protection des données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Chiffrement des données en transit et au repos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Authentification sécurisée avec option PIN/biométrie
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Accès restreint selon les politiques RLS (Row Level Security)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Hébergement sécurisé conforme RGPD
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Vos droits */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" />
              Vos droits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Droit d'accès à vos données personnelles</li>
              <li>• Droit de rectification des informations inexactes</li>
              <li>• Droit à l'effacement (droit à l'oubli)</li>
              <li>• Droit à la portabilité de vos données</li>
              <li>• Droit d'opposition au traitement</li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" />
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              Pour toute question concernant vos données personnelles, contactez-nous à :{" "}
              <a href="mailto:contact@debalepro.app" className="text-primary hover:underline">
                contact@debalepro.app
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Confidentialite;
