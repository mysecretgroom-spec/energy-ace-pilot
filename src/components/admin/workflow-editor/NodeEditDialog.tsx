import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save } from 'lucide-react';
import { WorkflowNode, NodeType } from './types';

interface NodeEditDialogProps {
  node: WorkflowNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (node: WorkflowNode) => void;
}

const actionTypes = [
  { value: 'upload_document', label: 'Upload document' },
  { value: 'update_rdv_status', label: 'Mettre à jour statut RDV' },
  { value: 'update_vente_status', label: 'Mettre à jour statut vente' },
  { value: 'create_client', label: 'Créer client' },
  { value: 'send_notification', label: 'Envoyer notification' },
  { value: 'send_whatsapp', label: 'Envoyer WhatsApp' },
  { value: 'daily_briefing', label: 'Briefing quotidien' },
  { value: 'custom', label: 'Action personnalisée' },
];

const triggerTypes = [
  { value: 'message_received', label: 'Message reçu' },
  { value: 'media_received', label: 'Média reçu (image/PDF)' },
  { value: 'keyword_detected', label: 'Mot-clé détecté' },
  { value: 'scheduled', label: 'Planifié (cron)' },
];

const conditionTypes = [
  { value: 'intent_match', label: 'Intention correspond' },
  { value: 'media_type', label: 'Type de média' },
  { value: 'user_context', label: 'Contexte utilisateur' },
  { value: 'custom_condition', label: 'Condition personnalisée' },
];

export function NodeEditDialog({ node, open, onOpenChange, onSave }: NodeEditDialogProps) {
  const [label, setLabel] = useState('');
  const [actionType, setActionType] = useState('');
  const [configJson, setConfigJson] = useState('{}');
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setActionType((node.config?.action_type as string) || '');
      setConfigJson(JSON.stringify(node.config || {}, null, 2));
      setPrompt((node.config?.prompt as string) || '');
    }
  }, [node]);

  const handleSave = () => {
    if (!node) return;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(configJson);
    } catch {
      parsedConfig = node.config;
    }

    // Merge action type and prompt into config
    parsedConfig.action_type = actionType;
    if (prompt) parsedConfig.prompt = prompt;

    onSave({
      ...node,
      label,
      config: parsedConfig,
    });
  };

  const getTypeOptions = () => {
    switch (node?.type) {
      case 'trigger':
        return triggerTypes;
      case 'condition':
        return conditionTypes;
      default:
        return actionTypes;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurer le nœud</DialogTitle>
          <DialogDescription>
            Définissez le comportement et les paramètres de ce nœud
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="prompt">Prompt IA</TabsTrigger>
            <TabsTrigger value="config">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nom du nœud</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Analyser le document"
              />
            </div>

            <div className="space-y-2">
              <Label>Type d'action</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {getTypeOptions().map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Instructions pour l'IA</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Analyse ce document et extrait les informations clés..."
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Ces instructions guident le comportement de l'agent IA pour cette étape
              </p>
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Configuration JSON</Label>
              <Textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Paramètres techniques avancés
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
