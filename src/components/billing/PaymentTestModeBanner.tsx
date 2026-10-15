import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full rounded-md border border-accent bg-accent/20 px-4 py-2 text-center text-xs text-foreground">
      Paiements en mode test dans l'aperçu : aucun débit réel.{" "}
      <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer" className="underline font-medium">
        En savoir plus
      </a>
    </div>
  );
}
