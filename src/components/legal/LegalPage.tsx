import { ReactNode } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";

export const SELLER = {
  name: "ALFRED'S AGENCY",
  trading: "DébalePro",
  email: "contact@miweha.com",
  address: "49 rue d'Hauteville, 75010 Paris, France",
};

export function SellerAddress() {
  return (
    <span>
      {SELLER.name} — {SELLER.address}
    </span>
  );
}


export function LegalPage({ title, short, updated, children }: { title: string; short: string; updated: string; children: ReactNode }) {
  return (
    <MobileLayout title={short} showBackButton showNav={false}>
      <div className="p-4 pb-10 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-display font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">Dernière mise à jour : {updated}</p>
        </div>
        {children}
      </div>
    </MobileLayout>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4 space-y-2">
        <h2 className="font-display font-semibold text-foreground">{title}</h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

export function Mail() {
  return <a href={`mailto:${SELLER.email}`} className="text-primary underline">{SELLER.email}</a>;
}
