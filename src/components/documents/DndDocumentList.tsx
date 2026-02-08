import React, { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableDocumentCard } from "./SortableDocumentCard";

interface DocumentItem {
  id: string;
  nom: string;
  url: string;
  type_document: string;
  created_at: string;
  thumbnails_urls?: string[] | null;
}

interface DndDocumentListProps {
  orderedDocs: DocumentItem[];
  onReorder: (docs: DocumentItem[]) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onOpenPreview: (doc: DocumentItem) => void;
  onDelete: (id: string) => void;
  onReplace: (id: string, file: File) => void;
  formatDate: (date: string) => string;
  isDragMode: boolean;
  getFileType: (url: string) => "pdf" | "image" | "unknown";
}

function DndDocumentList({
  orderedDocs,
  onReorder,
  selectedIds,
  onToggleSelection,
  onOpenPreview,
  onDelete,
  onReplace,
  formatDate,
  isDragMode,
  getFileType,
}: DndDocumentListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = orderedDocs.findIndex((item) => item.id === active.id);
        const newIndex = orderedDocs.findIndex((item) => item.id === over.id);
        onReorder(arrayMove(orderedDocs, oldIndex, newIndex));
      }
    },
    [orderedDocs, onReorder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedDocs.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        {orderedDocs.map((doc) => (
          <SortableDocumentCard
            key={doc.id}
            doc={doc}
            isSelected={selectedIds.has(doc.id)}
            fileType={getFileType(doc.url)}
            onToggleSelection={() => onToggleSelection(doc.id)}
            onOpenPreview={() => onOpenPreview(doc)}
            onDelete={() => onDelete(doc.id)}
            onReplace={(file) => onReplace(doc.id, file)}
            formatDate={formatDate}
            isDragMode={isDragMode}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

export default DndDocumentList;
