// Journalisation pas à pas de l'agent.
// Chaque étape (réception, contexte, analyse, exécution, réponse) est tracée
// dans public.agent_step_logs avec un run_id commun, puis flushée en une insertion.

// deno-lint-ignore no-explicit-any
type Db = any;

export type StepStatus = "ok" | "warn" | "error" | "skip";

export interface StepLog {
  user_id: string;
  run_id: string;
  channel: string;
  step: string;
  status: StepStatus;
  details: Record<string, unknown>;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

const MAX_DETAIL_CHARS = 1200;

function sanitize(details: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details || {})) {
    if (v === undefined) continue;
    if (typeof v === "string") {
      out[k] = v.length > MAX_DETAIL_CHARS ? `${v.slice(0, MAX_DETAIL_CHARS)}…` : v;
    } else if (v === null || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > MAX_DETAIL_CHARS ? `${s.slice(0, MAX_DETAIL_CHARS)}…` : JSON.parse(s);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

export class AgentTracer {
  private logs: StepLog[] = [];
  private lastMark: number;
  readonly runId: string;

  constructor(
    private db: Db,
    private userId: string,
    private channel: string = "whatsapp",
    runId?: string,
  ) {
    this.runId = runId || crypto.randomUUID();
    this.lastMark = Date.now();
  }

  /** Trace une étape. `duration_ms` = temps écoulé depuis l'étape précédente. */
  step(
    step: string,
    details: Record<string, unknown> = {},
    status: StepStatus = "ok",
    error?: unknown,
  ): void {
    const now = Date.now();
    const duration = now - this.lastMark;
    this.lastMark = now;
    const entry: StepLog = {
      user_id: this.userId,
      run_id: this.runId,
      channel: this.channel,
      step,
      status,
      details: sanitize(details),
      duration_ms: duration,
      error: error ? String((error as Error)?.message || error).slice(0, 500) : null,
    created_at: new Date().toISOString(),
    };
    this.logs.push(entry);
    console.log(`[trace ${this.runId.slice(0, 8)}] ${step} (${status}, ${duration}ms)`);
    // Écriture immédiate en tâche de fond: même si le traitement sort par un
    // chemin court, l'étape est déjà journalisée.
    void this.flush();
  }

  /** Écrit tous les pas en base, en série. Ne casse jamais le flux principal. */
  flush(): Promise<void> {
    this.pending = this.pending.then(() => this.doFlush());
    return this.pending;
  }

  private async doFlush(): Promise<void> {
    if (!this.logs.length) return;
    const batch = this.logs.splice(0, this.logs.length);
    try {
      const { error } = await this.db.from("agent_step_logs").insert(batch);
      if (error) console.error("[trace] insert failed:", error.message);
    } catch (err) {
      console.error("[trace] flush failed:", err);
    }
  }
}
