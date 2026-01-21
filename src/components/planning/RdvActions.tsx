import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Phone, FileText, FolderOpen, Calculator, MessageCircle } from "lucide-react";
import { NavigationButton } from "./NavigationButton";

interface RdvActionsProps {
  rdvId: string;
  clientId: string;
  clientPhone?: string;
  address: string;
  city?: string;
  postalCode?: string;
}

export function RdvActions({ 
  rdvId, 
  clientId, 
  clientPhone, 
  address,
  city,
  postalCode 
}: RdvActionsProps) {
  const navigate = useNavigate();

  const handleCall = () => {
    if (clientPhone) {
      window.open(`tel:${clientPhone}`, "_self");
    }
  };

  const handleWhatsApp = () => {
    if (clientPhone) {
      const cleanPhone = clientPhone.replace(/\D/g, "");
      const frPhone = cleanPhone.startsWith("0") ? `33${cleanPhone.slice(1)}` : cleanPhone;
      window.open(`https://wa.me/${frPhone}`, "_blank");
    }
  };

  const handleOpenClient = () => {
    navigate(`/clients/${clientId}`);
  };

  const handleNewEtude = () => {
    navigate(`/etude/new?clientId=${clientId}&rdvId=${rdvId}`);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Appeler */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={handleCall}
        disabled={!clientPhone}
        title="Appeler"
      >
        <Phone className="h-4 w-4" />
      </Button>

      {/* WhatsApp */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={handleWhatsApp}
        disabled={!clientPhone}
        title="WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>

      {/* Navigation GPS */}
      <NavigationButton 
        address={address} 
        city={city} 
        postalCode={postalCode} 
      />

      {/* Fiche client */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={handleOpenClient}
        title="Dossier client"
      >
        <FolderOpen className="h-4 w-4" />
      </Button>

      {/* Nouvelle étude */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={handleNewEtude}
        title="Nouvelle étude"
      >
        <Calculator className="h-4 w-4" />
      </Button>
    </div>
  );
}
