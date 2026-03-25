import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RdvType = "standard" | "external_installation";

interface UseRdvActionsOptions {
  onRefresh?: () => void;
  onBeforeNavigate?: () => void;
}

/**
 * Shared hook for all RDV-related actions.
 * Used by RdvActions, RdvContextMenu, and RdvQuickActions
 * to ensure consistent behavior across the app.
 */
export function useRdvActions(options: UseRdvActionsOptions = {}) {
  const navigate = useNavigate();
  const [switchingType, setSwitchingType] = useState(false);

  // --- Navigation ---

  const navigateTo = (path: string) => {
    options.onBeforeNavigate?.();
    navigate(path);
  };

  const openClient = (clientId: string) => {
    navigateTo(`/clients/${clientId}`);
  };

  const openClientDocuments = (clientId: string) => {
    navigateTo(`/clients/${clientId}?tab=documents`);
  };

  const openNewEtude = (clientId: string, rdvId: string) => {
    navigateTo(`/etude/new?clientId=${clientId}&rdvId=${rdvId}`);
  };

  // --- Communication ---

  const callPhone = (phone?: string | null) => {
    if (phone) {
      window.open(`tel:${phone}`, "_self");
    }
  };

  const openWhatsApp = (phone?: string | null) => {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const frPhone = cleanPhone.startsWith("0")
        ? `33${cleanPhone.slice(1)}`
        : cleanPhone;
      window.open(`https://wa.me/${frPhone}`, "_blank");
    }
  };

  // --- GPS Navigation ---

  const buildEncodedAddress = (
    address?: string,
    postalCode?: string,
    city?: string
  ) => {
    const full = [address, postalCode, city].filter(Boolean).join(",");
    return encodeURIComponent(full);
  };

  const openWaze = (address?: string, postalCode?: string, city?: string, latitude?: number, longitude?: number) => {
    const encoded = buildEncodedAddress(address, postalCode, city);
    if (latitude && longitude) {
      window.open(`https://waze.com/ul?ll=${latitude},${longitude}&q=${encoded}&navigate=yes`, "_blank");
    } else {
      window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, "_blank");
    }
  };

  const openGoogleMaps = (
    address?: string,
    postalCode?: string,
    city?: string
  ) => {
    const encoded = buildEncodedAddress(address, postalCode, city);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      "_blank"
    );
  };

  const openAppleMaps = (
    address?: string,
    postalCode?: string,
    city?: string
  ) => {
    const encoded = buildEncodedAddress(address, postalCode, city);
    window.open(`https://maps.apple.com/?q=${encoded}`, "_blank");
  };

  // --- RDV Type Switch ---

  const switchRdvType = async (rdvId: string, newType: RdvType) => {
    setSwitchingType(true);
    try {
      const { error } = await supabase
        .from("rdv")
        .update({ type_rdv: newType })
        .eq("id", rdvId);

      if (error) throw error;

      toast.success(
        newType === "external_installation"
          ? "Marqué comme installation externe"
          : "Marqué comme RDV standard"
      );
      options.onRefresh?.();
    } catch (err) {
      console.error("Error switching type:", err);
      toast.error("Erreur lors du changement de type");
    } finally {
      setSwitchingType(false);
    }
  };

  const toggleExternalType = async (
    rdvId: string,
    currentType: RdvType
  ) => {
    const newType =
      currentType === "external_installation"
        ? "standard"
        : "external_installation";
    await switchRdvType(rdvId, newType);
  };

  return {
    // Navigation
    navigateTo,
    openClient,
    openClientDocuments,
    openNewEtude,
    // Communication
    callPhone,
    openWhatsApp,
    // GPS
    openWaze,
    openGoogleMaps,
    openAppleMaps,
    // Type switch
    switchRdvType,
    toggleExternalType,
    switchingType,
  };
}
