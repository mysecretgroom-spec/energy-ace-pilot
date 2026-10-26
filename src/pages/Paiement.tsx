import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CreditCard, RotateCcw, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";

const POINTS = [
  { icon: ShieldCheck, title: "Paiement sécurisé", text: "Le règlement est traité par Paddle, notre revendeur officiel. Vos coordonnées bancaires ne sont jamais stockées par DébalePro." },
  { icon: CreditCard, title: "Mensuel ou annuel", text: "Choisissez votre formule et votre rythme de facturation. L'annuel offre deux mois." },
  { icon: Receipt, title: "Facture automatique", text: "Une facture est envoyée par e-mail à chaque paiement." },
  { icon: RotateCcw, title: "Remboursement 30 jours", text: "Si l'outil ne vous convient pas, vous êtes remboursé sous 30 jours." },
];

export default function Paiement() {
  useEffect(() => {
    document.title = "Paiement – DébalePro";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-foreground">DébalePro</Link>
          <nav className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/essai-gratuit">Essai gratuit</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/login">Se connecter</Link></Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center space-y-5">
          <p className="text-sm font-medium text-primary">Paiement</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            Passez à DébalePro en quelques clics.
          </h1>
          <p className="text-lg text-muted-foreground">
            Comparez les formules, puis réglez en ligne en toute sécurité depuis votre compte.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/tarifs">Voir les tarifs</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/abonnement">Payer depuis mon compte</Link></Button>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 py-12 grid gap-6 md:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 items-start rounded-xl border bg-card p-5">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-semibold">{title}</h2>
                  <p className="text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
