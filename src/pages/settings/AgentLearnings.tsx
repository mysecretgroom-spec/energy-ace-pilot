import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AgentMemoryManager from "@/components/settings/AgentMemoryManager";
import { Brain, GraduationCap, History, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AgentSkillRow {
  id: string;
  nom: string;
  description: string | null;
  triggers: string[] | null;
  procedure: string;
  exemples: unknown;
  usage_count: number | null;
  actif: boolean;
  user_id: string | null;
}

interface SessionMemoryRow {
  resume: string | null;
  sujets_ouverts: string[] | null;
  derniere_intent: string | null;
  updated_at: string | null;
}

function toExamples(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object") {
          const obj = e as Record<string, unknown>;
          const input = obj.message ?? obj.entree ?? obj.input ?? obj.question;
          const output = obj.reponse ?? obj.output ?? obj.resultat;
          if (input && output) return `« ${String(input)} » → ${String(output)}`;
          if (input) return `« ${String(input)} »`;
          return JSON.stringify(e);
        }
        return String(e);
      })
      .filter(Boolean);
  }
  if (typeof raw === "string") return [raw];
  return [];
}

const AgentLearnings = () => {
  const { user } = useAuth();

  const { data: skills, isLoading: loadingSkills } = useQuery({
    queryKey: ["agent-skills", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_skills")
        .select("id, nom, description, triggers, procedure, exemples, usage_count, actif, user_id")
        .eq("actif", true)
        .order("usage_count", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AgentSkillRow[];
    },
    enabled: !!user,
  });

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ["agent-session-memory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_session_memory")
        .select("resume, sujets_ouverts, derniere_intent, updated_at")
        .maybeSingle();
      if (error) throw error;
      return data as SessionMemoryRow | null;
    },
    enabled: !!user,
  });

  return (
    <MobileLayout title="Apprentissages" showBackButton>
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Ce que l'agent a retenu</h1>
            <p className="text-xs text-muted-foreground">
              Habitudes apprises, savoir-faire appliqués et fil de vos échanges
            </p>
          </div>
        </div>

        {/* Mémoire apprise */}
        <AgentMemoryManager />

        {/* Savoir-faire */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Savoir-faire</CardTitle>
                <CardDescription>Procédures que l'agent sait dérouler seul</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSkills ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : skills && skills.length > 0 ? (
              skills.map((skill) => {
                const examples = toExamples(skill.exemples);
                return (
                  <div key={skill.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{skill.nom}</p>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground">{skill.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {skill.user_id ? "Appris pour vous" : "Intégré"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          utilisé {skill.usage_count ?? 0}x
                        </span>
                      </div>
                    </div>

                    {skill.triggers && skill.triggers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skill.triggers.slice(0, 6).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs font-normal">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6">
                      {skill.procedure}
                    </p>

                    {examples.length > 0 && (
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs font-medium mb-1">Exemples</p>
                        <ul className="space-y-0.5">
                          {examples.slice(0, 3).map((ex, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              • {ex}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun savoir-faire enregistré</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fil de session */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <History className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Où vous en êtes</CardTitle>
                <CardDescription>Ce que l'agent garde en tête d'un échange à l'autre</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingSession ? (
              <Skeleton className="h-20 w-full" />
            ) : session?.resume ? (
              <>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{session.resume}</p>
                {session.sujets_ouverts && session.sujets_ouverts.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {session.sujets_ouverts.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                {session.updated_at && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Mis à jour le {format(new Date(session.updated_at), "dd MMM à HH:mm", { locale: fr })}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Rien en cours pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default AgentLearnings;
