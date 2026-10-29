import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  Shield, 
  FileText, 
  Scale, 
  Lock, 
  Trash2,
  ChevronRight 
} from "lucide-react";

const legalDocs = [
  {
    title: "Politique de Confidentialité",
    description: "Comment nous collectons et protégeons vos données personnelles",
    icon: Shield,
    href: "/confidentialite",
    color: "text-primary"
  },
  {
    title: "Conditions Générales d'Utilisation",
    description: "Règles d'utilisation de l'application DébalePro",
    icon: FileText,
    href: "/conditions",
    color: "text-blue-500"
  },
  {
    title: "Conditions Générales de Vente",
    description: "Modalités d'abonnement et de paiement",
    icon: Scale,
    href: "/cgv",
    color: "text-amber-500"
  },
  {
    title: "Politique de Remboursement",
    description: "Satisfait ou remboursé 30 jours",
    icon: Scale,
    href: "/remboursement",
    color: "text-amber-500"
  },
  {
    title: "Politique de Sécurité",
    description: "Mesures de protection de vos données et de l'application",
    icon: Lock,
    href: "/securite",
    color: "text-emerald-500"
  },
  {
    title: "Conservation des Données",
    description: "Durées de conservation et suppression de vos données",
    icon: Trash2,
    href: "/data-retention",
    color: "text-red-500"
  }
];

const Legal = () => {
  return (
    <MobileLayout title="Documents Légaux" showBackButton showNav={false}>
      <div className="p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Documents Légaux
          </h1>
          <p className="text-sm text-muted-foreground">
            Retrouvez tous les documents légaux régissant l'utilisation de DébalePro
          </p>
        </div>

        {/* Legal Documents List */}
        <div className="space-y-3">
          {legalDocs.map((doc) => (
            <Link key={doc.href} to={doc.href}>
              <Card className="shadow-card hover:shadow-md transition-shadow active:scale-[0.98]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-full bg-muted ${doc.color}`}>
                      <doc.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-foreground">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {doc.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Contact Info */}
        <Card className="shadow-card border-primary/20 bg-primary/5 mt-6">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Documents édités par <strong>ALFRED'S AGENCY</strong>, 49 rue d'Hauteville, 75010 Paris. Pour toute question,
              contactez-nous à{" "}
              <a href="mailto:contact@miweha.com" className="text-primary hover:underline font-medium">
                contact@miweha.com
              </a>
            </p>

          </CardContent>
        </Card>

        {/* Last update */}
        <p className="text-center text-xs text-muted-foreground">
          Dernière mise à jour : Janvier 2026
        </p>
      </div>
    </MobileLayout>
  );
};

export default Legal;
