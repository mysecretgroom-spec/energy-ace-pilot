export interface TrialRow {
  user_id: string;
  email: string;
  signed_up_at: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  app_access: string | null;
  converted: boolean;
  plan_price_id: string | null;
  converted_at: string | null;
}

export type TrialStatus = "converted" | "active" | "expired";

/** A trial is converted once a paid subscription exists; otherwise active until its end date. */
export function trialStatus(r: Pick<TrialRow, "converted" | "trial_ends_at">, now: Date): TrialStatus {
  if (r.converted) return "converted";
  if (r.trial_ends_at && new Date(r.trial_ends_at) > now) return "active";
  return "expired";
}
