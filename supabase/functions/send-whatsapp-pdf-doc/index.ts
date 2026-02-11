import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPdfDocRequest {
  clientId: string;
  phoneNumber?: string;
  message?: string;
  includeEtude?: boolean;
  documentIds?: string[];
  generateOnly?: boolean; // Just generate PDF, don't send via Twilio
}

// Maximum PDF size for WhatsApp (16MB limit, we target 10MB to be safe)
const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// Compress image by reducing quality and dimensions
async function compressImage(imageData: Uint8Array, targetSizeKB: number = 500): Promise<Uint8Array> {
  // For now, return as-is - Deno doesn't have canvas
  // The edge function will handle compression at PDF level
  return imageData;
}

// Fetch file from URL and return as Uint8Array
async function fetchFileAsBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// Check if URL is an image
function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext));
}

// Check if URL is a PDF
function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId, phoneNumber, message, includeEtude = true, documentIds, generateOnly = false }: SendPdfDocRequest = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Missing clientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing documents for client ${clientId}`);

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("nom, prenom")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientName = `${client.prenom || ""} ${client.nom}`.trim();

    // Fetch documents for the client
    let documentsQuery = supabase
      .from("documents")
      .select("id, nom, url, mime_type, type_document")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (documentIds && documentIds.length > 0) {
      documentsQuery = documentsQuery.in("id", documentIds);
    }

    const { data: documents, error: docsError } = await documentsQuery;

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch documents" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally fetch etude PDF
    let etudePdfUrl: string | null = null;
    if (includeEtude) {
      const { data: etude } = await supabase
        .from("etudes")
        .select("pdf_url")
        .eq("client_id", clientId)
        .not("pdf_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (etude?.pdf_url) {
        etudePdfUrl = etude.pdf_url;
      }
    }

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;
    const processedDocs: string[] = [];

    // Process etude PDF first if exists
    if (etudePdfUrl) {
      try {
        console.log("Adding etude PDF...");
        const pdfBytes = await fetchFileAsBytes(etudePdfUrl);
        const pdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        totalPages += pages.length;
        processedDocs.push("Étude technique");
      } catch (err) {
        console.error("Error processing etude PDF:", err);
      }
    }

    // Process each document
    for (const doc of documents || []) {
      try {
        console.log(`Processing document: ${doc.nom}`);
        
        // Get signed URL if needed
        let fileUrl = doc.url;
        if (doc.url.includes("supabase") && !doc.url.includes("token=")) {
          // Extract bucket and path from URL
          const urlParts = doc.url.split("/storage/v1/object/public/");
          if (urlParts.length === 2) {
            const [bucket, ...pathParts] = urlParts[1].split("/");
            const path = pathParts.join("/");
            const { data: signedData } = await supabase.storage
              .from(bucket)
              .createSignedUrl(path, 3600);
            if (signedData?.signedUrl) {
              fileUrl = signedData.signedUrl;
            }
          }
        }

        const fileBytes = await fetchFileAsBytes(fileUrl);

        if (isPdfUrl(doc.url) || doc.mime_type === "application/pdf") {
          // Merge existing PDF
          const pdf = await PDFDocument.load(fileBytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
          totalPages += pages.length;
        } else if (isImageUrl(doc.url) || doc.mime_type?.startsWith("image/")) {
          // Convert image to PDF page
          let image;
          if (doc.mime_type === "image/png" || doc.url.toLowerCase().includes(".png")) {
            image = await mergedPdf.embedPng(fileBytes);
          } else {
            image = await mergedPdf.embedJpg(fileBytes);
          }

          // A4 dimensions in points (595 x 842)
          const A4_WIDTH = 595;
          const A4_HEIGHT = 842;
          const MARGIN = 20;

          // Calculate scale to fit image in A4 with margins
          const availableWidth = A4_WIDTH - 2 * MARGIN;
          const availableHeight = A4_HEIGHT - 2 * MARGIN;
          const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1);
          
          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;

          const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
          page.drawImage(image, {
            x: (A4_WIDTH - scaledWidth) / 2,
            y: A4_HEIGHT - MARGIN - scaledHeight,
            width: scaledWidth,
            height: scaledHeight,
          });
          totalPages += 1;
        }

        processedDocs.push(doc.nom);
      } catch (err) {
        console.error(`Error processing document ${doc.nom}:`, err);
      }
    }

    if (totalPages === 0) {
      return new Response(
        JSON.stringify({ error: "No documents to send" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save PDF with compression options
    console.log(`Saving merged PDF with ${totalPages} pages...`);
    let pdfBytes = await mergedPdf.save({
      useObjectStreams: true, // Enable compression
    });

    // Check size and warn if too large
    const pdfSizeMB = pdfBytes.length / (1024 * 1024);
    console.log(`PDF size: ${pdfSizeMB.toFixed(2)} MB`);

    if (pdfBytes.length > MAX_PDF_SIZE_BYTES) {
      console.warn(`PDF is ${pdfSizeMB.toFixed(2)}MB, may exceed WhatsApp limit`);
    }

    // Upload to storage
    const fileName = `merged-docs/${clientId}/${Date.now()}-dossier-${clientName.replace(/\s+/g, "-")}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload merged PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    const pdfUrl = publicUrlData.publicUrl;
    console.log(`PDF uploaded: ${pdfUrl}`);

    // If generateOnly, return the PDF URL without sending via Twilio
    if (generateOnly || !phoneNumber) {
      return new Response(
        JSON.stringify({
          success: true,
          pdfUrl,
          pdfSizeMB: pdfSizeMB.toFixed(2),
          documentsIncluded: processedDocs,
          totalPages,
          clientName,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy Twilio send path (kept for automated notifications)
    const toNumber = phoneNumber.startsWith("whatsapp:") ? phoneNumber : `whatsapp:${phoneNumber}`;
    
    let defaultMessage: string;
    if (message) {
      defaultMessage = message.length > 1500 ? message.substring(0, 1500) + "…" : message;
    } else {
      const header = `📄 Dossier complet pour ${clientName}\n\n${processedDocs.length} documents inclus`;
      const docList = processedDocs.map(d => `• ${d}`).join("\n");
      if ((header + "\n" + docList).length < 1500) {
        defaultMessage = `${header}:\n${docList}`;
      } else {
        const shortList = processedDocs.slice(0, 5).map(d => `• ${d}`).join("\n");
        defaultMessage = `${header}:\n${shortList}\n... et ${processedDocs.length - 5} autre(s)`;
      }
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_NUMBER!,
        To: toNumber,
        Body: defaultMessage,
        MediaUrl: pdfUrl,
      }),
    });

    const twilioResponse = await response.json();
    if (!response.ok) {
      console.error("Twilio error:", twilioResponse);
      return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message", details: twilioResponse, pdfUrl }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioResponse.sid,
        pdfUrl,
        pdfSizeMB: pdfSizeMB.toFixed(2),
        documentsIncluded: processedDocs,
        totalPages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
