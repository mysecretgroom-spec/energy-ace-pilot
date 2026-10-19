import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

/** Fine barre de progression en haut de l'écran : changements de page et chargements de données. */
export function TopLoadingBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const location = useLocation();
  const [navPulse, setNavPulse] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setNavPulse(true);
    const t = setTimeout(() => setNavPulse(false), 400);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const active = fetching + mutating > 0 || navPulse;

  useEffect(() => {
    if (active) {
      // Petit délai pour éviter le clignotement sur les chargements instantanés
      const show = setTimeout(() => { setVisible(true); setProgress(15); }, 150);
      const tick = setInterval(() => setProgress((p) => (p < 85 ? p + (90 - p) * 0.12 : p)), 250);
      return () => { clearTimeout(show); clearInterval(tick); };
    }
    setProgress(100);
    const hide = setTimeout(() => { setVisible(false); setProgress(0); }, 300);
    return () => clearTimeout(hide);
  }, [active]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5">
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
