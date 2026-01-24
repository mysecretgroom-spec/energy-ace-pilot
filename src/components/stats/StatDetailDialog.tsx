import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export interface StatDetailItem {
  id: string;
  label: string;
  sublabel?: string;
  value?: number;
  valueLabel?: string;
  date?: string;
  status?: string;
  statusColor?: string;
  navigateTo?: string;
}

interface StatDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  items: StatDetailItem[];
  total?: number;
  totalLabel?: string;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
}

export function StatDetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  total,
  totalLabel = "Total",
  emptyMessage = "Aucun élément",
  formatValue = (v) => `${v.toLocaleString("fr-FR")} €`,
}: StatDetailDialogProps) {
  const navigate = useNavigate();

  const handleItemClick = (item: StatDetailItem) => {
    if (item.navigateTo) {
      onOpenChange(false);
      navigate(item.navigateTo);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            {total !== undefined && (
              <Badge variant="secondary" className="text-base font-bold">
                {formatValue(total)}
              </Badge>
            )}
          </DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border bg-card ${
                    item.navigateTo ? "cursor-pointer hover:bg-accent transition-colors" : ""
                  }`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-sm text-muted-foreground truncate">{item.sublabel}</p>
                      )}
                      {item.date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(item.date), "d MMM yyyy", { locale: fr })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {item.value !== undefined && (
                        <span className="font-semibold text-primary whitespace-nowrap">
                          {item.valueLabel || formatValue(item.value)}
                        </span>
                      )}
                      {item.status && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={item.statusColor ? { 
                            borderColor: item.statusColor, 
                            color: item.statusColor 
                          } : undefined}
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {total !== undefined && items.length > 0 && (
          <div className="pt-3 border-t mt-2">
            <div className="flex items-center justify-between font-semibold">
              <span>{totalLabel} ({items.length} éléments)</span>
              <span className="text-primary text-lg">{formatValue(total)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
