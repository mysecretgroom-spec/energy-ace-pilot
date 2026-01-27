import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CompanyResult {
  nom: string;
  siret: string;
  siren: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
}

interface SiretSearchFieldProps {
  companyName: string;
  value: string;
  onChange: (siret: string, company?: CompanyResult) => void;
  className?: string;
}

export function SiretSearchField({
  companyName,
  value,
  onChange,
  className,
}: SiretSearchFieldProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search when company name changes and has at least 3 characters
  useEffect(() => {
    if (companyName.length >= 3) {
      searchCompanies(companyName);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [companyName]);

  const searchCompanies = async (query: string) => {
    setLoading(true);
    setHasSearched(true);
    try {
      // Use the public API directly for multiple results
      const searchUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=10`;
      
      const response = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const companies: CompanyResult[] = data.results.map((company: any) => ({
          nom: company.nom_complet || company.nom_raison_sociale,
          siret: company.siege?.siret || null,
          siren: company.siren || null,
          adresse: company.siege?.adresse || null,
          code_postal: company.siege?.code_postal || null,
          ville: company.siege?.libelle_commune || null,
        })).filter((c: CompanyResult) => c.siret);

        setResults(companies);
        if (companies.length > 0) {
          setShowDropdown(true);
        }
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Error searching companies:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (company: CompanyResult) => {
    setSelectedCompany(company);
    onChange(company.siret, company);
    setShowDropdown(false);
  };

  const formatSiret = (siret: string) => {
    // Format: XXX XXX XXX XXXXX
    return siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4');
  };

  return (
    <div ref={containerRef} className={cn("space-y-2 relative", className)}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          SIRET <span className="text-destructive">*</span>
        </Label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="relative">
        <Input
          value={value ? formatSiret(value) : ""}
          placeholder={companyName.length < 3 ? "Saisissez le nom pour rechercher..." : "Sélectionner dans la liste..."}
          readOnly
          onClick={() => results.length > 0 && setShowDropdown(true)}
          className={cn(
            "cursor-pointer",
            results.length > 0 && "pr-10",
            !value && hasSearched && results.length > 0 && "border-destructive"
          )}
        />
        {results.length > 0 && (
          <Search 
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
            onClick={() => setShowDropdown(true)}
          />
        )}
      </div>

      {/* Selected company info */}
      {selectedCompany && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
          <p className="font-medium text-foreground">{selectedCompany.nom}</p>
          {selectedCompany.ville && (
            <p>{selectedCompany.code_postal} {selectedCompany.ville}</p>
          )}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-64 overflow-auto"
          style={{ top: '100%' }}
        >
          {results.map((company, index) => (
            <button
              key={`${company.siret}-${index}`}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-muted/80 transition-colors border-b last:border-b-0",
                value === company.siret && "bg-primary/10"
              )}
              onClick={() => handleSelect(company)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{company.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {company.code_postal} {company.ville}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatSiret(company.siret)}
                  </span>
                  {value === company.siret && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {hasSearched && !loading && results.length === 0 && companyName.length >= 3 && (
        <p className="text-xs text-destructive">
          Aucune entreprise trouvée pour "{companyName}"
        </p>
      )}

      {/* Required hint when results available but none selected */}
      {!value && hasSearched && results.length > 0 && !showDropdown && (
        <p className="text-xs text-destructive">
          Veuillez sélectionner une entreprise dans la liste
        </p>
      )}
    </div>
  );
}
