import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ClipboardList, ScanLine, MessageCircle, WifiOff, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import Tarifs from "@/pages/Tarifs";
import { VisitorButton } from "@/components/auth/VisitorButton";
import shotEtudes from "@/assets/capture-etudes.jpg";
import shotScanner from "@/assets/capture-scanner.jpg";
import shotWhatsapp from "@/assets/capture-whatsapp.jpg";
import shotOffline from "@/assets/capture-hors-ligne.jpg";

const FEATURES = [
  {
    icon: ClipboardList, tag: "En rendez-vous", title: "Études complètes", img: shotEtudes,
    alt: "Écran Étude énergétique combinée PV, PAC et ITE",
    text: "Photovoltaïque, pompe à chaleur et isolation dans un seul formulaire guidé. Tout ce qui a été dit et vu pendant le rendez-vous est noté.",
    points: ["Repérage du toit sur carte satellite", "Contrôle terrain PAC/ITE façade par façade", "Rapport PDF complet en fin de rendez-vous"],
  },
  {
    icon: ScanLine, tag: "Sur le terrain", title: "Scanner de documents", img: shotScanner,
    alt: "Scanner de documents cadrant une facture",
    text: "Factures, avis d'imposition, pièces d'identité : scannez plusieurs pages en rafale, recadrage et correction des ombres automatiques.",
    points: ["Coins ajustables page par page", "Annexes intégrées au PDF de l'étude", "Dossier client classé automatiquement"],
  },
  {
    icon: MessageCircle, tag: "Après la visite", title: "WhatsApp & assistant IA", img: shotWhatsapp,
    alt: "Réglages de l'assistant IA WhatsApp",
    text: "Le récapitulatif et le PDF partent sur WhatsApp à la régie. Votre assistant enregistre vos frais à partir d'une simple photo de ticket.",
    points: ["Récap régie automatique", "Rappels et briefing du matin", "Saisie des frais simplifiée"],
  },
  {
    icon: WifiOff, tag: "Sans réseau", title: "Fonctionne hors ligne", img: shotOffline,
    alt: "Planning consultable hors ligne",
    text: "Pas de réseau chez le client ? Continuez : les données restent sur l'appareil puis se synchronisent dès le retour de la connexion.",
    points: ["Planning et fiches clients disponibles", "Aucune saisie perdue", "Application installable sur mobile"],
  },
];

const STEPS = [
  { n: "01", t: "Étude guidée", d: "Saisie au fil de la visite, calculs automatiques." },
  { n: "02", t: "Pièces scannées", d: "Documents du client ajoutés au dossier." },
  { n: "03", t: "Récap envoyé", d: "PDF et récapitulatif partent à la régie." },
];

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative rounded-[2rem] border border-border bg-foreground/90 p-1.5 ${className}`}>
      <div className="overflow-hidden rounded-[1.6rem] bg-card ring-1 ring-primary/20">
        <img src={src} alt={alt} width={600} height={1200} loading="lazy" decoding="async" className="block w-full aspect-[1/2] object-cover object-top" />
      </div>
    </div>
  );
}

export default function Accueil() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const yBack = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -40]);
  const yFront = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 30]);

  const reveal = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] as const } },
  };
  const stagger = { hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : 0.1 } } };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="border-b border-border/70 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <span className="font-display font-bold text-foreground">Débale<span className="text-primary">Pro</span></span>
          <nav className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="#fonctionnalites">Fonctionnalités</a></Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="#tarifs">Tarifs</a></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/login">Se connecter</Link></Button>
            <Button asChild size="sm"><Link to="/essai-gratuit">Essai gratuit</Link></Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute top-40 -left-32 h-[22rem] w-[22rem] rounded-full bg-secondary blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:22px_22px] opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          </div>
          <div className="max-w-6xl mx-auto px-4 pt-14 pb-16 md:pt-24 md:pb-24 grid gap-12 md:grid-cols-[1.1fr_1fr] md:items-center">
            <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="visible">
              <motion.p variants={reveal} className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Commerciaux en rénovation énergétique
              </motion.p>
              <motion.h1 variants={reveal} className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground">
                Votre rendez-vous <span className="text-primary">noté, chiffré et envoyé</span>
                <span className="block text-muted-foreground font-semibold text-3xl md:text-4xl mt-3">avant de remonter en voiture.</span>
              </motion.h1>
              <motion.p variants={reveal} className="text-lg leading-8 text-muted-foreground max-w-xl">
                Études, scanner, planning et récap WhatsApp réunis dans une seule application, même sans réseau.
              </motion.p>
              <motion.div variants={reveal} className="flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/essai-gratuit">Essayer 10 jours gratuits <ArrowRight className="h-4 w-4" /></Link></Button>
                <VisitorButton size="lg" variant="outline" />
              </motion.div>
              <motion.ul variants={reveal} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["Sans engagement", "Mode visiteur sans compte", "Données fictives en démo"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" />{t}</li>
                ))}
              </motion.ul>
            </motion.div>

            <div className="relative mx-auto h-[26rem] w-full max-w-md md:h-[34rem]">
              <motion.div style={{ y: yBack }} className="absolute left-0 top-10 w-[42%] -rotate-6"
                initial={{ opacity: 0, x: reduce ? 0 : -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduce ? 0 : 0.8, delay: 0.25 }}>
                <Phone src={shotScanner} alt="Scanner de documents" />
              </motion.div>
              <motion.div style={{ y: yBack }} className="absolute right-0 top-10 w-[42%] rotate-6"
                initial={{ opacity: 0, x: reduce ? 0 : 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduce ? 0 : 0.8, delay: 0.35 }}>
                <Phone src={shotWhatsapp} alt="Assistant WhatsApp" />
              </motion.div>
              <motion.div style={{ y: yFront }} className="absolute left-[25%] top-0 w-[50%] z-10"
                initial={{ opacity: 0, y: reduce ? 0 : 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.8, delay: 0.1 }}>
                <Phone src={shotEtudes} alt="Étude énergétique combinée" />
              </motion.div>
              <motion.div className="absolute -bottom-2 left-2 z-20 flex items-center gap-2 rounded-xl border bg-card/95 backdrop-blur px-3 py-2 text-xs font-medium"
                initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.9 }}>
                <WifiOff className="h-4 w-4 text-primary" /> Fonctionne hors ligne
              </motion.div>
              <motion.div className="absolute bottom-16 right-0 z-20 flex items-center gap-2 rounded-xl border bg-card/95 backdrop-blur px-3 py-2 text-xs font-medium"
                initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 1.05 }}>
                <MessageCircle className="h-4 w-4 text-primary" /> Récap envoyé à la régie
              </motion.div>
            </div>
          </div>
        </section>

        {/* ÉTAPES */}
        <section className="border-y bg-primary text-primary-foreground">
          <motion.div className="max-w-6xl mx-auto px-4 py-10 grid gap-6 sm:grid-cols-3"
            variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}>
            {STEPS.map((s) => (
              <motion.div key={s.n} variants={reveal} className="flex gap-4">
                <span className="font-display text-3xl font-bold text-primary-foreground/50">{s.n}</span>
                <div><p className="font-semibold">{s.t}</p><p className="text-sm text-primary-foreground/80">{s.d}</p></div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* FONCTIONNALITÉS en zigzag */}
        <section id="fonctionnalites" className="bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 py-20 md:py-24 space-y-20 md:space-y-28">
            <motion.div className="text-center space-y-3 max-w-2xl mx-auto" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Fonctionnalités</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.02em]">Tout le rendez-vous, dans votre poche</h2>
              <p className="text-muted-foreground">Quatre outils pensés pour le terrain, qui travaillent ensemble.</p>
            </motion.div>

            {FEATURES.map(({ icon: Icon, tag, title, text, points, img, alt }, i) => (
              <motion.article key={title} className="grid gap-10 md:grid-cols-2 md:items-center"
                variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }}>
                <motion.div variants={reveal} className={`space-y-4 ${i % 2 ? "md:order-2" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></div>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tag}</span>
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">{title}</h3>
                  <p className="text-muted-foreground leading-7">{text}</p>
                  <ul className="space-y-2 text-sm">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2.5 items-start">
                        <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-primary" /></span>{p}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div variants={reveal} className={`relative flex justify-center ${i % 2 ? "md:order-1" : ""}`}>
                  <div aria-hidden className="absolute inset-x-8 inset-y-6 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-secondary to-transparent blur-2xl" />
                  <div className="relative rounded-[2.5rem] border bg-card/60 p-6 md:p-8">
                    <Phone src={img} alt={alt} className="w-48 md:w-56" />
                  </div>
                </motion.div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="border-t">
          <Tarifs embedded />
        </section>

        {/* CTA final */}
        <section className="px-4 pb-20">
          <motion.div className="max-w-6xl mx-auto rounded-3xl bg-primary text-primary-foreground px-6 py-14 text-center space-y-5 relative overflow-hidden"
            variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div aria-hidden className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary-foreground/10 blur-2xl" />
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.02em] relative">Prêt pour votre prochain rendez-vous ?</h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto relative">10 jours d'essai gratuit, sans engagement.</p>
            <div className="flex flex-wrap justify-center gap-3 relative">
              <Button asChild size="lg" variant="secondary"><Link to="/essai-gratuit">Commencer l'essai <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
