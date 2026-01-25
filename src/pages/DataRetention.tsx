import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Clock, Database, AlertTriangle, CheckCircle, FileText } from "lucide-react";

const DataRetention = () => {
  return (
    <MobileLayout title="Conservation" showBackButton showNav={false}>
      <div className="p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Politique de Conservation des Données
          </h1>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conformément au RGPD et aux exigences des API financières (Plaid), 
              cette politique définit les durées de conservation de vos données 
              et les modalités de leur suppression.
            </p>
          </CardContent>
        </Card>

        {/* Durées de conservation */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Durées de Conservation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="border-l-2 border-primary pl-3">
              <h4 className="font-medium text-sm text-foreground">Données de compte</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Conservées pendant toute la durée de l'abonnement actif, 
                puis 3 ans après la clôture du compte (obligation légale).
              </p>
            </div>
            <div className="border-l-2 border-blue-500 pl-3">
              <h4 className="font-medium text-sm text-foreground">Données transactionnelles</h4>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>12 mois maximum</strong> pour les données bancaires importées via Plaid. 
                Après cette période, seuls les agrégats sont conservés.
              </p>
            </div>
            <div className="border-l-2 border-amber-500 pl-3">
              <h4 className="font-medium text-sm text-foreground">Documents clients</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Conservés 5 ans après la dernière interaction avec le client 
                (conformité fiscale et commerciale).
              </p>
            </div>
            <div className="border-l-2 border-emerald-500 pl-3">
              <h4 className="font-medium text-sm text-foreground">Journaux d'activité</h4>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>90 jours</strong> pour les logs de connexion et d'activité. 
                Supprimés automatiquement au-delà.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Types de données */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-purple-500" />
              Catégories de Données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span><strong>Données d'identification :</strong> nom, email, téléphone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span><strong>Données professionnelles :</strong> clients, RDV, études, ventes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span><strong>Données financières :</strong> frais, commissions, transactions bancaires</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span><strong>Documents :</strong> scans, photos, justificatifs</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Suppression */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Suppression des Données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">À la clôture du compte</h4>
              <p className="text-xs text-muted-foreground">
                <strong>Suppression immédiate</strong> de toutes vos données personnelles 
                dans les 30 jours suivant la demande, sauf obligations légales de conservation.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Données bancaires (Plaid)</h4>
              <p className="text-xs text-muted-foreground">
                Supprimées immédiatement sur demande, avec révocation de l'accès 
                au compte bancaire connecté.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Procédure de suppression</h4>
              <p className="text-xs text-muted-foreground">
                Contactez-nous par email pour exercer votre droit à l'effacement. 
                La demande sera traitée sous 30 jours maximum.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Export des données */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-blue-500" />
              Portabilité des Données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vous pouvez demander une copie de toutes vos données personnelles 
              dans un format structuré et lisible par machine (JSON, CSV). 
              Cette demande sera traitée sous 30 jours.
            </p>
          </CardContent>
        </Card>

        {/* Avertissement */}
        <Card className="shadow-card border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Important
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              Certaines données peuvent être conservées au-delà des durées indiquées 
              pour répondre à des obligations légales (fiscales, comptables, contentieux). 
              Ces données sont alors anonymisées ou leur accès strictement limité.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-card border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Demande de suppression :</strong> Pour exercer 
              vos droits ou demander la suppression de vos données, contactez-nous à{" "}
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

export default DataRetention;
