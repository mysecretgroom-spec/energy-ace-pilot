import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EtudeData, getEtudePdfBlob } from "@/lib/exportEtudePdf";
import { toast } from "sonner";

interface UseEtudePdfAutoSaveProps {
  etudeId: string | null;
  clientName: string;
  clientPrenom: string;
  userId: string | null;
  isInitialized: boolean;
  buildPdfData: () => EtudeData | null;
}

interface UseEtudePdfAutoSaveReturn {
  generateAndStorePdf: () => Promise<string | null>;
  getLatestPdfUrl: () => Promise<string | null>;
  lastPdfUrl: string | null;
}

const PDF_AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useEtudePdfAutoSave = ({
  etudeId,
  clientName,
  clientPrenom,
  userId,
  isInitialized,
  buildPdfData,
}: UseEtudePdfAutoSaveProps): UseEtudePdfAutoSaveReturn => {
  const lastPdfUrlRef = useRef<string | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastGeneratedAtRef = useRef<Date | null>(null);

  // Generate PDF and upload to Supabase Storage
  const generateAndStorePdf = useCallback(async (): Promise<string | null> => {
    if (!etudeId || !userId) {
      console.log("[PDF AutoSave] No etudeId or userId, skipping");
      return null;
    }

    const pdfData = buildPdfData();
    if (!pdfData) {
      console.log("[PDF AutoSave] No PDF data available, skipping");
      return null;
    }

    try {
      console.log("[PDF AutoSave] Generating PDF...");
      const pdfBlob = await getEtudePdfBlob(pdfData);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = `${clientPrenom}_${clientName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${userId}/${etudeId}/${safeName}_${timestamp}.pdf`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("etudes-pdf")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: false, // Don't overwrite, create new version
        });

      if (error) {
        // If bucket doesn't exist, try to create it (will fail silently if exists)
        if (error.message?.includes("Bucket not found")) {
          console.log("[PDF AutoSave] Bucket not found, PDF not stored");
          return null;
        }
        throw error;
      }

      // Get signed URL for the uploaded PDF
      const { data: signedUrlData } = await supabase.storage
        .from("etudes-pdf")
        .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days expiry

      const pdfUrl = signedUrlData?.signedUrl || null;
      lastPdfUrlRef.current = pdfUrl;
      lastGeneratedAtRef.current = new Date();

      // Update etude record with latest PDF URL
      await supabase
        .from("etudes")
        .update({ 
          pdf_url: data.path, // Store the path, not signed URL
          pdf_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", etudeId);

      console.log("[PDF AutoSave] PDF generated and stored:", data.path);
      return pdfUrl;
    } catch (error) {
      console.error("[PDF AutoSave] Error generating/storing PDF:", error);
      return null;
    }
  }, [etudeId, userId, clientName, clientPrenom, buildPdfData]);

  // Get latest PDF URL from storage
  const getLatestPdfUrl = useCallback(async (): Promise<string | null> => {
    if (!etudeId || !userId) return null;

    try {
      // List files in the etude folder
      const { data: files, error } = await supabase.storage
        .from("etudes-pdf")
        .list(`${userId}/${etudeId}`, {
          sortBy: { column: "created_at", order: "desc" },
          limit: 1,
        });

      if (error || !files || files.length === 0) {
        return null;
      }

      // Get signed URL for the latest file
      const { data: signedUrlData } = await supabase.storage
        .from("etudes-pdf")
        .createSignedUrl(`${userId}/${etudeId}/${files[0].name}`, 60 * 60 * 24); // 24h expiry

      return signedUrlData?.signedUrl || null;
    } catch (error) {
      console.error("[PDF AutoSave] Error getting latest PDF:", error);
      return null;
    }
  }, [etudeId, userId]);

  // Auto-save PDF every 5 minutes
  useEffect(() => {
    if (!isInitialized || !etudeId) return;

    // Clear any existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up auto-save interval
    autoSaveIntervalRef.current = setInterval(async () => {
      console.log("[PDF AutoSave] Auto-generating PDF (5-minute interval)");
      const url = await generateAndStorePdf();
      if (url) {
        console.log("[PDF AutoSave] Auto-save completed");
      }
    }, PDF_AUTO_SAVE_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [isInitialized, etudeId, generateAndStorePdf]);

  return {
    generateAndStorePdf,
    getLatestPdfUrl,
    lastPdfUrl: lastPdfUrlRef.current,
  };
};
