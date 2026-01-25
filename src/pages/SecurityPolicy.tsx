import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Shield, Key, Server, Eye, AlertTriangle, CheckCircle } from "lucide-react";

const SecurityPolicy = () => {
  return (
    <MobileLayout title="Sécurité" showBackButton showNav={false}>
      <div className="p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Politique de Sécurité
          </h1>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              La sécurité de vos données est notre priorité absolue. Cette politique 
              décrit les mesures techniques et organisationnelles mises en place pour 
              protéger vos informations personnelles et professionnelles.
            </p>
          </CardContent>
        </Card>

        {/* Chiffrement */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4 text-emerald-500" />
              Chiffrement des Données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Chiffrement TLS 1.3 pour toutes les communications
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Données stockées chiffrées au repos (AES-256)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Tokens d'authentification sécurisés et renouvelés régulièrement
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                Mots de passe hashés avec algorithmes modernes (bcrypt)
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Authentification */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-blue-500" />
              Authentification Sécurisée
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Méthodes disponibles</h4>
              <p className="text-xs text-muted-foreground">
                Email/mot de passe, code PIN, authentification biométrique (Face ID/Touch ID).
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Double authentification (MFA)</h4>
              <p className="text-xs text-muted-foreground">
                Authentification multi-facteur requise pour les actions sensibles 
                (administration, gestion financière).
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Sessions sécurisées</h4>
              <p className="text-xs text-muted-foreground">
                Expiration automatique des sessions, détection des connexions suspectes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Infrastructure */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-purple-500" />
              Infrastructure & Hébergement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                Hébergement sur infrastructure cloud certifiée (ISO 27001, SOC 2)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                Centres de données localisés en Europe (conformité RGPD)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                Sauvegardes automatiques quotidiennes chiffrées
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                Surveillance 24/7 et détection d'intrusion
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Contrôle d'accès */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-amber-500" />
              Contrôle d'Accès
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Politiques RLS (Row Level Security) isolant les données par utilisateur
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Principe du moindre privilège pour tous les accès
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Journalisation des accès aux données sensibles
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Révocation immédiate des accès en cas de départ
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Bonnes pratiques */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-primary" />
              Recommandations Utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Utilisez un mot de passe fort et unique
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Activez l'authentification biométrique ou le code PIN
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Ne partagez jamais vos identifiants de connexion
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Signalez toute activité suspecte immédiatement
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Signalement */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Signalement de Vulnérabilités
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Si vous découvrez une faille de sécurité, veuillez nous la signaler 
              de manière responsable à{" "}
              <a href="mailto:contact@debalepro.app" className="text-primary hover:underline">
                contact@debalepro.app
              </a>
              . Nous nous engageons à traiter votre signalement rapidement et confidentiellement.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-card border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Contact Sécurité :</strong> Pour toute 
              question relative à la sécurité, contactez-nous à{" "}
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

export default SecurityPolicy;
