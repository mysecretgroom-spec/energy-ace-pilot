import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Delta({ value, suffix = "%", invert = false }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null || !isFinite(value)) return <span className="text-xs text-muted-foreground">—</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
      value === 0 ? "text-muted-foreground" : good ? "text-primary" : "text-destructive")}>
      <Icon className="h-3 w-3" />{Math.abs(value).toFixed(value % 1 === 0 ? 0 : 1)}{suffix}
    </span>
  );
}

export function MetricTile({ label, value, sub, delta, loading, children, onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; loading?: boolean; children?: ReactNode; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={cn("bg-card p-5 flex flex-col gap-2 min-w-0", onClick && "cursor-pointer hover:bg-muted/40 transition-colors duration-100")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{label}</span>
        {delta}
      </div>
      {loading ? <Skeleton className="h-8 w-28" /> : (
        <span className="font-display text-2xl md:text-[28px] font-semibold tabular-nums tracking-tight text-foreground leading-none">{value}</span>
      )}
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      {children}
    </div>
  );
}

export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-px bg-border border rounded-md overflow-hidden", className)}>{children}</div>;
}

export function Panel({ title, description, actions, children, className, bodyClassName }: {
  title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("bg-card border rounded-md min-w-0", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground border-border",
    good: "bg-primary/10 text-primary border-primary/20",
    info: "bg-accent text-accent-foreground border-border",
    warn: "bg-warning/10 text-warning border-warning/30",
    bad: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

export const eur = (n: number, digits = 0) =>
  (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits });
export const num = (n: number) => (n || 0).toLocaleString("fr-FR");
export const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
