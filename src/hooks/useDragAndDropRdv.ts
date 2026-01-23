import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, setHours, setMinutes } from "date-fns";

interface UseDragAndDropRdvOptions {
  onSuccess?: () => void;
}

export function useDragAndDropRdv({ onSuccess }: UseDragAndDropRdvOptions = {}) {
  const { toast } = useToast();

  const handleDrop = async (
    rdvId: string, 
    currentTime: string, 
    targetDate: Date, 
    targetTime?: string,
    clientName?: string
  ) => {
    try {
      // Build the new date with time
      let newDateTime: Date;
      
      if (targetTime) {
        // Parse time string (HH:mm)
        const [hours, minutes] = targetTime.split(":").map(Number);
        newDateTime = setMinutes(setHours(targetDate, hours), minutes);
      } else {
        // Keep original time, just change date
        const [hours, minutes] = currentTime.split(":").map(Number);
        newDateTime = setMinutes(setHours(targetDate, hours), minutes);
      }

      const { error } = await supabase
        .from("rdv")
        .update({ date_heure: newDateTime.toISOString() })
        .eq("id", rdvId);

      if (error) throw error;

      toast({
        title: "RDV déplacé",
        description: clientName 
          ? `${clientName} déplacé au ${format(newDateTime, "dd/MM à HH:mm")}`
          : `RDV déplacé au ${format(newDateTime, "dd/MM à HH:mm")}`,
      });

      onSuccess?.();
    } catch (error) {
      console.error("Error moving RDV:", error);
      toast({
        title: "Erreur",
        description: "Impossible de déplacer le RDV",
        variant: "destructive",
      });
    }
  };

  return {
    handleDrop,
  };
}
