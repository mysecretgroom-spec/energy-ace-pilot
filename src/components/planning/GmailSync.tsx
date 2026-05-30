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

type SkipCategory = "mise_a_jour" | "doublon" | "expediteur" | "regie" | "vide" | "autre";

function categorizeSkip(error?: string): { label: string; tone: string } {
  const e = (error || "").toLowerCase();
  if (e.includes("mise à jour") || e.includes("mise a jour") || e.includes("statut"))
    return { label: "Mise à jour de statut", tone: "bg-blue-100 text-blue-700 border-blue-200" };
  if (e.includes("existant") || e.includes("doublon") || e.includes("déjà"))
    return { label: "Doublon / RDV existant", tone: "bg-amber-100 text-amber-700 border-amber-200" };
  if (e.includes("non autoris") || e.includes("unauthorized"))
    return { label: "Expéditeur non autorisé", tone: "bg-rose-100 text-rose-700 border-rose-200" };
  if (e.includes("régie") || e.includes("regie"))
    return { label: "Aucune régie associée", tone: "bg-purple-100 text-purple-700 border-purple-200" };
  if (e.includes("vide") || e.includes("empty"))
    return { label: "Email vide", tone: "bg-slate-100 text-slate-700 border-slate-200" };
  if (e.includes("newsletter") || e.includes("admin") || e.includes("ignore"))
    return { label: "Non lié à un RDV", tone: "bg-slate-100 text-slate-700 border-slate-200" };
  return { label: error || "Ignoré", tone: "bg-slate-100 text-slate-700 border-slate-200" };
}

function SyncResultContent({
  result,
  onClose
}: {
  result: GmailSyncResult | null;
  onClose: () => void;
}) {
  if (!result) return null;

  const hasErrors = result.errors > 0;
  const skipped = result.details.filter((d) => d.status === "skipped");
  const errors = result.details.filter((d) => d.status === "error");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Résultat de la synchronisation</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
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

      {skipped.length > 0 && (
        <div className="border-t pt-3 max-h-60 overflow-y-auto space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Emails ignorés ({skipped.length}) — raison :
          </p>
          <ul className="space-y-1.5">
            {skipped.map((detail, i) => {
              const { label, tone } = categorizeSkip(detail.error);
              return (
                <li key={i} className="text-xs rounded-md border bg-muted/30 p-2 space-y-1">
                  <div className="font-medium truncate">{detail.subject || detail.sender}</div>
                  {detail.sender && detail.subject && (
                    <div className="text-[10px] text-muted-foreground truncate">{detail.sender}</div>
                  )}
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${tone}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="border-t pt-3 space-y-1">
          <p className="text-xs font-medium text-destructive">Erreurs :</p>
          <ul className="space-y-1 text-xs">
            {errors.map((detail, i) => (
              <li key={i} className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="truncate flex-1">
                  {detail.subject || detail.sender}
                  {detail.error && <span> — {detail.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.imported === 0 && result.updated === 0 && skipped.length === 0 && !hasErrors && result.message && (
        <p className="text-sm text-muted-foreground">{result.message}</p>
      )}
    </div>
  );
}
