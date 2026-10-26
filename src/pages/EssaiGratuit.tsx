import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, ClipboardList, ScanLine, MessageCircle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { VisitorButton } from "@/components/auth/VisitorButton";

const INCLUDED = [
  { icon: ClipboardList, text: "Études PV, PAC et ITE complètes avec rapport PDF" },
  { icon: ScanLine, text: "Scanner de documents multipage" },
  { icon: MessageCircle, text: "Récap WhatsApp et assistant IA personnel" },
  { icon: WifiOff, text: "Planning et CRM utilisables sans réseau" },
];

const STEPS = [
  "Créez votre compte en une minute",
  "Ajoutez votre régie et vos premiers rendez-vous",
  "Réalisez votre première étude sur le terrain",
];

export default function EssaiGratuit() {
  useEffect(() => {
    document.title = "Essai gratuit 10 jours – DébalePro";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-foreground">DébalePro</Link>
          <nav className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/tarifs">Tarifs</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/login">Se connecter</Link></Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center space-y-5">
          <p className="text-sm font-medium text-primary">Essai gratuit · 10 jours</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            Testez DébalePro sur vos vrais rendez-vous pendant 10 jours.
          </h1>
          <p className="text-lg text-muted-foreground">
            Aucun paiement demandé à l'inscription. À la fin de l'essai, vous choisissez votre formule ou vous arrêtez.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/signup">Commencer mon essai gratuit</Link></Button>
            <VisitorButton size="lg" variant="outline" label="Voir une démo sans compte" />
          </div>
          <p className="text-xs text-muted-foreground">Sans engagement · Sans carte bancaire</p>
        </section>

        <section className="border-t bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 py-12 grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-semibold">Inclus pendant l'essai</h2>
              <ul className="space-y-3">
                {INCLUDED.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex gap-3 items-start">
                    <span className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></span>
                    <span className="pt-1">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-semibold">Comment ça se passe</h2>
              <ol className="space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex gap-3 items-start">
                    <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-semibold">{i + 1}</span>
                    <span className="pt-1">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" />Certaines fonctions avancées sont limitées pendant l'essai.</p>
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
          <h2 className="font-display text-2xl font-semibold">Prêt à essayer ?</h2>
          <Button asChild size="lg"><Link to="/signup">Créer mon compte gratuit</Link></Button>
          <p className="text-sm text-muted-foreground"><Link to="/tarifs" className="underline underline-offset-4">Voir les tarifs après l'essai</Link></p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
