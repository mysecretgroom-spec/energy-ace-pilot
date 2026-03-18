import { useState, useEffect, useMemo } from "react";
import { clampDateToToday } from "@/lib/dateValidation";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BlurOverlay } from "@/components/layout/BlurOverlay";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isCancellationStatus } from "@/lib/venteStatusConfig";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { BankImport } from "@/components/finance/BankImport";
import { PlaidLink } from "@/components/finance/PlaidLink";
import { MultiImportFlow } from "@/components/scanner";
import { ExportFraisPDF } from "@/components/finance/ExportFraisPDF";
import { ReceiptGallery } from "@/components/finance/ReceiptGallery";
import { ExpenseChart } from "@/components/finance/ExpenseChart";
import { VATReport } from "@/components/finance/VATReport";
import { BillingSection } from "@/components/finance/BillingSection";
import { StatDetailDialog, StatDetailItem } from "@/components/stats/StatDetailDialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  Receipt,
  Camera,
  Calendar,
  Fuel,
  Utensils,
  Building2,
  Car,
  Plus,
  ParkingSquare,
  HelpCircle,
  FolderOpen,
  FileText,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Ban,
  Pencil,
  Trash2,
  MoreVertical,
  Files,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Train,
  CarFront,
  RotateCcw,
  Paperclip,
  Eye,
  Download,
  CalendarRange,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const categoryIcons: Record<string, React.ElementType> = {
  carburant: Fuel,
  repas: Utensils,
  hotel: Building2,
  peage: Car,
  parking: ParkingSquare,
  train: Train,
  location_vehicule: CarFront,
  autre: HelpCircle,
};

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  repas: "Repas",
  hotel: "Hôtel",
  peage: "Péage",
  parking: "Parking",
  train: "Trains",
  location_vehicule: "Location Véhicule",
  autre: "Autre",
};

const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  carburant: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: "text-amber-600 dark:text-amber-400" },
  repas: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", icon: "text-orange-600 dark:text-orange-400" },
  hotel: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: "text-blue-600 dark:text-blue-400" },
  peage: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-400", icon: "text-slate-600 dark:text-slate-400" },
  parking: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400", icon: "text-indigo-600 dark:text-indigo-400" },
  train: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: "text-emerald-600 dark:text-emerald-400" },
  location_vehicule: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", icon: "text-violet-600 dark:text-violet-400" },
  autre: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-700 dark:text-gray-400", icon: "text-gray-500 dark:text-gray-400" },
};

/** Format a Date to YYYY-MM-DD using local timezone (avoids UTC shift from toISOString) */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface FraisItem {
  id: string;
  montant: number;
  date_frais: string;
  categorie: string;
  description: string | null;
  fournisseur: string | null;
  ocr_data: Json | null;
  date_debut: string | null;
  date_fin: string | null;
  justificatif_url: string | null;
}

interface VenteStats {
  caMonth: number;
  caPrevMonth: number;
  commissionsMonth: number;
  // Catégories simplifiées
  comEnCours: number;              // Non posé: signe, cq_*, financement, envoi_pose, en_installation
  comAttenteFacturation: number;   // Posé < 2 semaines: installe, attente_paiement
  comAFacturer: number;            // Posé >= 2 semaines: installe, attente_paiement
  comPayees: number;               // Payé: paye
  comPotentielleTotale: number;    // enCours + attenteFacturation + aFacturer
  signedCount: number;
  avgDeal: number;
  ventesEnCours: number;
  ventesAnnulees: number;
}

interface VenteForCommission {
  id: string;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  decom_montant: number | null;
  decom_raison: string | null;
  type_vente: 'standard' | 'external_installation';
  regie_id: string | null;
  etude_id: string | null;
  status: string;
  date_signature: string | null;
  date_installation_reelle: string | null;
  client_nom?: string;
  client_prenom?: string;
  client_id?: string;
  client_telephone?: string | null;
  client_adresse?: string | null;
  client_ville?: string | null;
  client_code_postal?: string | null;
}

type FinanceStatDialogType = 'enCours' | 'attenteFacturation' | 'aFacturer' | 'payees' | 'commissionsMois' | 'caMois' | 'signesMois' | 'annulees' | null;
type FraisPeriod = 'jour' | 'semaine' | 'mois' | 'custom';

const Finance = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("frais");
  const [multiImportOpen, setMultiImportOpen] = useState(false);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [addFraisOpen, setAddFraisOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [fraisData, setFraisData] = useState<FraisItem[]>([]);
  const [allFraisData, setAllFraisData] = useState<FraisItem[]>([]); // For current month stats/chart
  const [allFraisHistory, setAllFraisHistory] = useState<FraisItem[]>([]); // For history (all months)
  const [venteStatsState, setVenteStats] = useState<VenteStats | null>(null);
  const [loadingVentes, setLoadingVentes] = useState(true);
  const [savingFrais, setSavingFrais] = useState(false);
  const [totaux, setTotaux] = useState({
    jour: 0,
    semaine: 0,
    mois: 0,
  });
  const [objectifFrais, setObjectifFrais] = useState<number>(500);
  
  // Navigation temporelle pour les frais
  const [selectedDate, setSelectedDate] = useState(new Date());
  // La semaine de frais va du dimanche au samedi (format israélien)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = dimanche, 6 = samedi
    // Reculer jusqu'au dimanche précédent (ou aujourd'hui si dimanche)
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    return sunday;
  });
  
  // Period selection for chart/stats
  const [selectedPeriod, setSelectedPeriod] = useState<FraisPeriod>('mois');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  // Refresh key to force re-fetch of all data
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(k => k + 1);
  
  // Navigation helpers
  const navigateMonth = (direction: number) => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };
  
  const navigateWeek = (direction: number) => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction * 7));
      return newDate;
    });
  };
  
  const navigateDay = (direction: number) => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + direction);
      return newDate;
    });
  };
  
  const isCurrentMonth = selectedDate.getMonth() === new Date().getMonth() && 
                         selectedDate.getFullYear() === new Date().getFullYear();
  const isCurrentWeek = (() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Calculer le dimanche de la semaine courante (format israélien)
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - dayOfWeek);
    currentSunday.setHours(0, 0, 0, 0);
    const selectedSundayCopy = new Date(selectedWeekStart);
    selectedSundayCopy.setHours(0, 0, 0, 0);
    return currentSunday.getTime() === selectedSundayCopy.getTime();
  })();
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  
  // Form state for manual expense
  const [newFrais, setNewFrais] = useState({
    montant: "",
    categorie: "autre",
    description: "",
    fournisseur: "",
    date_frais: formatLocalDate(new Date()),
    date_debut: "",
    date_fin: "",
  });
  
  // Edit/Delete state
  const [editingFrais, setEditingFrais] = useState<FraisItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fraisToDelete, setFraisToDelete] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    montant: "",
    categorie: "autre",
    description: "",
    fournisseur: "",
    date_frais: "",
    date_debut: "",
    date_fin: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => {
    // Current year is expanded by default
    return new Set([new Date().getFullYear()]);
  });
  
  // Stat dialog state
  const [financeStatDialogOpen, setFinanceStatDialogOpen] = useState(false);
  const [financeStatDialogType, setFinanceStatDialogType] = useState<FinanceStatDialogType>(null);

  // Group frais by year then by month
  // Structure: { year: number, total: number, months: { key, label, total, frais }[] }
  const fraisGroupedByYear = useMemo(() => {
    // First group by month
    const monthGroups: Map<string, { label: string; total: number; frais: FraisItem[]; year: number; month: number }> = new Map();
    
    allFraisHistory.forEach((frais) => {
      const [y, m] = frais.date_frais.split("-").map(Number);
      const date = new Date(y, m - 1, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString("fr-FR", { month: "long" });
      const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`;
      
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, { label: monthLabel, total: 0, frais: [], year, month });
      }
      
      const group = monthGroups.get(monthKey)!;
      group.frais.push(frais);
      group.total += Number(frais.montant);
    });
    
    // Now group by year
    const yearGroups: Map<number, { year: number; total: number; months: { key: string; label: string; total: number; frais: FraisItem[] }[] }> = new Map();
    
    Array.from(monthGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // Sort months descending
      .forEach(([key, data]) => {
        if (!yearGroups.has(data.year)) {
          yearGroups.set(data.year, { year: data.year, total: 0, months: [] });
        }
        const yearGroup = yearGroups.get(data.year)!;
        yearGroup.months.push({ key, label: data.label, total: data.total, frais: data.frais });
        yearGroup.total += data.total;
      });
    
    // Sort years descending (most recent first)
    return Array.from(yearGroups.values()).sort((a, b) => b.year - a.year);
  }, [allFraisHistory]);


  // Helper: parse YYYY-MM-DD as local date (not UTC)
  const parseLocalDateStatic = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  // Helper: calculate prorated amount for a period-based expense within a date range
  const getProratedAmountStatic = (frais: { montant: number; date_debut: string | null; date_fin: string | null; categorie: string }, rangeStart: Date, rangeEnd: Date): number => {
    const hasPeriod = frais.date_debut && frais.date_fin && 
      (frais.categorie === "location_vehicule" || frais.categorie === "hotel");
    
    if (!hasPeriod || !frais.date_debut || !frais.date_fin) {
      return Number(frais.montant);
    }
    
    const periodStart = parseLocalDateStatic(frais.date_debut);
    const periodEnd = parseLocalDateStatic(frais.date_fin);
    const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    const overlapStart = new Date(Math.max(periodStart.getTime(), rangeStart.getTime()));
    const overlapEnd = new Date(Math.min(periodEnd.getTime(), rangeEnd.getTime()));
    const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    return (Number(frais.montant) / totalDays) * overlapDays;
  };

  // Helper: get frais relevant to a date range (by date_frais OR by period overlap), with prorated montant
  const getFraisForRange = (rangeStartStr: string, rangeEndStr: string): { montant: number; categorie: string }[] => {
    const rangeStart = parseLocalDateStatic(rangeStartStr);
    const rangeEnd = parseLocalDateStatic(rangeEndStr);
    const seen = new Map<string, boolean>();
    const result: { montant: number; categorie: string }[] = [];

    for (const f of allFraisHistory) {
      if (seen.has(f.id)) continue;
      
      const inRange = f.date_frais >= rangeStartStr && f.date_frais <= rangeEndStr;
      const isPeriod = f.date_debut && f.date_fin && (f.categorie === "location_vehicule" || f.categorie === "hotel");
      const periodOverlaps = isPeriod && f.date_debut! <= rangeEndStr && f.date_fin! >= rangeStartStr;

      if (inRange || periodOverlaps) {
        seen.set(f.id, true);
        const prorated = getProratedAmountStatic(f, rangeStart, rangeEnd);
        if (prorated > 0) {
          result.push({ montant: Math.round(prorated * 100) / 100, categorie: f.categorie });
        }
      }
    }
    return result;
  };

  // Chart frais filtered by selected period (with proration for period expenses)
  const chartFrais = useMemo(() => {
    if (selectedPeriod === 'jour') {
      const dayStr = formatLocalDate(selectedDate);
      return getFraisForRange(dayStr, dayStr);
    }
    if (selectedPeriod === 'semaine') {
      const ws = new Date(selectedWeekStart);
      ws.setHours(0, 0, 0, 0);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      return getFraisForRange(formatLocalDate(ws), formatLocalDate(we));
    }
    if (selectedPeriod === 'custom' && customRange?.from) {
      const fromStr = formatLocalDate(customRange.from);
      const toStr = customRange.to ? formatLocalDate(customRange.to) : fromStr;
      return getFraisForRange(fromStr, toStr);
    }
    // 'mois' — default
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return getFraisForRange(formatLocalDate(monthStart), formatLocalDate(monthEnd));
  }, [selectedPeriod, selectedDate, selectedWeekStart, customRange, allFraisHistory]);

  // Chart period label
  const chartPeriodLabel = useMemo(() => {
    if (selectedPeriod === 'jour') {
      return selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    }
    if (selectedPeriod === 'semaine') {
      const ws = new Date(selectedWeekStart);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      return `${format(ws, "d MMM", { locale: frLocale })} — ${format(we, "d MMM", { locale: frLocale })}`;
    }
    if (selectedPeriod === 'custom' && customRange?.from) {
      const from = format(customRange.from, "d MMM", { locale: frLocale });
      const to = customRange.to ? format(customRange.to, "d MMM yyyy", { locale: frLocale }) : from;
      return `${from} — ${to}`;
    }
    return selectedDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }, [selectedPeriod, selectedDate, selectedWeekStart, customRange]);

  // All months are collapsed by default - no initialization needed

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // State for ventes to be used with commission hook
  const [ventesForCommission, setVentesForCommission] = useState<VenteForCommission[]>([]);
  const [rawVentes, setRawVentes] = useState<any[]>([]);
  
  // Use the centralized commission hook
  const { getCommission, loading: loadingCommissions } = useVenteCommissions(ventesForCommission);

  useEffect(() => {
    if (!user) return;

    const fetchVenteData = async () => {
      setLoadingVentes(true);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Fetch all ventes for the user with client info
        const { data: ventes, error } = await supabase
          .from("ventes")
          .select("id, montant_ttc, montant_ht, status, puissance_kwc, decom_montant, decom_raison, date_signature, date_installation_reelle, created_at, regie_id, etude_id, type_vente, client_id, clients(nom, prenom, telephone, adresse, ville, code_postal)")
          .eq("user_id", user.id);

        if (error) throw error;

        setRawVentes(ventes || []);
        
        // Prepare data for commission hook (exclude all cancellation statuses)
        setVentesForCommission((ventes || []).filter((v: any) => !isCancellationStatus(v.status)).map((v: any) => ({
          id: v.id,
          montant_ht: v.montant_ht,
          montant_ttc: v.montant_ttc,
          puissance_kwc: v.puissance_kwc,
          decom_montant: v.decom_montant,
          decom_raison: v.decom_raison || null,
          type_vente: v.type_vente || 'standard',
          regie_id: v.regie_id,
          etude_id: v.etude_id,
          status: v.status,
          date_signature: v.date_signature,
          date_installation_reelle: v.date_installation_reelle,
          client_nom: v.clients?.nom || "Client",
          client_prenom: v.clients?.prenom || "",
          client_id: v.client_id,
          client_telephone: v.clients?.telephone || null,
          client_adresse: v.clients?.adresse || null,
          client_ville: v.clients?.ville || null,
          client_code_postal: v.clients?.code_postal || null,
        })));

      } catch (err) {
        console.error("Error fetching vente data:", err);
      } finally {
        setLoadingVentes(false);
      }
    };

    fetchVenteData();
  }, [user, refreshKey]);

  // Calculate stats using commission hook results
  const venteStatsComputed = useMemo(() => {
    if (loadingVentes || loadingCommissions || rawVentes.length === 0) return null;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const ventes = rawVentes;
    
    // Calculate stats
    const ventesThisMonth = ventes.filter(v => {
      const date = v.date_signature ? new Date(v.date_signature) : new Date(v.created_at);
      return date >= startOfMonth;
    });

    const ventesPrevMonth = ventes.filter(v => {
      const date = v.date_signature ? new Date(v.date_signature) : new Date(v.created_at);
      return date >= startOfPrevMonth && date <= endOfPrevMonth;
    });

    // Pour le CA: exclure les installations externes
    const signedThisMonthForCA = ventesThisMonth.filter(v => 
      v.status !== 'en_negociation' && !isCancellationStatus(v.status) &&
      v.type_vente !== 'external_installation'
    );
    
    const signedPrevMonthForCA = ventesPrevMonth.filter(v => 
      v.status !== 'en_negociation' && !isCancellationStatus(v.status) &&
      v.type_vente !== 'external_installation'
    );

    const caMonth = signedThisMonthForCA.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0);
    const caPrevMonth = signedPrevMonthForCA.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0);

    // Pour les commissions: INCLURE les installations externes (elles génèrent des commissions)
    const signedThisMonthForComm = ventesThisMonth.filter(v => 
      v.status !== 'en_negociation' && !isCancellationStatus(v.status)
    );
    const commissionsMonth = signedThisMonthForComm.reduce((sum, v) => {
      const comm = getCommission(v.id);
      return sum + (comm?.commissionNette || 0);
    }, 0);

    // === Catégories simplifiées ===
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    // En cours (non posé): signe, cq_a_faire, cq_fait, attente_financement, envoi_pose, en_installation
    const ventesEnCours = ventes.filter(v => 
      ["signe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose", "en_installation"].includes(v.status)
    );
    const comEnCours = ventesEnCours.reduce((sum, v) => {
      const comm = getCommission(v.id);
      return sum + (comm?.commissionNette || 0);
    }, 0);

    // Posé non payé: installe, attente_paiement - split by date_installation_reelle
    const ventesPosees = ventes.filter(v => 
      ["installe", "attente_paiement"].includes(v.status)
    );
    
    // En attente de facturation: posé < 2 semaines (sauf attente_paiement sans date → va dans à facturer)
    const ventesAttenteFacturation = ventesPosees.filter(v => {
      if (!v.date_installation_reelle) return v.status !== "attente_paiement"; // attente_paiement sans date → à facturer
      return new Date(v.date_installation_reelle) > twoWeeksAgo;
    });
    const comAttenteFacturation = ventesAttenteFacturation.reduce((sum, v) => {
      const comm = getCommission(v.id);
      return sum + (comm?.commissionNette || 0);
    }, 0);
    
    // À facturer: posé >= 2 semaines OR attente_paiement sans date
    const ventesAFacturer = ventesPosees.filter(v => {
      if (!v.date_installation_reelle) return v.status === "attente_paiement"; // attente_paiement sans date → facturable
      return new Date(v.date_installation_reelle) <= twoWeeksAgo;
    });
    const comAFacturer = ventesAFacturer.reduce((sum, v) => {
      const comm = getCommission(v.id);
      return sum + (comm?.commissionNette || 0);
    }, 0);

    // Payées: paye
    const ventesPayees = ventes.filter(v => v.status === "paye");
    const comPayees = ventesPayees.reduce((sum, v) => {
      const comm = getCommission(v.id);
      return sum + (comm?.commissionNette || 0);
    }, 0);

    // Total potentiel = en cours + attente facturation + à facturer
    const comPotentielleTotale = comEnCours + comAttenteFacturation + comAFacturer;

    const signedCount = signedThisMonthForCA.length;
    const avgDeal = signedCount > 0 ? caMonth / signedCount : 0;

    const ventesEnCoursCount = ventes.filter(v => 
      ["en_negociation", "signe", "cq_a_faire", "cq_fait", "attente_financement"].includes(v.status)
    ).length;

    const ventesAnnulees = ventesThisMonth.filter(v => v.status === "annule").length;

    return {
      caMonth,
      caPrevMonth,
      commissionsMonth,
      comEnCours,
      comAttenteFacturation,
      comAFacturer,
      comPayees,
      comPotentielleTotale,
      signedCount,
      avgDeal,
      ventesEnCours: ventesEnCoursCount,
      ventesAnnulees,
    } as VenteStats;
  }, [rawVentes, loadingVentes, loadingCommissions, getCommission]);

  // Use computed stats
  const venteStats = venteStatsComputed;

  // Open stat dialog
  const openFinanceStatDialog = (type: FinanceStatDialogType) => {
    setFinanceStatDialogType(type);
    setFinanceStatDialogOpen(true);
  };

  // Get dialog data for finance
  const getFinanceDialogData = useMemo(() => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    // Mirrors the exact same logic as venteStatsComputed for attente/aFacturer split
    const filterAttenteFacturation = () => {
      return ventesForCommission.filter(v => {
        if (!["installe", "attente_paiement"].includes(v.status)) return false;
        if (!v.date_installation_reelle) return v.status !== "attente_paiement";
        return new Date(v.date_installation_reelle) > twoWeeksAgo;
      });
    };
    
    const filterAFacturer = () => {
      return ventesForCommission.filter(v => {
        if (!["installe", "attente_paiement"].includes(v.status)) return false;
        if (!v.date_installation_reelle) return v.status === "attente_paiement";
        return new Date(v.date_installation_reelle) <= twoWeeksAgo;
      });
    };

    const filterByStatus = (statuses: string[]) => {
      return ventesForCommission.filter(v => statuses.includes(v.status));
    };
    
    const mapToItems = (ventes: typeof ventesForCommission) => ventes.map(v => {
      const comm = getCommission(v.id);
      return {
        id: v.id,
        label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
        sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
        value: comm?.commissionNette || 0,
        date: v.date_installation_reelle || v.date_signature || undefined,
        navigateTo: `/ventes/${v.id}`,
        phone: v.client_telephone,
        clientId: v.client_id,
        address: v.client_adresse,
        city: v.client_ville,
        postalCode: v.client_code_postal,
        venteId: v.id,
        venteStatus: v.status,
        clientName: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
        decomMontant: v.decom_montant ?? 0,
        decomRaison: v.decom_raison,
        montantHt: v.montant_ht,
      };
    });
    
    switch (financeStatDialogType) {
      case 'enCours':
        const enCours = filterByStatus(["signe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose", "en_installation"]);
        return { title: "En cours", subtitle: "Non posé", items: mapToItems(enCours), total: venteStats?.comEnCours };
      case 'attenteFacturation':
        return { title: "En attente de facturation", subtitle: "Posé < 2 semaines", items: mapToItems(filterAttenteFacturation()), total: venteStats?.comAttenteFacturation };
      case 'aFacturer':
        return { title: "Attente de paiement", subtitle: "Posé ≥ 2 semaines", items: mapToItems(filterAFacturer()), total: venteStats?.comAFacturer };
      case 'payees':
        const payees = filterByStatus(["paye"]);
        return { title: "Payées", subtitle: "Commissions encaissées", items: mapToItems(payees), total: venteStats?.comPayees };
      case 'commissionsMois': {
        const now2 = new Date();
        const startOfMonthComm = new Date(now2.getFullYear(), now2.getMonth(), 1);
        const ventesCommMois = ventesForCommission.filter(v => 
          v.date_signature && new Date(v.date_signature) >= startOfMonthComm &&
          v.status !== 'en_negociation'
        );
        return { title: "Commissions ce mois", subtitle: "HT", items: mapToItems(ventesCommMois), total: venteStats?.commissionsMonth };
      }
      case 'caMois': {
        const now3 = new Date();
        const startOfMonthCA = new Date(now3.getFullYear(), now3.getMonth(), 1);
        const ventesCaMois = ventesForCommission.filter(v => 
          v.date_signature && new Date(v.date_signature) >= startOfMonthCA &&
          v.status !== 'en_negociation' &&
          v.type_vente !== 'external_installation'
        );
        return { 
          title: "CA ce mois", 
          subtitle: "TTC", 
          items: ventesCaMois.map(v => ({
            id: v.id,
            label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : undefined,
            value: v.montant_ttc,
            date: v.date_signature || undefined,
            navigateTo: `/ventes/${v.id}`,
            phone: v.client_telephone,
            clientId: v.client_id,
            address: v.client_adresse,
            city: v.client_ville,
            postalCode: v.client_code_postal,
            venteId: v.id,
            venteStatus: v.status,
            clientName: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            decomMontant: v.decom_montant ?? 0,
            decomRaison: v.decom_raison,
            montantHt: v.montant_ht,
          })),
          total: venteStats?.caMonth 
        };
      }
      case 'signesMois': {
        const now4 = new Date();
        const startOfMonthSig = new Date(now4.getFullYear(), now4.getMonth(), 1);
        const ventesSignesMois = ventesForCommission.filter(v => 
          v.date_signature && new Date(v.date_signature) >= startOfMonthSig &&
          v.status !== 'en_negociation' &&
          v.type_vente !== 'external_installation'
        );
        return { 
          title: "Dossiers signés ce mois", 
          items: ventesSignesMois.map(v => ({
            id: v.id,
            label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : undefined,
            value: v.montant_ttc,
            date: v.date_signature || undefined,
            navigateTo: `/ventes/${v.id}`,
            phone: v.client_telephone,
            clientId: v.client_id,
            address: v.client_adresse,
            city: v.client_ville,
            postalCode: v.client_code_postal,
            venteId: v.id,
            venteStatus: v.status,
            clientName: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            decomMontant: v.decom_montant ?? 0,
            decomRaison: v.decom_raison,
            montantHt: v.montant_ht,
          })),
          total: undefined,
        };
      }
      case 'annulees': {
        const now5 = new Date();
        const startOfMonthAnn = new Date(now5.getFullYear(), now5.getMonth(), 1);
        const ventesAnnulees = rawVentes.filter(v => {
          const date = v.date_signature ? new Date(v.date_signature) : new Date(v.created_at);
          return date >= startOfMonthAnn && v.status === "annule";
        });
        return { 
          title: "Ventes annulées ce mois", 
          items: ventesAnnulees.map((v: any) => ({
            id: v.id,
            label: `${v.clients?.nom || "Client"} ${v.clients?.prenom || ""}`.trim(),
            sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : undefined,
            value: v.montant_ttc,
            date: v.date_signature || undefined,
            navigateTo: `/ventes/${v.id}`,
          })),
          total: undefined,
        };
      }
      default:
        return { title: "", items: [], total: undefined };
    }
  }, [financeStatDialogType, ventesForCommission, getCommission, venteStats]);

  // Fetch frais
  useEffect(() => {
    if (!user) return;

    const fetchFrais = async () => {
      // Mois sélectionné
      const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      const monthStartStr = formatLocalDate(monthStart);
      const monthEndStr = formatLocalDate(monthEnd);
      
      // Jour sélectionné
      const selectedDayStr = formatLocalDate(selectedDate);
      
      // Semaine sélectionnée (dimanche au samedi = 7 jours)
      const weekStart = new Date(selectedWeekStart);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Dimanche + 6 jours = Samedi
      const weekStartStr = formatLocalDate(weekStart);
      const weekEndStr = formatLocalDate(weekEnd);

      // Fetch objectif frais for selected month
      const { data: objectifData } = await supabase
        .from("objectifs")
        .select("objectif_frais")
        .eq("user_id", user.id)
        .eq("mois", selectedDate.getMonth() + 1)
        .eq("annee", selectedDate.getFullYear())
        .maybeSingle();
      
      if (objectifData?.objectif_frais) {
        setObjectifFrais(objectifData.objectif_frais);
      } else {
        setObjectifFrais(500); // Reset to default if no objective set
      }

      // Fetch all frais for the selected month (for stats and chart)
      const { data: monthFrais } = await supabase
        .from("frais")
        .select("id, montant, date_frais, categorie, description, fournisseur, ocr_data, date_debut, date_fin, justificatif_url")
        .eq("user_id", user.id)
        .gte("date_frais", monthStartStr)
        .lte("date_frais", monthEndStr)
        .order("date_frais", { ascending: false });

      // Fetch ALL frais for history (no date filter)
      const { data: allHistoryFrais } = await supabase
        .from("frais")
        .select("id, montant, date_frais, categorie, description, fournisseur, ocr_data, date_debut, date_fin, justificatif_url")
        .eq("user_id", user.id)
        .order("date_frais", { ascending: false });

      // Fetch frais for the selected week (may span different months)
      const { data: weekFrais } = await supabase
        .from("frais")
        .select("id, montant, date_frais, categorie, date_debut, date_fin")
        .eq("user_id", user.id)
        .gte("date_frais", weekStartStr)
        .lte("date_frais", weekEndStr);

      // Fetch period-based expenses that overlap the selected week but have date_frais outside it
      const { data: periodFraisWeek } = await supabase
        .from("frais")
        .select("id, montant, date_frais, categorie, date_debut, date_fin")
        .eq("user_id", user.id)
        .not("date_debut", "is", null)
        .not("date_fin", "is", null)
        .lte("date_debut", weekEndStr)
        .gte("date_fin", weekStartStr);

      // Fetch period-based expenses that overlap the selected month but have date_frais outside it
      const { data: periodFraisMonth } = await supabase
        .from("frais")
        .select("id, montant, date_frais, categorie, date_debut, date_fin")
        .eq("user_id", user.id)
        .not("date_debut", "is", null)
        .not("date_fin", "is", null)
        .lte("date_debut", monthEndStr)
        .gte("date_fin", monthStartStr);

      // Update all frais history for the collapsible list
      if (allHistoryFrais) {
        setAllFraisHistory(allHistoryFrais);
      }

      if (monthFrais) {
        setAllFraisData(monthFrais);
        setFraisData(monthFrais.slice(0, 10));

        // Helper: parse YYYY-MM-DD as local date (not UTC)
        const parseLocalDate = (dateStr: string): Date => {
          const [y, m, d] = dateStr.split("-").map(Number);
          return new Date(y, m - 1, d);
        };

        // Helper: calculate prorated amount for a period-based expense within a date range
        const getProratedAmount = (frais: { montant: number; date_debut: string | null; date_fin: string | null; categorie: string }, rangeStart: Date, rangeEnd: Date): number => {
          const hasPeriod = frais.date_debut && frais.date_fin && 
            (frais.categorie === "location_vehicule" || frais.categorie === "hotel");
          
          if (!hasPeriod || !frais.date_debut || !frais.date_fin) {
            return Number(frais.montant);
          }
          
          const periodStart = parseLocalDate(frais.date_debut);
          const periodEnd = parseLocalDate(frais.date_fin);
          const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          
          // Overlap between period and range
          const overlapStart = new Date(Math.max(periodStart.getTime(), rangeStart.getTime()));
          const overlapEnd = new Date(Math.min(periodEnd.getTime(), rangeEnd.getTime()));
          const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          
          return (Number(frais.montant) / totalDays) * overlapDays;
        };

        // Jour: frais du jour sélectionné (prorated for period expenses)
        // Combine monthFrais + periodFraisMonth to catch period expenses from other months
        const dayStart = parseLocalDate(selectedDayStr);
        const dayEnd = parseLocalDate(selectedDayStr);
        const allDayFraisMap = new Map<string, any>();
        monthFrais.forEach(f => allDayFraisMap.set(f.id, f));
        (periodFraisMonth || []).forEach(f => allDayFraisMap.set(f.id, f));
        const jourTotal = Array.from(allDayFraisMap.values())
          .filter(f => {
            if (f.date_frais === selectedDayStr) return true;
            // Include period expenses that cover this day
            if (f.date_debut && f.date_fin && (f.categorie === "location_vehicule" || f.categorie === "hotel")) {
              return f.date_debut <= selectedDayStr && f.date_fin >= selectedDayStr;
            }
            return false;
          })
          .reduce((sum: number, f: any) => sum + getProratedAmount(f, dayStart, dayEnd), 0);
        
        // Semaine: combine regular week frais + period frais overlapping
        const allWeekFraisMap = new Map<string, any>();
        (weekFrais || []).forEach(f => allWeekFraisMap.set(f.id, f));
        (periodFraisWeek || []).forEach(f => allWeekFraisMap.set(f.id, f));
        const semaineTotal = Array.from(allWeekFraisMap.values())
          .reduce((sum, f) => sum + getProratedAmount(f, weekStart, weekEnd), 0);
        
        // Mois: sum raw montant of all frais whose date_frais falls in the selected month
        // This matches the history breakdown the user sees
        const moisTotal = monthFrais
          .reduce((sum: number, f: any) => sum + Number(f.montant), 0);

        setTotaux({
          jour: jourTotal,
          semaine: semaineTotal,
          mois: moisTotal,
        });
      }
    };

    fetchFrais();
  }, [user, addFraisOpen, refreshKey, selectedDate, selectedWeekStart]);

  const handleAddFrais = async () => {
    if (!user || !newFrais.montant) {
      toast.error("Veuillez renseigner un montant");
      return;
    }

    setSavingFrais(true);
    try {
      const { error } = await supabase.from("frais").insert({
        user_id: user.id,
        montant: parseFloat(newFrais.montant),
        categorie: newFrais.categorie as "carburant" | "repas" | "hotel" | "peage" | "parking" | "train" | "location_vehicule" | "autre",
        description: newFrais.description || null,
        fournisseur: newFrais.fournisseur || null,
        date_frais: clampDateToToday(newFrais.date_frais),
        date_debut: newFrais.date_debut || null,
        date_fin: newFrais.date_fin || null,
      });

      if (error) throw error;

      toast.success("Frais ajouté");
      setAddFraisOpen(false);
      setNewFrais({
        montant: "",
        categorie: "autre",
        description: "",
        fournisseur: "",
        date_frais: formatLocalDate(new Date()),
        date_debut: "",
        date_fin: "",
      });
    } catch (err) {
      console.error("Error adding frais:", err);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSavingFrais(false);
    }
  };

  const openEditDialog = (frais: FraisItem) => {
    setEditingFrais(frais);
    setEditForm({
      montant: String(frais.montant),
      categorie: frais.categorie,
      description: frais.description || "",
      date_frais: frais.date_frais,
      date_debut: frais.date_debut || "",
      date_fin: frais.date_fin || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditFrais = async () => {
    if (!user || !editingFrais || !editForm.montant) {
      toast.error("Veuillez renseigner un montant");
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("frais")
        .update({
          montant: parseFloat(editForm.montant),
          categorie: editForm.categorie as "carburant" | "repas" | "hotel" | "peage" | "parking" | "train" | "location_vehicule" | "autre",
          description: editForm.description || null,
          date_frais: editForm.date_frais,
          date_debut: editForm.date_debut || null,
          date_fin: editForm.date_fin || null,
        })
        .eq("id", editingFrais.id);

      if (error) throw error;

      toast.success("Frais modifié");
      setEditDialogOpen(false);
      setEditingFrais(null);
      
      // Refresh all data
      triggerRefresh();
    } catch (err) {
      console.error("Error editing frais:", err);
      toast.error("Erreur lors de la modification");
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteDialog = (fraisId: string) => {
    setFraisToDelete(fraisId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteFrais = async () => {
    if (!fraisToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("frais")
        .delete()
        .eq("id", fraisToDelete);

      if (error) throw error;

      toast.success("Frais supprimé");
      setDeleteDialogOpen(false);
      setFraisToDelete(null);
      
      // Refresh all data
      triggerRefresh();
    } catch (err) {
      console.error("Error deleting frais:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const caVariation = venteStats && venteStats.caPrevMonth > 0 
    ? ((venteStats.caMonth - venteStats.caPrevMonth) / venteStats.caPrevMonth * 100)
    : 0;

  return (
    <MobileLayout title="Finance">
      <BlurOverlay storageKey="finance">
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Tabs Ventes / Frais */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ventes" className="gap-1">
              <TrendingUp className="h-4 w-4" />
              Ventes
            </TabsTrigger>
            <TabsTrigger value="frais" className="gap-1">
              <Receipt className="h-4 w-4" />
              Frais
            </TabsTrigger>
          </TabsList>

          {/* Tab Ventes */}
          <TabsContent value="ventes" className="space-y-4 mt-4">
            {loadingVentes ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24 col-span-2" />
                </div>
              </div>
            ) : venteStats ? (
              <>
                {/* CA du mois */}
                <Card className="bg-gradient-hero text-primary-foreground shadow-card cursor-pointer hover:shadow-xl transition-shadow" onClick={() => openFinanceStatDialog('caMois')}>
                  <CardContent className="p-6">
                    <div className="text-center space-y-2">
                      <p className="text-sm opacity-90">Chiffre d'affaires ce mois</p>
                      <p className="text-4xl font-bold">
                        {venteStats.caMonth.toLocaleString("fr-FR")} €
                      </p>
                      {caVariation !== 0 && (
                        <div className={`flex items-center justify-center gap-1 text-sm ${caVariation >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                          {caVariation >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span>{caVariation >= 0 ? '+' : ''}{caVariation.toFixed(0)}% vs mois dernier</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Stats grid - responsive */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="shadow-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => openFinanceStatDialog('commissionsMois')}>
                    <CardContent className="p-4 text-center">
                      <Euro className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold text-foreground">
                        {venteStats.commissionsMonth.toLocaleString("fr-FR")} €
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Commissions ce mois <span className="font-medium">(HT)</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => openFinanceStatDialog('signesMois')}>
                    <CardContent className="p-4 text-center">
                      <Calendar className="h-6 w-6 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold text-foreground">
                        {venteStats.signedCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dossiers signés ce mois
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-6 w-6 mx-auto mb-2 text-status-signed" />
                      <p className="text-xl font-bold text-foreground">
                        {venteStats.avgDeal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Panier moyen
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => openFinanceStatDialog('enCours')}>
                    <CardContent className="p-4 text-center">
                      <CheckCircle className="h-6 w-6 mx-auto mb-2 text-status-signed" />
                      <p className="text-sm text-muted-foreground">En cours</p>
                      <p className="text-lg font-bold text-foreground">{venteStats.ventesEnCours}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Répartition des commissions */}
                <Card className="shadow-card border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Répartition des commissions <span className="text-xs">(HT)</span></p>
                    
                    {/* Com En Cours (non posé) */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-200 cursor-pointer hover:bg-orange-500/20 transition-colors"
                      onClick={() => openFinanceStatDialog('enCours')}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-orange-700">En cours</p>
                          <p className="text-xs text-orange-600/80">Non posé (signé → installation)</p>
                        </div>
                      </div>
                      <p className="text-base font-bold text-orange-700 whitespace-nowrap">
                        {venteStats.comEnCours.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    
                    {/* En attente de facturation (posé < 2 semaines) */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-200 cursor-pointer hover:bg-blue-500/20 transition-colors"
                      onClick={() => openFinanceStatDialog('attenteFacturation')}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-700">En attente de facturation</p>
                          <p className="text-xs text-blue-600/80">Posé &lt; 2 semaines</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-blue-700 whitespace-nowrap">
                        {venteStats.comAttenteFacturation.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    
                    {/* Attente de paiement (posé >= 2 semaines, non facturé payé) */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-200 cursor-pointer hover:bg-green-500/20 transition-colors"
                      onClick={() => openFinanceStatDialog('aFacturer')}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-700">Attente de paiement</p>
                          <p className="text-xs text-green-600/80">Posé ≥ 2 semaines</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-green-700 whitespace-nowrap">
                        {venteStats.comAFacturer.toLocaleString("fr-FR")} €
                      </p>
                    </div>

                    {/* Com Payées */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-300 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                      onClick={() => openFinanceStatDialog('payees')}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-700" />
                        <div>
                          <p className="text-sm font-medium text-emerald-700">Déjà payées</p>
                          <p className="text-xs text-emerald-600/80">Commissions encaissées</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-emerald-700 whitespace-nowrap">
                        {venteStats.comPayees.toLocaleString("fr-FR")} €
                      </p>
                    </div>

                    {/* Séparateur et Total */}
                    <div className="border-t border-dashed pt-3 mt-2">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/15 border-2 border-amber-400">
                        <div className="flex items-center gap-2">
                          <Euro className="h-4 w-4 text-amber-700" />
                          <p className="text-xs font-bold text-amber-800">TOTAL POTENTIEL HT</p>
                        </div>
                        <p className="text-base font-bold text-amber-800 whitespace-nowrap">
                          {venteStats.comPotentielleTotale.toLocaleString("fr-FR")} €
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section Facturation - Dossiers en attente de paiement */}
                <BillingSection />

                {/* Ventes annulées */}
                <Card className="shadow-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => openFinanceStatDialog('annulees')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-muted-foreground">Annulées ce mois:</span>
                      <span className="font-semibold">{venteStats.ventesAnnulees}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Rentabilité Nette */}
                <Card className="shadow-card border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Rentabilité nette (Comm. - Frais)
                        </p>
                        <p className={`text-2xl font-bold ${
                          (venteStats.commissionsMonth - totaux.mois) >= 0 
                            ? 'text-status-signed' 
                            : 'text-destructive'
                        }`}>
                          {(venteStats.commissionsMonth - totaux.mois).toLocaleString("fr-FR")} €
                        </p>
                      </div>
                      <FileText className="h-8 w-8 text-primary/50" />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center text-muted-foreground">
                  Aucune donnée de vente disponible
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Frais */}
          <TabsContent value="frais" className="space-y-4 mt-4">
            {/* Navigation mois avec objectif */}
            <Card className="shadow-card border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth(-1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center flex-1">
                    <p className="text-sm font-medium text-foreground capitalize">
                      {selectedDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </p>
                    {!isCurrentMonth && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setSelectedDate(new Date())}
                        className="h-5 p-0 text-xs text-muted-foreground"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Aujourd'hui
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth(1)}
                    className="h-8 w-8 p-0"
                    disabled={isCurrentMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Objectif mensuel */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Objectif Dépenses</p>
                    <p className="text-xs text-muted-foreground">
                      {totaux.mois.toFixed(0)}€ / {objectifFrais}€
                    </p>
                  </div>
                  <div className={`text-2xl font-bold ${
                    (totaux.mois / objectifFrais) * 100 <= 80 ? 'text-green-600' :
                    (totaux.mois / objectifFrais) * 100 <= 100 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {Math.round((totaux.mois / objectifFrais) * 100)}%
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all ${
                      (totaux.mois / objectifFrais) * 100 <= 80 ? 'bg-green-500' :
                      (totaux.mois / objectifFrais) * 100 <= 100 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((totaux.mois / objectifFrais) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Totaux jour/semaine/mois — cliquables pour filtrer le graphique */}
            <div className="grid grid-cols-3 gap-2">
              {/* Jour avec navigation */}
              <Card 
                className={cn(
                  "shadow-card cursor-pointer transition-all",
                  selectedPeriod === 'jour' && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setSelectedPeriod('jour')}
              >
                <CardContent className="p-2 text-center space-y-1">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigateDay(-1); setSelectedPeriod('jour'); }}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <p className={cn("text-lg font-bold", selectedPeriod === 'jour' ? "text-primary" : "text-foreground")}>
                      {totaux.jour.toFixed(0)} €
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigateDay(1); setSelectedPeriod('jour'); }}
                      className="h-6 w-6 p-0"
                      disabled={isToday}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {isToday ? "Aujourd'hui" : selectedDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                </CardContent>
              </Card>
              
              {/* Semaine avec navigation */}
              <Card 
                className={cn(
                  "shadow-card cursor-pointer transition-all",
                  selectedPeriod === 'semaine' && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setSelectedPeriod('semaine')}
              >
                <CardContent className="p-2 text-center space-y-1">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigateWeek(-1); setSelectedPeriod('semaine'); }}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <p className={cn("text-lg font-bold", selectedPeriod === 'semaine' ? "text-primary" : "text-foreground")}>
                      {totaux.semaine.toFixed(0)} €
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigateWeek(1); setSelectedPeriod('semaine'); }}
                      className="h-6 w-6 p-0"
                      disabled={isCurrentWeek}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {isCurrentWeek ? "Cette semaine" : `${selectedWeekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} - ${new Date(selectedWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                  </p>
                </CardContent>
              </Card>
              
              {/* Mois */}
              <Card 
                className={cn(
                  "shadow-card cursor-pointer transition-all",
                  selectedPeriod === 'mois' && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setSelectedPeriod('mois')}
              >
                <CardContent className="p-2 text-center space-y-1">
                  <p className={cn("text-lg font-bold pt-1", selectedPeriod === 'mois' ? "text-primary" : "text-foreground")}>
                    {totaux.mois.toFixed(0)} €
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight capitalize">
                    {isCurrentMonth ? "Ce mois" : selectedDate.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Custom date range picker */}
            <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
                  className={cn(
                    "w-full gap-2 h-10",
                    selectedPeriod === 'custom' && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => {
                    if (selectedPeriod === 'custom') {
                      setCustomRangeOpen(true);
                    } else {
                      setSelectedPeriod('custom');
                      setCustomRangeOpen(true);
                    }
                  }}
                >
                  <CalendarRange className="h-4 w-4" />
                  {selectedPeriod === 'custom' && customRange?.from ? (
                    <span className="text-sm">
                      {format(customRange.from, "d MMM", { locale: frLocale })}
                      {customRange.to && ` → ${format(customRange.to, "d MMM yyyy", { locale: frLocale })}`}
                    </span>
                  ) : (
                    <span className="text-sm">Sélectionner une période</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarPicker
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    setSelectedPeriod('custom');
                    // Auto-close when both dates selected
                    if (range?.from && range?.to) {
                      setTimeout(() => setCustomRangeOpen(false), 300);
                    }
                  }}
                  numberOfMonths={1}
                  locale={frLocale}
                  className={cn("p-3 pointer-events-auto")}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>

            {/* Expense Chart — filtered by period */}
            <ExpenseChart frais={chartFrais} />

            {/* Actions - Stack on mobile */}
            <div className="space-y-2">
              <Button 
                className="w-full bg-gradient-hero gap-2 h-12"
                onClick={() => setMultiImportOpen(true)}
              >
                <Plus className="h-5 w-5" />
                Importer des factures
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Dialog open={bankImportOpen} onOpenChange={setBankImportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 h-11 w-full">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span className="truncate">Import CSV</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-lg max-h-[85vh] overflow-hidden">
                    <BankImport 
                      onSuccess={() => {
                        setBankImportOpen(false);
                        // Refresh data
                        if (user) {
                          supabase
                            .from("frais")
                            .select("*")
                            .eq("user_id", user.id)
                            .order("date_frais", { ascending: false })
                            .limit(10)
                            .then(({ data }) => {
                              if (data) setFraisData(data as FraisItem[]);
                            });
                        }
                      }}
                      onCancel={() => setBankImportOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
                
                <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 h-11 w-full">
                      <FolderOpen className="h-4 w-4" />
                      <span className="truncate">Factures</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-lg max-h-[85vh]">
                    <ReceiptGallery onClose={() => setGalleryOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            {/* Plaid Bank Connection */}
            <PlaidLink 
              onTransactionsImported={() => {
                // Refresh frais data
                if (user) {
                  supabase
                    .from("frais")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("date_frais", { ascending: false })
                    .limit(10)
                    .then(({ data }) => {
                      if (data) setFraisData(data as FraisItem[]);
                    });
                }
              }}
            />
            
            {/* Export & Reports */}
            <div className="flex gap-2">
              <VATReport 
                frais={allFraisData} 
                periode={new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} 
              />
              <ExportFraisPDF 
                frais={fraisData} 
                periode={new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} 
              />
            </div>

            {/* Liste des frais groupés par année puis par mois */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Historique des frais
              </h3>
              {fraisGroupedByYear.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucun frais enregistré
                  </CardContent>
                </Card>
              ) : (
                fraisGroupedByYear.map((yearGroup) => {
                  const isYearExpanded = expandedYears.has(yearGroup.year);
                  return (
                    <Collapsible
                      key={yearGroup.year}
                      open={isYearExpanded}
                      onOpenChange={() => toggleYear(yearGroup.year)}
                    >
                      <Card className="shadow-card overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors bg-muted/30">
                            <div className="flex items-center gap-3">
                              {isYearExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="text-left">
                                <p className="text-base font-bold text-foreground">
                                  {yearGroup.year}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {yearGroup.months.length} mois • {yearGroup.months.reduce((sum, m) => sum + m.frais.length, 0)} frais
                                </p>
                              </div>
                            </div>
                            <p className="font-bold text-destructive text-base">
                              -{yearGroup.total.toFixed(2)} €
                            </p>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t">
                            {yearGroup.months.map((monthGroup) => {
                              const isMonthExpanded = expandedMonths.has(monthGroup.key);
                              return (
                                <Collapsible
                                  key={monthGroup.key}
                                  open={isMonthExpanded}
                                  onOpenChange={() => toggleMonth(monthGroup.key)}
                                >
                                  <CollapsibleTrigger asChild>
                                    <button className="w-full p-3 pl-8 flex items-center justify-between hover:bg-muted/50 transition-colors border-b last:border-b-0">
                                      <div className="flex items-center gap-3">
                                        {isMonthExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                        <div className="text-left">
                                          <p className="text-sm font-semibold capitalize">
                                            {monthGroup.label}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {monthGroup.frais.length} frais
                                          </p>
                                        </div>
                                      </div>
                                      <p className="font-semibold text-destructive">
                                        -{monthGroup.total.toFixed(2)} €
                                      </p>
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="bg-muted/20 divide-y">
                                      {monthGroup.frais.map((frais) => {
                                        const Icon = categoryIcons[frais.categorie] || HelpCircle;
                                        const colors = categoryColors[frais.categorie] || categoryColors.autre;
                                        return (
                                          <div key={frais.id} className="p-3 pl-12 flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${colors.bg}`}>
                                              <Icon className={`h-4 w-4 ${colors.icon}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-foreground truncate">
                                                {frais.description || categoryLabels[frais.categorie]}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {new Date(frais.date_frais).toLocaleDateString("fr-FR")} • <span className={colors.text}>{categoryLabels[frais.categorie]}</span>
                                              </p>
                                              {(frais.categorie === "location_vehicule" || frais.categorie === "hotel") && frais.date_debut && frais.date_fin && (
                                                <p className="text-xs text-primary mt-0.5">
                                                  📅 Du {new Date(frais.date_debut).toLocaleDateString("fr-FR")} au {new Date(frais.date_fin).toLocaleDateString("fr-FR")} ({Math.ceil((new Date(frais.date_fin).getTime() - new Date(frais.date_debut).getTime()) / (1000 * 60 * 60 * 24)) + 1}j • réparti)
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <p className="font-semibold text-destructive whitespace-nowrap text-sm">
                                                -{Number(frais.montant).toFixed(2)} €
                                              </p>
                                              {frais.justificatif_url && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 shrink-0 text-primary"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const url = frais.justificatif_url!;
                                                    const isPdf = url.includes(".pdf") || url.includes("application/pdf");
                                                    if (url.startsWith("data:")) {
                                                      setReceiptPreviewUrl(url);
                                                    } else if (isPdf) {
                                                      setReceiptPreviewUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`);
                                                    } else {
                                                      setReceiptPreviewUrl(url);
                                                    }
                                                    setReceiptPreviewOpen(true);
                                                  }}
                                                >
                                                  <Paperclip className="h-4 w-4" />
                                                </Button>
                                              )}
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  {frais.justificatif_url && (
                                                    <DropdownMenuItem onClick={async () => {
                                                      try {
                                                        const url = frais.justificatif_url!;
                                                        let extension = "jpg";
                                                        if (url.includes(".pdf") || url.startsWith("data:application/pdf")) extension = "pdf";
                                                        else if (url.includes(".png") || url.startsWith("data:image/png")) extension = "png";
                                                        const fileName = `facture_${frais.date_frais}_${categoryLabels[frais.categorie]}.${extension}`;
                                                        if (url.startsWith("data:")) {
                                                          const link = document.createElement("a");
                                                          link.href = url;
                                                          link.download = fileName;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                        } else {
                                                          const response = await fetch(url);
                                                          const blob = await response.blob();
                                                          const blobUrl = URL.createObjectURL(blob);
                                                          const link = document.createElement("a");
                                                          link.href = blobUrl;
                                                          link.download = fileName;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                          URL.revokeObjectURL(blobUrl);
                                                        }
                                                        toast.success("Téléchargement lancé");
                                                      } catch { toast.error("Erreur de téléchargement"); }
                                                    }}>
                                                      <Download className="h-4 w-4 mr-2" />
                                                      Télécharger la facture
                                                    </DropdownMenuItem>
                                                  )}
                                                  <DropdownMenuItem onClick={() => openEditDialog(frais)}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Modifier
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    onClick={() => openDeleteDialog(frais.id)}
                                                    className="text-destructive focus:text-destructive"
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Supprimer
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </div>

            {/* Ajouter frais manuel */}
            <Dialog open={addFraisOpen} onOpenChange={setAddFraisOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter frais manuel
                </Button>
              </DialogTrigger>
               <DialogContent className="max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Ajouter un frais</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="montant">Montant TTC (€)</Label>
                    <Input
                      id="montant"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newFrais.montant}
                      onChange={(e) => setNewFrais(prev => ({ ...prev, montant: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="categorie">Catégorie</Label>
                    <Select
                      value={newFrais.categorie}
                      onValueChange={(v) => setNewFrais(prev => ({ ...prev, categorie: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => {
                          const Icon = categoryIcons[key] || HelpCircle;
                          const colors = categoryColors[key] || categoryColors.autre;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${colors.icon}`} />
                                <span>{label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newFrais.date_frais}
                      onChange={(e) => setNewFrais(prev => ({ ...prev, date_frais: e.target.value }))}
                    />
                  </div>

                  {(newFrais.categorie === "hotel" || newFrais.categorie === "location_vehicule") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="date_debut">Date début</Label>
                        <Input
                          id="date_debut"
                          type="date"
                          value={newFrais.date_debut}
                          onChange={(e) => setNewFrais(prev => ({ ...prev, date_debut: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_fin">Date fin</Label>
                        <Input
                          id="date_fin"
                          type="date"
                          value={newFrais.date_fin}
                          onChange={(e) => setNewFrais(prev => ({ ...prev, date_fin: e.target.value }))}
                        />
                      </div>
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Le montant sera réparti au prorata sur la période
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optionnel)</Label>
                    <Input
                      id="description"
                      placeholder="Ex: Station Total, Restaurant..."
                      value={newFrais.description}
                      onChange={(e) => setNewFrais(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  <Button 
                    className="w-full" 
                    onClick={handleAddFrais}
                    disabled={savingFrais}
                  >
                    {savingFrais ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Modifier le frais</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-montant">Montant TTC (€)</Label>
                    <Input
                      id="edit-montant"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.montant}
                      onChange={(e) => setEditForm(prev => ({ ...prev, montant: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-categorie">Catégorie</Label>
                    <Select
                      value={editForm.categorie}
                      onValueChange={(v) => setEditForm(prev => ({ ...prev, categorie: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => {
                          const Icon = categoryIcons[key] || HelpCircle;
                          const colors = categoryColors[key] || categoryColors.autre;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${colors.icon}`} />
                                <span>{label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editForm.date_frais}
                      onChange={(e) => setEditForm(prev => ({ ...prev, date_frais: e.target.value }))}
                    />
                  </div>

                  {(editForm.categorie === "hotel" || editForm.categorie === "location_vehicule") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-date_debut">Date début</Label>
                        <Input
                          id="edit-date_debut"
                          type="date"
                          value={editForm.date_debut}
                          onChange={(e) => setEditForm(prev => ({ ...prev, date_debut: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-date_fin">Date fin</Label>
                        <Input
                          id="edit-date_fin"
                          type="date"
                          value={editForm.date_fin}
                          onChange={(e) => setEditForm(prev => ({ ...prev, date_fin: e.target.value }))}
                        />
                      </div>
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Le montant sera réparti au prorata sur la période
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description (optionnel)</Label>
                    <Input
                      id="edit-description"
                      placeholder="Ex: Station Total, Restaurant..."
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  <Button 
                    className="w-full" 
                    onClick={handleEditFrais}
                    disabled={savingEdit}
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer les modifications"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce frais ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Le frais sera définitivement supprimé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteFrais}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      "Supprimer"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        </Tabs>

        {/* Multi Import Flow */}
        <MultiImportFlow
          isOpen={multiImportOpen}
          context="finance"
          onSuccess={() => {
            setMultiImportOpen(false);
            // Trigger full refresh of all data
            triggerRefresh();
          }}
          onClose={() => setMultiImportOpen(false)}
        />
      </div>

      {/* Finance Stat Detail Dialog */}
      <StatDetailDialog
        open={financeStatDialogOpen}
        onOpenChange={setFinanceStatDialogOpen}
        title={getFinanceDialogData.title}
        subtitle={getFinanceDialogData.subtitle}
        items={getFinanceDialogData.items}
        total={getFinanceDialogData.total}
        emptyMessage="Aucune vente"
        onRefresh={triggerRefresh}
      />

      {/* Receipt Preview Dialog */}
      <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Aperçu de la facture</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {receiptPreviewUrl?.startsWith("data:image") ? (
              <img
                src={receiptPreviewUrl}
                alt="Facture"
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : receiptPreviewUrl ? (
              <iframe
                src={receiptPreviewUrl}
                className="w-full h-[70vh] rounded-lg border"
                title="Aperçu facture"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      </BlurOverlay>
    </MobileLayout>
  );
};

export default Finance;
