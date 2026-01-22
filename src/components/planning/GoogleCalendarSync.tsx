import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { useGoogleCalendarSync } from "@/hooks/useGoogleCalendarSync";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GoogleCalendarSyncProps {
  onSyncComplete?: () => void;
}

export function GoogleCalendarSync({ onSyncComplete }: GoogleCalendarSyncProps) {
  const { syncing, lastSync, syncCalendar, checkGoogleConnection } = useGoogleCalendarSync();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkGoogleConnection().then(setIsConnected);
  }, [checkGoogleConnection]);

  const handleSync = async () => {
    const result = await syncCalendar({ daysAhead: 30, daysBefore: 7 });
    if (result?.success) {
      onSyncComplete?.();
    }
  };

  if (isConnected === null) {
    return null; // Loading state
  }

  if (!isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Calendar className="h-4 w-4" />
              <AlertCircle className="h-3 w-3 text-amber-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Google Calendar non connecté</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            {lastSync && <CheckCircle className="h-3 w-3 text-green-500" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {syncing
              ? "Synchronisation en cours..."
              : lastSync
              ? `Dernière sync: ${lastSync.toLocaleTimeString("fr-FR")}`
              : "Synchroniser avec Google Calendar"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
