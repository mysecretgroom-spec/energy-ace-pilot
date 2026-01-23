import { useBackgroundJobs } from "@/hooks/useBackgroundJobs";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const jobTypeLabels: Record<string, string> = {
  document_analysis: "Analyse document",
  receipt_ocr: "OCR justificatif",
  bouquet_extraction: "Extraction bouquets",
};

export function BackgroundJobsIndicator() {
  const { pendingJobs, pendingCount } = useBackgroundJobs();

  if (pendingCount === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-2 text-muted-foreground hover:text-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Traitement</span>
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
            {pendingCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Tâches en arrière-plan</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Ces tâches continuent même si vous fermez l'app
          </p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-2">
            {pendingJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                {job.status === "processing" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {jobTypeLabels[job.job_type] || job.job_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.status === "processing" ? "En cours..." : "En attente"}
                    {job.attempts > 1 && ` (tentative ${job.attempts})`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(job.created_at), "HH:mm", { locale: fr })}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
