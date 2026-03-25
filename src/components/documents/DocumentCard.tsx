import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Image, Download, Eye, Trash2, RefreshCw } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  doc: {
    id: string;
    nom: string;
    url: string;
    type_document: string;
    created_at: string;
    thumbnails_urls?: string[] | null;
  };
  isSelected: boolean;
  fileType: "pdf" | "image" | "unknown";
  onToggleSelection: () => void;
  onOpenPreview: () => void;
  onDelete?: () => void;
  onReplace?: (file: File) => void;
  formatDate: (date: string) => string;
}

export function DocumentCard({
  doc,
  isSelected,
  fileType,
  onToggleSelection,
  onOpenPreview,
  onDelete,
  onReplace,
  formatDate,
}: DocumentCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { handlers, isPressing, progress } = useLongPress({
    delay: 500,
    onLongPress: onOpenPreview,
    onPress: onToggleSelection,
  });

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReplace) {
      onReplace(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card
      className={cn(
        "shadow-card cursor-pointer transition-all relative overflow-hidden select-none",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isPressing && "scale-[0.98]"
      )}
      {...handlers}
    >
      {/* Long press progress indicator */}
      {isPressing && (
        <div 
          className="absolute bottom-0 left-0 h-1 bg-primary/60 transition-all duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      
      {/* Hidden file input for replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelection}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          />

          <div className="p-2 rounded-lg bg-muted flex-shrink-0">
            {fileType === "image" ? (
              <Image className="h-4 w-4 text-primary" />
            ) : (
              <FileText className="h-4 w-4 text-primary" />
            )}
          </div>

          {/* Thumbnail: use thumbnails_urls if available, otherwise show actual image for image files */}
          {doc.thumbnails_urls && doc.thumbnails_urls[0] ? (
            <div className="w-12 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
              <img
                src={doc.thumbnails_urls[0]}
                alt=""
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          ) : fileType === "image" ? (
            <div className="w-12 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
              <img
                src={doc.url}
                alt=""
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          ) : null}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{doc.nom}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {doc.type_document.replace(/_/g, " ")} • {formatDate(doc.created_at)}
            </p>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPreview();
              }}
              onTouchEnd={(e) => e.stopPropagation()}
              title="Prévisualiser"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {onReplace && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleReplaceClick}
                onTouchEnd={(e) => e.stopPropagation()}
                title="Remplacer"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                window.open(doc.url, "_blank");
              }}
              onTouchEnd={(e) => e.stopPropagation()}
              title="Télécharger"
            >
              <Download className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                onTouchEnd={(e) => e.stopPropagation()}
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
