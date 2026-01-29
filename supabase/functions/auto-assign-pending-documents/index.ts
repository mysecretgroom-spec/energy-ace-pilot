import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PendingDocument {
  id: string;
  user_id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  source: string;
  ai_detected_client_name: string | null;
  ai_detected_client_id: string | null;
  ai_detected_document_type: string | null;
  ai_confidence: number;
  ai_analysis_summary: string | null;
  auto_assign_after: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting auto-assignment of pending documents...");

    // Find pending documents where:
    // 1. Status is 'pending'
    // 2. auto_assign_after has passed
    // 3. ai_confidence >= 80 (high confidence)
    // 4. ai_detected_client_id is set
    const now = new Date().toISOString();
    
    const { data: pendingDocs, error: fetchError } = await supabase
      .from("pending_documents")
      .select("*")
      .eq("status", "pending")
      .not("ai_detected_client_id", "is", null)
      .gte("ai_confidence", 80)
      .lte("auto_assign_after", now)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending documents:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingDocs?.length || 0} documents ready for auto-assignment`);

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const doc of (pendingDocs as PendingDocument[]) || []) {
      try {
        results.processed++;

        // 1. Download file from pending-documents bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("pending-documents")
          .download(doc.storage_path);

        if (downloadError) {
          console.error(`Error downloading ${doc.id}:`, downloadError);
          results.errors.push(`${doc.id}: download failed`);
          results.failed++;
          continue;
        }

        // 2. Upload to documents bucket
        // Path MUST start with user_id to satisfy RLS policy: (auth.uid())::text = (storage.foldername(name))[1]
        const newPath = `${doc.user_id}/${doc.ai_detected_client_id}/${Date.now()}_${doc.original_filename}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(newPath, fileData, { 
            contentType: doc.mime_type || "application/octet-stream" 
          });

        if (uploadError) {
          console.error(`Error uploading ${doc.id}:`, uploadError);
          results.errors.push(`${doc.id}: upload failed`);
          results.failed++;
          continue;
        }

        // 3. Get public URL
        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(newPath);

        // 4. Create document record
        const { data: docRecord, error: insertError } = await supabase
          .from("documents")
          .insert({
            client_id: doc.ai_detected_client_id,
            user_id: doc.user_id,
            nom: doc.original_filename,
            type_document: doc.ai_detected_document_type || "autre",
            url: urlData.publicUrl,
            mime_type: doc.mime_type,
            taille_bytes: doc.file_size_bytes,
            context_source: doc.source,
            metadata: {
              auto_assigned: true,
              ai_confidence: doc.ai_confidence,
              original_pending_id: doc.id,
            },
          })
          .select("id")
          .single();

        if (insertError) {
          console.error(`Error creating document ${doc.id}:`, insertError);
          results.errors.push(`${doc.id}: insert failed`);
          results.failed++;
          continue;
        }

        // 5. Update pending document status
        await supabase
          .from("pending_documents")
          .update({
            status: "auto_assigned",
            assigned_client_id: doc.ai_detected_client_id,
            assigned_document_type: doc.ai_detected_document_type,
            assigned_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            final_document_id: docRecord.id,
          })
          .eq("id", doc.id);

        // 6. Delete from pending storage
        await supabase.storage
          .from("pending-documents")
          .remove([doc.storage_path]);

        console.log(`Auto-assigned document ${doc.id} to client ${doc.ai_detected_client_id}`);
        results.success++;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error processing ${doc.id}:`, err);
        results.errors.push(`${doc.id}: ${errorMessage}`);
        results.failed++;
      }
    }

    console.log(`Auto-assignment complete: ${results.success} success, ${results.failed} failed`);

    return new Response(JSON.stringify({
      message: "Auto-assignment complete",
      processed: results.processed,
      success: results.success,
      failed: results.failed,
      errors: results.errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Auto-assignment error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
