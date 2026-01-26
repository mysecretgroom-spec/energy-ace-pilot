import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Mail, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { useGmailSync, GmailSyncResult, GmailSyncOptions } from "@/hooks/useGmailSync";
import { useNavigate } from "react-router-dom";
import { GmailSyncDialog } from "./GmailSyncDialog";

interface GmailSyncProps {
  onSyncComplete?: () => void;
  variant?: "ghost" | "outline" | "default";
}

export function GmailSync({ onSyncComplete, variant = "ghost" }: GmailSyncProps) {
  const navigate = useNavigate();
  const { syncing, lastResult, syncGmail, checkGoogleConnection, checkAuthorizedEmails } = useGmailSync();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [hasAuthorizedEmails, setHasAuthorizedEmails] = useState<boolean | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  useEffect(() => {
    const check = async () => {
      const connected = await checkGoogleConnection();
      setIsConnected(connected);
      if (connected) {
        const hasEmails = await checkAuthorizedEmails();
        setHasAuthorizedEmails(hasEmails);
      }
    };
    check();
  }, [checkGoogleConnection, checkAuthorizedEmails]);

  const handleSync = async (options: GmailSyncOptions) => {
    const result = await syncGmail(options);
    if (result && (result.imported > 0 || result.updated > 0)) {
      onSyncComplete?.();
    }
    if (result) {
      setShowPopover(true);
    }
  };

  // Loading state
  if (isConnected === null) {
    return (
      <Button variant={variant} size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  // Not connected to Google
  if (!isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size="icon"
              className="text-muted-foreground relative"
              onClick={() => navigate("/parametres")}
            >
              <Mail className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Connectez votre compte Google dans les paramètres</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No authorized emails configured
  if (!hasAuthorizedEmails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size="icon"
              className="text-amber-500 relative"
              onClick={() => navigate("/parametres/regies")}
            >
              <Mail className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Configurez les emails autorisés</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            onClick={() => setShowSyncDialog(true)}
            disabled={syncing}
            className="relative"
          >
            {syncing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mail className="h-5 w-5" />
            )}
            {lastResult && !syncing && (
              <span className="absolute -top-1 -right-1">
                {lastResult.imported + lastResult.updated > 0 ? (
                  <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px] bg-green-500">
                    {lastResult.imported + lastResult.updated}
                  </Badge>
                ) : lastResult.errors > 0 ? (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                    !
                  </Badge>
                ) : null}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <SyncResultContent result={lastResult} onClose={() => setShowPopover(false)} />
        </PopoverContent>
      </Popover>

      <GmailSyncDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        onSync={handleSync}
        syncing={syncing}
      />
    </>
  );
}

function SyncResultContent({ 
  result, 
  onClose 
}: { 
  result: GmailSyncResult | null;
  onClose: () => void;
}) {
  if (!result) return null;

  const hasSuccess = result.imported > 0 || result.updated > 0;
  const hasErrors = result.errors > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Résultat de la synchronisation</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          <span>{result.imported} importé(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-blue-500" />
          <span>{result.updated} mis à jour</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-4 w-4 text-center">—</span>
          <span>{result.skipped} ignoré(s)</span>
        </div>
        {hasErrors && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{result.errors} erreur(s)</span>
          </div>
        )}
      </div>

      {result.details.length > 0 && (
        <div className="border-t pt-3 max-h-40 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Détails :</p>
          <ul className="space-y-1 text-xs">
            {result.details.slice(0, 5).map((detail, i) => (
              <li key={i} className="flex items-start gap-2">
                {detail.status === "imported" && <Check className="h-3 w-3 text-green-500 mt-0.5" />}
                {detail.status === "updated" && <RefreshCw className="h-3 w-3 text-blue-500 mt-0.5" />}
                {detail.status === "error" && <AlertCircle className="h-3 w-3 text-destructive mt-0.5" />}
                {detail.status === "skipped" && <span className="h-3 w-3 text-center">—</span>}
                <span className="truncate flex-1">
                  {detail.subject || detail.sender}
                  {detail.error && <span className="text-destructive"> - {detail.error}</span>}
                </span>
              </li>
            ))}
            {result.details.length > 5 && (
              <li className="text-muted-foreground">
                ...et {result.details.length - 5} autre(s)
              </li>
            )}
          </ul>
        </div>
      )}

      {!hasSuccess && !hasErrors && result.message && (
        <p className="text-sm text-muted-foreground">{result.message}</p>
      )}
    </div>
  );
}
