import { cn } from "@/lib/utils";

export type RdvStatus =
  | "nouveau"
  | "reporte"
  | "r2"
  | "r2_prestudy"
  | "signe"
  | "negatif"
  | "annule"
  | "porte";

interface StatusBadgeProps {
  status: RdvStatus;
  className?: string;
}

const statusConfig: Record<
  RdvStatus,
  { label: string; className: string }
> = {
  nouveau: {
    label: "Nouveau",
    className: "badge-new",
  },
  reporte: {
    label: "Reporté",
    className: "badge-reported",
  },
  r2: {
    label: "R2",
    className: "badge-r2",
  },
  r2_prestudy: {
    label: "R2 Pré-étude",
    className: "badge-r2-prestudy",
  },
  signe: {
    label: "Signé",
    className: "badge-signed",
  },
  negatif: {
    label: "Négatif",
    className: "badge-negative",
  },
  annule: {
    label: "Annulé",
    className: "badge-cancelled",
  },
  porte: {
    label: "Porte",
    className: "badge-cancelled",
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
