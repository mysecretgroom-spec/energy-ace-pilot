import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertTriangle, CheckCircle, XCircle, Scale, RefreshCw } from "lucide-react";

const Conditions = () => {
  return (
    <MobileLayout title="Conditions" showBackButton showNav={false}>
      <div className="p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Conditions d'Utilisation
          </h1>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              En utilisant DébalePro, vous acceptez les présentes conditions d'utilisation. 
              Cette application est destinée aux professionnels du secteur des énergies 
              renouvelables pour la gestion de leur activité commerciale.
            </p>
          </CardContent>
        </Card>

        {/* Acceptation */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-primary" />
              Acceptation des conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                L'utilisation de l'application implique l'acceptation pleine et entière de ces conditions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Vous devez être majeur et disposer de la capacité juridique
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Un seul compte par utilisateur est autorisé
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" />
              Description des services
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Gestion Planning</h4>
              <p className="text-xs text-muted-foreground">
                Planification des rendez-vous, optimisation des tournées, synchronisation calendrier.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">CRM</h4>
              <p className="text-xs text-muted-foreground">
                Gestion des clients, suivi des ventes, pipeline commercial.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Études techniques</h4>
              <p className="text-xs text-muted-foreground">
                Création d'études photovoltaïques, calculs de rentabilité.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Finances</h4>
              <p className="text-xs text-muted-foreground">
                Suivi des frais professionnels, gestion des commissions.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Responsabilités utilisateur */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-secondary" />
              Responsabilités de l'utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-secondary mt-0.5">•</span>
                Maintenir la confidentialité de vos identifiants
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary mt-0.5">•</span>
                Fournir des informations exactes et à jour
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary mt-0.5">•</span>
                Respecter le consentement des clients pour leurs données
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary mt-0.5">•</span>
                Ne pas utiliser l'application à des fins illégales
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary mt-0.5">•</span>
                Signaler tout usage frauduleux de votre compte
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Interdictions */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-destructive" />
              Usages interdits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Tenter de contourner les mesures de sécurité
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Copier ou redistribuer le contenu de l'application
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Utiliser des robots ou scripts automatisés
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Partager votre compte avec des tiers
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Modifications */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-primary" />
              Modifications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              DébalePro se réserve le droit de modifier ces conditions à tout moment. 
              Les utilisateurs seront informés des modifications significatives. 
              L'utilisation continue après modification vaut acceptation des nouvelles conditions.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Contact :</strong> Pour toute question, 
              contactez-nous à{" "}
              <a href="mailto:contact@debalepro.fr" className="text-primary hover:underline">
                contact@debalepro.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Conditions;
