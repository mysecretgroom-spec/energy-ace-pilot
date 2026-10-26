import { Link } from "react-router-dom";
import { ClipboardList, ScanLine, MessageCircle, WifiOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import Tarifs from "@/pages/Tarifs";
import shotEtudes from "@/assets/capture-etudes.jpg";
import shotScanner from "@/assets/capture-scanner.jpg";
import shotWhatsapp from "@/assets/capture-whatsapp.jpg";
import shotOffline from "@/assets/capture-hors-ligne.jpg";

const SCREENS = [
  { src: shotEtudes, label: "Études", alt: "Écran Étude énergétique combinée PV, PAC et ITE" },
  { src: shotScanner, label: "Scanner", alt: "Scanner de documents de l'app en train de cadrer une facture" },
  { src: shotWhatsapp, label: "WhatsApp", alt: "Réglages de l'assistant IA WhatsApp" },
  { src: shotOffline, label: "Hors-ligne", alt: "Planning consultable en mode hors-ligne" },
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Études complètes",
    text: "Photovoltaïque, pompe à chaleur et isolation dans un seul formulaire guidé. Tout ce qui a été dit et vu pendant le rendez-vous est noté : plus besoin de s'en souvenir.",
    points: ["Repérage du toit sur carte satellite", "Contrôle terrain PAC/ITE façade par façade", "Rapport PDF complet en fin de rendez-vous"],
  },
  {
    icon: ScanLine,
    title: "Scanner de documents",
    text: "Factures, avis d'imposition, pièces d'identité : scannez plusieurs pages en rafale, recadrage et correction des ombres automatiques.",
    points: ["Coins ajustables page par page", "Annexes intégrées au PDF de l'étude", "Dossier client classé automatiquement"],
  },
  {
    icon: MessageCircle,
    title: "WhatsApp & assistant IA",
    text: "Le récapitulatif et le PDF partent sur WhatsApp à la régie. Votre assistant personnel répond à vos questions et enregistre vos frais à partir d'une simple photo de ticket.",
    points: ["Récap régie automatique", "Rappels et briefing du matin", "Saisie des frais simplifiée"],
  },
  {
    icon: WifiOff,
    title: "Fonctionne hors ligne",
    text: "Pas de réseau chez le client ? Continuez votre rendez-vous : les données sont enregistrées sur l'appareil puis synchronisées dès le retour de la connexion.",
    points: ["Planning et fiches clients disponibles", "Aucune saisie perdue", "Application installable sur mobile"],
  },
];

export default function Accueil() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <span className="font-display font-semibold text-foreground">DébalePro</span>
          <nav className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="#tarifs">Tarifs</a></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/login">Se connecter</Link></Button>
            <Button asChild size="sm"><Link to="/signup">Essai gratuit</Link></Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 pt-12 pb-10 grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <p className="text-sm font-medium text-primary">Pour les commerciaux en rénovation énergétique</p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
              Votre rendez-vous noté, chiffré et envoyé avant même de remonter en voiture.
            </h1>
            <p className="text-lg text-muted-foreground">
              DébalePro réunit études, scanner, planning et récap WhatsApp dans une seule application, même sans réseau.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/signup">Essayer 10 jours gratuits</Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#fonctionnalites">Découvrir</a></Button>
            </div>
            <p className="text-xs text-muted-foreground">Sans engagement · Résiliable à tout moment</p>
          </div>
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            {SCREENS.map(({ src, label, alt }) => (
              <figure key={label} className="space-y-1.5">
                <img src={src} alt={alt} width={600} height={1200} loading="eager" className="w-full rounded-lg border bg-card shadow-md" />
                <figcaption className="text-center text-xs font-medium text-muted-foreground">{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="fonctionnalites" className="border-t bg-muted/40">
          <div className="max-w-5xl mx-auto px-4 py-14 space-y-10">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="font-display text-3xl font-semibold tracking-tight">Tout le rendez-vous, dans votre poche</h2>
              <p className="text-muted-foreground">Quatre outils pensés pour le terrain, qui travaillent ensemble.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text, points }) => (
                <article key={title} className="rounded-lg border bg-card p-6 space-y-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></div>
                  <h3 className="font-display text-xl font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                  <ul className="space-y-1.5 text-sm">
                    {points.map((p) => <li key={p} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{p}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t">
          <Tarifs embedded />
        </section>
      </main>
      <Footer />
    </div>
  );
}
