import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, FolderOpen, Clock, MapPin } from "lucide-react";
import { NavigationButton } from "./NavigationButton";
import { RdvStatusSelector } from "./RdvStatusSelector";
import { RdvStatus } from "@/components/ui/status-badge";
import { useRdvActions } from "@/hooks/useRdvActions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface RdvQuickActionsProps {
  rdvId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  time: string;
  address: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  currentStatus: RdvStatus;
  etudeId?: string | null;
  regieId?: string | null;
  rdvDate?: Date | string | null;
  onStatusChange?: (newStatus: RdvStatus) => void;
  children: React.ReactNode;
}

export function RdvQuickActions({
  rdvId,
  clientId,
  clientName,
  clientPhone,
  time,
  address,
  city,
  postalCode,
  latitude,
  longitude,
  currentStatus,
  etudeId,
  regieId,
  rdvDate,
  onStatusChange,
  children,
}: RdvQuickActionsProps) {
  const { callPhone, openWhatsApp, openClient } = useRdvActions();

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Header with client info */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm truncate">{clientName}</h4>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{time}</span>
            </div>
            {(address || city) && (
              <div className="flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">
                  {[address, postalCode, city].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Status selector */}
          <div className="pt-2 border-t">
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Statut du RDV
            </label>
            <RdvStatusSelector
              rdvId={rdvId}
              currentStatus={currentStatus}
              clientName={clientName}
              clientId={clientId}
              etudeId={etudeId}
              regieId={regieId}
              rdvDate={rdvDate}
              onStatusChange={onStatusChange}
            />
          </div>

          {/* Quick actions */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => callPhone(clientPhone)}
                disabled={!clientPhone}
                title="Appeler"
              >
                <Phone className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => openWhatsApp(clientPhone)}
                disabled={!clientPhone}
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
              <NavigationButton
                address={address}
                city={city}
                postalCode={postalCode}
                latitude={latitude}
                longitude={longitude}
                size="sm"
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => openClient(clientId)}
                title="Dossier client"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
