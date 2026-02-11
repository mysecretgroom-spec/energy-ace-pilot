import { useCallback } from "react";

/**
 * Preload a lazy-loaded route chunk on hover/touch
 * to eliminate navigation delay.
 */
const routeModules: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Dashboard"),
  "/planning": () => import("@/pages/Planning"),
  "/crm": () => import("@/pages/CRM"),
  "/finance": () => import("@/pages/Finance"),
  "/parametres": () => import("@/pages/Parametres"),
};

const prefetched = new Set<string>();

export function useRoutePrefetch() {
  const prefetch = useCallback((path: string) => {
    if (prefetched.has(path)) return;
    const loader = routeModules[path];
    if (loader) {
      prefetched.add(path);
      loader();
    }
  }, []);

  return prefetch;
}
