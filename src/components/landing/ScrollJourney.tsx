import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Feature = {
  icon: LucideIcon;
  tag: string;
  title: string;
  img: string;
  alt: string;
  text: string;
  points: string[];
};

function FeatureScene({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <div className="mx-auto grid w-full max-w-5xl items-center gap-4 px-6 py-4 md:grid-cols-2 md:gap-12 md:px-12">
      <div className="space-y-3 md:space-y-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Icon className="h-4 w-4" />{feature.tag}</p>
        <h3 className="font-display text-2xl font-bold leading-tight md:text-4xl">{feature.title}</h3>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground md:text-base md:leading-7">{feature.text}</p>
        <ul className="hidden space-y-2 text-sm md:block">
          {feature.points.map(point => <li key={point} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{point}</li>)}
        </ul>
      </div>
      <div className="relative flex min-h-0 justify-center">
        <span aria-hidden className="absolute left-0 top-0 font-display text-7xl font-bold text-primary/10 md:text-9xl">0{index + 1}</span>
        <div className="relative w-auto max-w-[65%] overflow-hidden rounded-[1.8rem] border-4 border-foreground bg-card ring-1 ring-border">
          <img src={feature.img} alt={feature.alt} width={600} height={1200} loading="lazy" decoding="async" className="block h-[min(34svh,320px)] w-auto object-contain md:h-[min(60svh,600px)]" />
        </div>
      </div>
    </div>
  );
}

/** Native vertical scrolling drives a reversible camera across a four-scene canvas. */
export function ScrollJourney({ features }: { features: Feature[] }) {
  const section = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  // Readable pauses alternate with lateral and vertical travel.
  const stops = [0, 0.13, 0.29, 0.40, 0.58, 0.69, 0.87, 1];
  const x = useTransform(scrollYProgress, stops, ["0%", "0%", "-50%", "-50%", "-50%", "-50%", "0%", "0%"]);
  const y = useTransform(scrollYProgress, stops, ["0%", "0%", "0%", "0%", "-50%", "-50%", "-50%", "-50%"]);
  useMotionValueEvent(scrollYProgress, "change", value => {
    setActive(value < 0.21 ? 0 : value < 0.49 ? 1 : value < 0.78 ? 2 : 3);
  });

  const goTo = (index: number) => {
    const element = section.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY;
    const travel = element.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + [0.06, 0.35, 0.63, 0.94][index] * travel, behavior: "smooth" });
  };

  if (reduce) {
    return <section id="fonctionnalites" className="scroll-mt-16 border-y bg-muted/30">
      {features.map((feature, index) => <article key={feature.title} className="border-b py-10"><FeatureScene feature={feature} index={index} /></article>)}
    </section>;
  }

  const positions = ["col-start-1 row-start-1", "col-start-2 row-start-1", "col-start-2 row-start-2", "col-start-1 row-start-2"];
  const Direction = active === 0 ? ArrowRight : active === 1 ? ArrowDown : active === 2 ? ArrowLeft : ArrowDown;

  return (
    <section ref={section} id="fonctionnalites" aria-label="Les outils DébalePro" className="relative h-[440svh] scroll-mt-14 border-y bg-muted/30">
      <div className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 px-6 md:px-12">
          <h2 className="text-sm font-semibold">Tout le rendez-vous, dans votre poche</h2>
          <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-primary" aria-hidden>0{active + 1} / 04 <Direction className="h-4 w-4" /></span>
        </div>
        <div className="absolute inset-x-0 bottom-16 top-14 overflow-hidden">
          <motion.div style={{ x, y }} className="absolute left-0 top-0 grid h-[200%] w-[200%] grid-cols-2 grid-rows-2 will-change-transform">
            {features.map((feature, index) => (
              <article key={feature.title} aria-label={feature.title} inert={active !== index ? "" : undefined} className={`flex min-h-0 items-center overflow-hidden ${positions[index]} ${index % 2 ? "bg-secondary/40" : "bg-background"}`}>
                <FeatureScene feature={feature} index={index} />
              </article>
            ))}
          </motion.div>
        </div>
        <nav aria-label="Parcours des fonctionnalités" className="absolute inset-x-0 bottom-0 z-10 flex h-16 items-center justify-center gap-1 border-t bg-background/95 px-2 md:gap-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return <Button key={feature.title} variant={active === index ? "default" : "ghost"} size="sm" onClick={() => goTo(index)} aria-label={feature.title} aria-current={active === index ? "step" : undefined} title={feature.title} className="min-w-11 gap-2">
              <Icon className="h-4 w-4" /><span className="hidden md:inline">{feature.title}</span><span className="md:hidden">0{index + 1}</span>
            </Button>;
          })}
        </nav>
      </div>
    </section>
  );
}