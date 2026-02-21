import React from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanPage } from "../types";

interface PagesTrayProps {
  pages: ScanPage[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRemovePage: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function PagesTray({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onRemovePage,
}: PagesTrayProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto bg-card border-t">
      {pages.map((page, index) => (
        <div
          key={page.id}
          className={`relative flex-shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
            activePageId === page.id
              ? "border-primary shadow-md scale-105"
              : "border-border hover:border-primary/50"
          }`}
          onClick={() => onSelectPage(page.id)}
        >
          <img
            src={page.warpedPreviewUrl || page.normalizedBlobUrl || page.originalBlobUrl}
            alt={`Page ${index + 1}`}
            className="w-full h-full object-cover"
          />
          {/* Page number */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-center text-[9px] py-0.5">
            {index + 1}
          </div>
          {/* Remove button */}
          <button
            className="absolute top-0 right-0 w-4 h-4 bg-destructive rounded-bl-md flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onRemovePage(page.id);
            }}
          >
            <X className="w-3 h-3 text-destructive-foreground" />
          </button>
        </div>
      ))}

      {/* Add page button */}
      <button
        onClick={onAddPage}
        className="flex-shrink-0 w-14 h-18 rounded-lg border-2 border-dashed border-primary/40 flex items-center justify-center hover:border-primary transition-colors"
      >
        <Plus className="w-5 h-5 text-primary" />
      </button>
    </div>
  );
}
