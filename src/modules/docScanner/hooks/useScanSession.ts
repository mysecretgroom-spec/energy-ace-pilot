import { useState, useCallback } from "react";
import type { ScanPage, FilterPreset, ExportSettings } from "../types";

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "pdf",
  quality: "high",
  pdfMode: "a4",
  margins: 0,
};

interface ScanSessionResult {
  pages: ScanPage[];
  activePageId: string | null;
  exportSettings: ExportSettings;
  setActivePageId: (id: string | null) => void;
  addPage: (page: ScanPage) => void;
  updatePage: (id: string, updates: Partial<ScanPage>) => void;
  removePage: (id: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  clearSession: () => void;
}

export function useScanSession(): ScanSessionResult {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [exportSettings, setExportSettingsState] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);

  const addPage = useCallback((page: ScanPage) => {
    setPages((prev) => [...prev, page]);
    setActivePageId(page.id);
  }, []);

  const updatePage = useCallback((id: string, updates: Partial<ScanPage>) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered;
    });
    setActivePageId((prev) => (prev === id ? null : prev));
  }, []);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      const newPages = [...prev];
      const [moved] = newPages.splice(fromIndex, 1);
      newPages.splice(toIndex, 0, moved);
      return newPages;
    });
  }, []);

  const setExportSettings = useCallback((settings: Partial<ExportSettings>) => {
    setExportSettingsState((prev) => ({ ...prev, ...settings }));
  }, []);

  const clearSession = useCallback(() => {
    // Revoke blob URLs
    pages.forEach((p) => {
      if (p.originalBlobUrl) URL.revokeObjectURL(p.originalBlobUrl);
      if (p.normalizedBlobUrl) URL.revokeObjectURL(p.normalizedBlobUrl);
      if (p.warpedPreviewUrl) URL.revokeObjectURL(p.warpedPreviewUrl);
    });
    setPages([]);
    setActivePageId(null);
  }, [pages]);

  return {
    pages,
    activePageId,
    exportSettings,
    setActivePageId,
    addPage,
    updatePage,
    removePage,
    reorderPages,
    setExportSettings,
    clearSession,
  };
}
