import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  X,
  Check,
  Search,
  FileText,
  Loader2,
  Library,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LibraryDoc {
  id: string;
  nom: string;
  url: string;
  type_document: string;
  thumbnails_urls: string[] | null;
  created_at: string;
}

interface LibraryDocPickerProps {
  clientId: string;
  /** IDs of docs already in the carousel to exclude */
  excludeIds?: string[];
  onSelect: (docs: LibraryDoc[]) => void;
  onClose: () => void;
}

export function LibraryDocPicker({
  clientId,
  excludeIds = [],
  onSelect,
  onClose,
}: LibraryDocPickerProps) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const fetchDocs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("documents")
        .select("id, nom, url, type_document, thumbnails_urls, created_at")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setDocs(data.filter((d) => !excludeIds.includes(d.id)));
      }
      setLoading(false);
    };
    fetchDocs();
  }, [user, clientId, excludeIds]);

  const toggleDoc = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const selected = docs.filter((d) => selectedIds.has(d.id));
    onSelect(selected);
  }, [docs, selectedIds, onSelect]);

  const filtered = search.trim()
    ? docs.filter(
        (d) =>
          d.nom.toLowerCase().includes(search.toLowerCase()) ||
          d.type_document.toLowerCase().includes(search.toLowerCase())
      )
    : docs;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 bg-black z-10 border-b border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <span className="text-white/90 text-sm font-medium flex items-center justify-center gap-2">
            <Library className="h-4 w-4" />
            Bibliothèque client
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleConfirm}
          disabled={selectedIds.size === 0}
          className="text-primary hover:bg-white/10 disabled:opacity-30"
        >
          <Check className="h-4 w-4 mr-1" />
          {selectedIds.size > 0 ? `Ajouter (${selectedIds.size})` : "Ajouter"}
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Rechercher un document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9"
          />
        </div>
      </div>

      {/* Documents list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            {search ? "Aucun résultat" : "Aucun document"}
          </div>
        ) : (
          <div className="px-3 pb-24 space-y-1">
            {filtered.map((doc) => {
              const isSelected = selectedIds.has(doc.id);
              const thumb = doc.thumbnails_urls?.[0];
              return (
                <button
                  key={doc.id}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-primary/20 ring-1 ring-primary"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => toggleDoc(doc.id)}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-14 rounded bg-neutral-800 flex-shrink-0 overflow-hidden">
                    {thumb && !thumb.includes("PDF") ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-white/90 truncate">{doc.nom}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {doc.type_document.replace(/_/g, " ")} •{" "}
                      {new Date(doc.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-white/20"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
