import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, User, Calendar, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "client" | "vente" | "rdv";
  label: string;
  sublabel?: string;
  navigateTo: string;
}

export function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (!user || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);

      try {
        const term = `%${q}%`;

        const [clientsRes, ventesRes, rdvRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id, nom, prenom, telephone, ville")
            .eq("user_id", user.id)
            .or(`nom.ilike.${term},prenom.ilike.${term},telephone.ilike.${term},ville.ilike.${term}`)
            .limit(5),
          supabase
            .from("ventes")
            .select("id, montant_ttc, status, client:clients(nom, prenom)")
            .eq("user_id", user.id)
            .limit(5),
          supabase
            .from("rdv")
            .select("id, date_heure, status, clients(nom, prenom)")
            .eq("user_id", user.id)
            .limit(5),
        ]);

        const items: SearchResult[] = [];

        // Clients
        (clientsRes.data || []).forEach((c: any) => {
          items.push({
            id: c.id,
            type: "client",
            label: `${c.prenom || ""} ${c.nom}`.trim(),
            sublabel: [c.telephone, c.ville].filter(Boolean).join(" · "),
            navigateTo: `/clients/${c.id}`,
          });
        });

        // Ventes matching client name
        (ventesRes.data || []).forEach((v: any) => {
          const clientName = v.client
            ? `${v.client.prenom || ""} ${v.client.nom}`.trim()
            : "";
          if (clientName.toLowerCase().includes(q.toLowerCase())) {
            items.push({
              id: v.id,
              type: "vente",
              label: clientName,
              sublabel: `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v.montant_ttc)} · ${v.status}`,
              navigateTo: `/ventes/${v.id}`,
            });
          }
        });

        // RDV matching client name
        (rdvRes.data || []).forEach((r: any) => {
          const clientName = r.clients
            ? `${r.clients.prenom || ""} ${r.clients.nom}`.trim()
            : "";
          if (clientName.toLowerCase().includes(q.toLowerCase())) {
            items.push({
              id: r.id,
              type: "rdv",
              label: clientName,
              sublabel: new Date(r.date_heure).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }),
              navigateTo: `/planning`,
            });
          }
        });

        setResults(items.slice(0, 10));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    navigate(result.navigateTo);
  };

  const typeIcon = {
    client: <User className="h-4 w-4 text-primary" />,
    vente: <FileText className="h-4 w-4 text-green-600" />,
    rdv: <Calendar className="h-4 w-4 text-blue-500" />,
  };

  const typeLabel = {
    client: "Client",
    vente: "Vente",
    rdv: "RDV",
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="top" className="h-auto max-h-[80vh] rounded-b-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Recherche</SheetTitle>
          </SheetHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Client, vente, RDV..."
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="mt-3 space-y-1 max-h-[50vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun résultat
              </p>
            )}

            {!loading &&
              results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  {typeIcon[r.type]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.label}</p>
                    {r.sublabel && (
                      <p className="text-xs text-muted-foreground truncate">
                        {r.sublabel}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    {typeLabel[r.type]}
                  </span>
                </button>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
