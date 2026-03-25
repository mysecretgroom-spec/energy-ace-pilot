import React, { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Image, Download, Eye, Trash2, RefreshCw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableDocumentCardProps {
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
  isDragMode: boolean;
}

export function SortableDocumentCard({
  doc,
  isSelected,
  fileType,
  onToggleSelection,
  onOpenPreview,
  onDelete,
  onReplace,
  formatDate,
  isDragMode,
}: SortableDocumentCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReplace) {
      onReplace(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCardClick = () => {
    if (isDragMode) {
      onToggleSelection();
    } else {
      onOpenPreview();
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "shadow-card cursor-pointer transition-all relative overflow-hidden select-none",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isDragging && "shadow-lg scale-[1.02]"
      )}
      onClick={handleCardClick}
    >
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
          {/* Drag handle - only visible in drag mode */}
          {isDragMode && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          
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

          {/* Thumbnail: use thumbnails_urls if available, otherwise show actual image */}
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

          {/* Actions - hidden in drag mode */}
          {!isDragMode && (
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
