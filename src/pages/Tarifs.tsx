import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { SellerAddress } from "@/components/legal/LegalPage";

import { PLANS, TOPUPS, formatEur, yearlySavings, type PlanTier } from "@/lib/plans";

const TIERS: PlanTier[] = ["classique", "premium"];

export default function Tarifs() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/login" className="font-display font-semibold text-foreground">DébalePro</Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Se connecter</Link></Button>
            <Button asChild size="sm"><Link to="/signup">Essai gratuit</Link></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 space-y-10">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tarifs</h1>
          <p className="text-muted-foreground">10 jours d'essai gratuit, sans engagement. Prix TTC, résiliable à tout moment.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {TIERS.map((t) => {
            const p = PLANS[t];
            return (
              <section key={t} className={`border rounded-md bg-card p-6 flex flex-col gap-4 ${t === "premium" ? "border-primary" : ""}`}>
                <div>
                  <h2 className="font-display text-xl font-semibold">{p.name}</h2>
                  <p className="mt-2"><span className="font-display text-3xl font-semibold tabular-nums">{formatEur(p.monthly)}</span>
                    <span className="text-muted-foreground"> / mois</span></p>
                  <p className="text-sm text-muted-foreground">ou {formatEur(p.yearly)} / an — {formatEur(yearlySavings(t))} d'économie (2 mois offerts)</p>
                </div>
                <ul className="space-y-2 text-sm flex-1">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{f}</li>)}
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />Budget IA inclus : {formatEur(p.aiBudgetEur)} / mois</li>
                </ul>
                <Button asChild variant={t === "premium" ? "default" : "outline"}><Link to="/signup">Commencer l'essai</Link></Button>
              </section>
            );
          })}
        </div>

        <section className="border rounded-md bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Recharges IA</h2>
          <p className="text-sm text-muted-foreground mt-1">Achat ponctuel si le budget IA mensuel est dépassé.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {TOPUPS.map((x) => <span key={x.priceId} className="border rounded-sm px-3 py-1.5 text-sm tabular-nums">{formatEur(x.amount)}</span>)}
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          <SellerAddress /> — paiement sécurisé par Paddle.com, revendeur et Merchant of Record. Remboursement possible
          sous 30 jours — voir la <Link to="/remboursement" className="underline">politique de remboursement</Link> et
          les <Link to="/cgv" className="underline">CGV</Link>.
        </p>

      </main>
      <Footer />
    </div>
  );
}
