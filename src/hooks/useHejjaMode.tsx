import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

interface HejjaModeContextType {
  isActive: boolean;
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

  // Reset on page unload for security
  useEffect(() => {
    const handleBeforeUnload = () => {
      setIsActive(false);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const activate = useCallback(() => {
    setIsActive(true);
  }, []);

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
        isActive,
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
