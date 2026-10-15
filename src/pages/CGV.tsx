import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, CreditCard, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const CGV = () => {
  return (
    <MobileLayout title="CGV" showBackButton showNav={false}>
      <div className="p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Scale className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Conditions Générales de Vente
          </h1>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Les présentes Conditions Générales de Vente régissent les relations commerciales 
              entre DébalePro et ses utilisateurs abonnés. En souscrivant à un abonnement, 
              vous acceptez intégralement ces conditions.
            </p>
          </CardContent>
        </Card>

        {/* Offres et Tarifs */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-amber-500" />
              Offres et Tarification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Formules d'abonnement</h4>
              <p className="text-xs text-muted-foreground">
                DébalePro propose différentes formules d'abonnement (mensuel, annuel) 
                dont les tarifs sont affichés sur la page Abonnement de l'application.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Prix</h4>
              <p className="text-xs text-muted-foreground">
                Les prix sont indiqués en euros TTC. DébalePro se réserve le droit 
                de modifier ses tarifs, avec notification préalable de 30 jours.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Période d'essai</h4>
              <p className="text-xs text-muted-foreground">
                Une période d'essai gratuite peut être proposée. À son terme, 
                l'abonnement devient payant sauf résiliation.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Paiement */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Modalités de Paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Paiement par carte bancaire via notre revendeur Paddle.com, Merchant of Record de toutes nos commandes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Prélèvement automatique selon la périodicité choisie
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Factures disponibles dans votre espace personnel
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                TVA applicable selon la législation en vigueur
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Renouvellement */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              Renouvellement et Résiliation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Renouvellement automatique</h4>
              <p className="text-xs text-muted-foreground">
                Les abonnements sont renouvelés automatiquement à leur échéance. 
                Vous pouvez désactiver le renouvellement à tout moment.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Résiliation</h4>
              <p className="text-xs text-muted-foreground">
                Vous pouvez résilier votre abonnement à tout moment depuis les paramètres. 
                L'accès reste actif jusqu'à la fin de la période payée.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Remboursement */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-destructive" />
              Politique de Remboursement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Aucun remboursement pour les périodes entamées
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Droit de rétractation de 14 jours pour les nouveaux abonnés (hors essai gratuit)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                Remboursement possible en cas de dysfonctionnement majeur de l'application
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Responsabilités */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-secondary" />
              Limitation de Responsabilité
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              DébalePro s'engage à fournir un service de qualité mais ne peut être tenu 
              responsable des pertes de données, interruptions de service indépendantes 
              de notre volonté, ou des décisions commerciales prises sur la base des 
              informations de l'application. L'utilisateur reste seul responsable de 
              l'exactitude des données saisies.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-card border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Contact :</strong> Pour toute question 
              relative à la facturation ou aux abonnements, contactez-nous à{" "}
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

export default CGV;
