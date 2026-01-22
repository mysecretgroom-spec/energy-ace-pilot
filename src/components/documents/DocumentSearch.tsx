import { useState, useEffect } from "react";
import { Search, FileText, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SearchResult {
  id: string;
  nom: string;
  type_document: string;
  url: string;
  extracted_text: string | null;
  created_at: string;
  client_id: string;
  client_name?: string;
  context_source?: string;
}

interface DocumentSearchProps {
  clientId?: string; // Optional: filter by client
  onSelectDocument?: (doc: SearchResult) => void;
}

// Debounce hook for search
function useSearchDebounce(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function DocumentSearch({ clientId, onSelectDocument }: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { user } = useAuth();

  const debouncedQuery = useSearchDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery, clientId]);

  const performSearch = async (searchQuery: string) => {
    if (!user) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Build the query
      let dbQuery = supabase
        .from("documents")
        .select(`
          id,
          nom,
          type_document,
          url,
          extracted_text,
          created_at,
          client_id,
          context_source,
          clients (nom, prenom)
        `)
        .eq("user_id", user.id)
        .or(`nom.ilike.%${searchQuery}%,extracted_text.ilike.%${searchQuery}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      // Filter by client if provided
      if (clientId) {
        dbQuery = dbQuery.eq("client_id", clientId);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      // Format results with client name
      const formattedResults: SearchResult[] = (data || []).map((doc: any) => ({
        id: doc.id,
        nom: doc.nom,
        type_document: doc.type_document,
        url: doc.url,
        extracted_text: doc.extracted_text,
        created_at: doc.created_at,
        client_id: doc.client_id,
        client_name: doc.clients
          ? `${doc.clients.prenom || ""} ${doc.clients.nom || ""}`.trim()
          : undefined,
        context_source: doc.context_source,
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!text || !query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getExcerpt = (text: string | null, query: string, maxLength: number = 150) => {
    if (!text) return null;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");

    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + query.length + 60);
    const excerpt = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");

    return excerpt;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      photo_chantier: "Photo",
      facture_frais: "Facture",
      cni: "CNI",
      justificatif_domicile: "Justificatif",
      facture_energie: "Facture énergie",
      bon_commande: "Bon de commande",
      devis: "Devis",
      contrat: "Contrat",
      plan: "Plan",
      assurance: "Assurance",
      autre: "Autre",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher dans les documents (nom, contenu OCR)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun document trouvé pour "{query}"</p>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {results.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => onSelectDocument?.(doc)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {highlightMatch(doc.nom, debouncedQuery)}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {getTypeLabel(doc.type_document)}
                        </Badge>
                      </div>

                      {doc.extracted_text && debouncedQuery && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {highlightMatch(
                            getExcerpt(doc.extracted_text, debouncedQuery) || "",
                            debouncedQuery
                          )}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {doc.client_name && !clientId && (
                          <span className="truncate">{doc.client_name}</span>
                        )}
                        <span>
                          {format(new Date(doc.created_at), "dd MMM yyyy", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
