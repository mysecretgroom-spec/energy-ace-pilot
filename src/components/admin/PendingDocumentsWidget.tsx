import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  AlertTriangle,
  Download,
  Eye
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CLIENT_DOC_CATEGORIES } from "@/lib/documentCategories";

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
  status: string;
  auto_assign_after: string | null;
  created_at: string;
}

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
}

const PendingDocumentsWidget = () => {
  const queryClient = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<PendingDocument | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedDocType, setSelectedDocType] = useState<string>("");

  const { data: pendingDocs, isLoading } = useQuery({
    queryKey: ["pending-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_documents")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as PendingDocument[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .order("nom");

      if (error) throw error;
      return data as Client[];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ docId, clientId, docType }: { docId: string; clientId: string; docType: string }) => {
      // 1. Get the pending document details
      const { data: pendingDoc, error: fetchError } = await supabase
        .from("pending_documents")
        .select("*")
        .eq("id", docId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Move file from pending-documents to documents bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pending-documents")
        .download(pendingDoc.storage_path);

      if (downloadError) throw downloadError;

      // Path MUST start with user_id to satisfy RLS policy: (auth.uid())::text = (storage.foldername(name))[1]
      const newPath = `${pendingDoc.user_id}/${clientId}/${Date.now()}_${pendingDoc.original_filename}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(newPath, fileData, { contentType: pendingDoc.mime_type || "application/octet-stream" });

      if (uploadError) throw uploadError;

      // 3. Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(newPath);

      // 4. Create document record
      const { data: docRecord, error: insertError } = await supabase
        .from("documents")
        .insert([{
          client_id: clientId,
          user_id: pendingDoc.user_id,
          nom: pendingDoc.original_filename,
          type_document: docType as any,
          url: urlData.publicUrl,
          mime_type: pendingDoc.mime_type,
          taille_bytes: pendingDoc.file_size_bytes,
          context_source: pendingDoc.source,
        }])
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 5. Update pending document status
      const { error: updateError } = await supabase
        .from("pending_documents")
        .update({
          status: "manually_assigned",
          assigned_client_id: clientId,
          assigned_document_type: docType,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          assigned_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          final_document_id: docRecord.id,
        })
        .eq("id", docId);

      if (updateError) throw updateError;

      // 6. Delete from pending storage
      await supabase.storage.from("pending-documents").remove([pendingDoc.storage_path]);

      return docRecord;
    },
    onSuccess: () => {
      toast.success("Document attribué avec succès");
      queryClient.invalidateQueries({ queryKey: ["pending-documents"] });
      setSelectedDoc(null);
      setSelectedClientId("");
      setSelectedDocType("");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: pendingDoc, error: fetchError } = await supabase
        .from("pending_documents")
        .select("storage_path")
        .eq("id", docId)
        .single();

      if (fetchError) throw fetchError;

      // Delete file from storage
      await supabase.storage.from("pending-documents").remove([pendingDoc.storage_path]);

      // Update status
      const { error } = await supabase
        .from("pending_documents")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
        })
        .eq("id", docId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document rejeté");
      queryClient.invalidateQueries({ queryKey: ["pending-documents"] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-green-500/10 text-green-600">Confiance {confidence}%</Badge>;
    } else if (confidence >= 50) {
      return <Badge className="bg-amber-500/10 text-amber-600">Confiance {confidence}%</Badge>;
    }
    return <Badge className="bg-red-500/10 text-red-600">Confiance {confidence}%</Badge>;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openDocument = async (doc: PendingDocument) => {
    setSelectedDoc(doc);
    setSelectedClientId(doc.ai_detected_client_id || "");
    setSelectedDocType(doc.ai_detected_document_type || "autre");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = pendingDocs?.length || 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents en attente
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Documents à attribuer aux clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucun document en attente</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {pendingDocs?.map((doc) => (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => openDocument(doc)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">
                          {doc.original_filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{formatFileSize(doc.file_size_bytes)}</span>
                          <span>•</span>
                          <span>{doc.source}</span>
                        </div>
                      </div>
                      {getConfidenceBadge(doc.ai_confidence)}
                    </div>

                    {doc.ai_detected_client_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3" />
                        <span>Client suggéré: <strong>{doc.ai_detected_client_name}</strong></span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      {doc.auto_assign_after && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Auto dans {formatDistanceToNow(new Date(doc.auto_assign_after), { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Attribuer le document</DialogTitle>
            <DialogDescription>
              {selectedDoc?.original_filename}
            </DialogDescription>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4">
              {selectedDoc.ai_analysis_summary && (
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p className="font-medium mb-1">Analyse IA :</p>
                  <p>{selectedDoc.ai_analysis_summary}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Client</label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.nom} {client.prenom || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Type de document</label>
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_DOC_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => selectedDoc && rejectMutation.mutate(selectedDoc.id)}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeter
            </Button>
            <Button
              onClick={() => selectedDoc && assignMutation.mutate({
                docId: selectedDoc.id,
                clientId: selectedClientId,
                docType: selectedDocType,
              })}
              disabled={!selectedClientId || !selectedDocType || assignMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Attribuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingDocumentsWidget;
