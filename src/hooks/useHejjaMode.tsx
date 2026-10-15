import { useSaasAccess } from "@/hooks/useSaasAccess";
import { setOfficialLogosEnabled } from "@/lib/officialLogos";
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

interface HejjaModeContextType {
  isActive: boolean;
  /** Premium account (active subscription or beta) allowed to use HEJJA */
  canUseHejja: boolean;
  isAccessLoading: boolean;
  pshEnabled: boolean;
  prixEnabled: boolean;
  prixManuel: number | "";
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  setPshEnabled: (enabled: boolean) => void;
  setPrixEnabled: (enabled: boolean) => void;
  setPrixManuel: (prix: number | "") => void;
}

const HejjaModeContext = createContext<HejjaModeContextType | null>(null);

export function HejjaModeProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [pshEnabled, setPshEnabled] = useState(true);
  const [prixEnabled, setPrixEnabled] = useState(false);
  const [prixManuel, setPrixManuel] = useState<number | "">("");
  const { isPremium, isLoading: isAccessLoading } = useSaasAccess();
  const canUseHejja = isPremium;

  // Force-off when the account loses premium rights
  useEffect(() => {
    if (!isAccessLoading && !canUseHejja && isActive) {
      setIsActive(false);
      setPrixEnabled(false);
      setPrixManuel("");
    }
  }, [isAccessLoading, canUseHejja, isActive]);

  // Official logos on documents only when HEJJA is active on a premium account
  useEffect(() => {
    setOfficialLogosEnabled(isActive && canUseHejja);
  }, [isActive, canUseHejja]);

  // Reset on page unload for security
  useEffect(() => {
    const handleBeforeUnload = () => {
      setIsActive(false);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const activate = useCallback(() => {
    if (!canUseHejja) return;
    setIsActive(true);
  }, [canUseHejja]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setPshEnabled(true);
    setPrixEnabled(false);
    setPrixManuel("");
  }, []);

  const toggle = useCallback(() => {
    if (isActive) {
      deactivate();
    } else {
      activate();
    }
  }, [isActive, activate, deactivate]);

  return (
    <HejjaModeContext.Provider
      value={{
        isActive: isActive && canUseHejja,
        canUseHejja,
        isAccessLoading,
        pshEnabled,
        prixEnabled,
        prixManuel,
        activate,
        deactivate,
        toggle,
        setPshEnabled,
        setPrixEnabled,
        setPrixManuel,
      }}
    >
      {children}
    </HejjaModeContext.Provider>
  );
}

export function useHejjaMode() {
  const context = useContext(HejjaModeContext);
  if (!context) {
    throw new Error("useHejjaMode must be used within a HejjaModeProvider");
  }
  return context;
}
