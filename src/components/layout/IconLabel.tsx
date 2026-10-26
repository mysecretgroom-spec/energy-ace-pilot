import type { ReactNode } from "react";

/** Icon button with a short visible caption, so header/toolbar icons are self-explanatory. */
export function IconLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center leading-none">
      {children}
      <span className="text-xs text-muted-foreground -mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}
