import { useState, useRef } from "react";
import { VenteCard } from "./VenteCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticFeedback } from "@/lib/haptics";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { VenteStatus, VENTE_STATUS_LABELS } from "@/lib/venteStatusConfig";

const PIPELINE_ORDER: VenteStatus[] = [
  'en_negociation',
  'signe',
  'cq_a_faire',
  'cq_fait',
  'attente_financement',
  'envoi_pose',
  'en_installation',
  'installe',
  'attente_paiement',
  'paye',
];

const STATUS_LABELS = VENTE_STATUS_LABELS;

interface Regie {
  id: string;
  nom: string;
  couleur: string;
}

interface SwipeableVenteCardProps {
  vente: any;
  commission?: any;
  regies?: Regie[];
  selectionMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  onRefresh?: () => void;
}

export function SwipeableVenteCard({ vente, commission, regies, selectionMode, isSelected, onClick, onRefresh }: SwipeableVenteCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [updating, setUpdating] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const threshold = 80;

  if (selectionMode || vente.status === 'annule' || vente.status === 'refus_financement' || vente.status === 'paye') {
    return (
      <VenteCard
        vente={vente}
        commission={commission}
        regies={regies}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onClick={onClick}
        onRefresh={onRefresh}
      />
    );
  }

  const currentIndex = PIPELINE_ORDER.indexOf(vente.status);
  const canGoNext = currentIndex >= 0 && currentIndex < PIPELINE_ORDER.length - 1;
  const canGoPrev = currentIndex > 0;
  const nextStatus = canGoNext ? PIPELINE_ORDER[currentIndex + 1] : null;
  const prevStatus = canGoPrev ? PIPELINE_ORDER[currentIndex - 1] : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isHorizontal.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    // Limit swipe based on available directions
    let clampedDx = dx;
    if (!canGoNext && dx < 0) clampedDx = 0;
    if (!canGoPrev && dx > 0) clampedDx = 0;
    
    // Rubber band effect
    const maxSwipe = 120;
    clampedDx = Math.sign(clampedDx) * Math.min(Math.abs(clampedDx), maxSwipe);
    
    setOffsetX(clampedDx);
  };

  const handleTouchEnd = async () => {
    isDragging.current = false;
    isHorizontal.current = null;

    if (Math.abs(offsetX) >= threshold) {
      const newStatus = offsetX < 0 ? nextStatus : prevStatus;
      if (newStatus) {
        hapticFeedback("medium");
        
        // Optimistic update: show success immediately
        const previousStatus = vente.status;
        toast.success(`→ ${STATUS_LABELS[newStatus]}`);
        onRefresh?.();
        
        const updateData: any = { status: newStatus };
        if (newStatus === 'installe' && !vente.date_installation_reelle) {
          updateData.date_installation_reelle = new Date().toISOString().split('T')[0];
        }
        
        const { error } = await supabase
          .from("ventes")
          .update(updateData)
          .eq("id", vente.id);

        if (error) {
          // Rollback on error
          toast.error("Erreur de mise à jour");
          await supabase.from("ventes").update({ status: previousStatus }).eq("id", vente.id);
          onRefresh?.();
        }
      }
    }
    setOffsetX(0);
  };

  const showNext = offsetX < -20 && nextStatus;
  const showPrev = offsetX > 20 && prevStatus;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Background indicators */}
      {showPrev && (
        <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center bg-amber-500/20 rounded-l-lg z-0">
          <div className="flex flex-col items-center gap-0.5">
            <ChevronLeft className="h-4 w-4 text-amber-600" />
            <span className="text-[9px] font-medium text-amber-600">{STATUS_LABELS[prevStatus!]}</span>
          </div>
        </div>
      )}
      {showNext && (
        <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-green-500/20 rounded-r-lg z-0">
          <div className="flex flex-col items-center gap-0.5">
            <ChevronRight className="h-4 w-4 text-green-600" />
            <span className="text-[9px] font-medium text-green-600">{STATUS_LABELS[nextStatus!]}</span>
          </div>
        </div>
      )}
      
      <div
        className="relative z-10 transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease-out",
          opacity: updating ? 0.5 : 1,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <VenteCard
          vente={vente}
          commission={commission}
          regies={regies}
          selectionMode={selectionMode}
          isSelected={isSelected}
          onClick={onClick}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
