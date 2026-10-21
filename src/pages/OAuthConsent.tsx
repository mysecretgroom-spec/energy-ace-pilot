import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageError, PageLoading } from "@/components/common/PageState";
import { ShieldCheck } from "lucide-react";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<{ client?: { name?: string; uri?: string }; scope?: string; redirect_uri?: string } | null>(null);
  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    setDetails(null);
    void (async () => {
      try {
        if (!authorizationId) throw new Error("Demande d’autorisation absente ou expirée.");
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (!data.session) {
          window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash));
          return;
        }
        setAccount(data.session.user.email ?? "Compte connecté");
        const result = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (result.error) throw result.error;
        const response = result.data;
        if (response && "redirect_url" in response && response.redirect_url) {
          window.location.assign(response.redirect_url);
          return;
        }
        if (!response || !("client" in response)) throw new Error("Demande d’autorisation invalide.");
        setDetails(response);
      } catch {
        if (active) setError("Cette demande ne peut pas être ouverte. Réessayez ou relancez la connexion depuis votre assistant.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId, retry]);

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error) throw result.error;
      const target = result.data?.redirect_url;
      if (!target) throw new Error("Missing redirect");
      window.location.assign(target);
    } catch {
      setError("Votre choix n’a pas pu être enregistré. Réessayez.");
      setBusy(false);
    }
  }
  if (error && !details) return <PageError fullScreen title="Connexion à l’assistant impossible" message={error} onRetry={() => setRetry(value => value + 1)} onBack={() => window.location.assign("/login")} />;
  if (!details) return <PageLoading fullScreen />;
  const clientName = details.client?.name ?? "cet assistant";
  const scopes = (details.scope ?? "").split(" ").filter(Boolean);
  return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
    <section className="w-full max-w-lg space-y-6">
      <ShieldCheck className="h-10 w-10 text-primary" />
      <h1 className="font-display text-2xl font-semibold">Connecter {clientName} à Débalepro</h1>
      <p className="text-sm text-muted-foreground break-all">{account}</p>
      <p>{clientName} pourra consulter vos clients et vos rendez-vous avec les droits de votre compte.</p>
      {(details.redirect_uri ?? details.client?.uri) && <p className="text-sm text-muted-foreground break-all">Destination : {details.redirect_uri ?? details.client?.uri}</p>}
      <ul className="text-sm space-y-2">
        {scopes.map(scope => <li key={scope}>{({ openid: "Identifier votre compte", email: "Partager votre adresse e-mail", profile: "Partager votre profil" } as Record<string, string>)[scope] ?? `Autorisation supplémentaire : ${scope}`}</li>)}
        <li>Lecture seule : aucun envoi, paiement ou changement de dossier.</li>
      </ul>
      <p className="text-sm text-muted-foreground">Les restrictions de votre compte restent applicables.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void decide(true)}>Autoriser la connexion</Button>
        <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>Refuser</Button>
        <Button variant="ghost" disabled={busy} onClick={async () => {
          await supabase.auth.signOut();
          window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash));
        }}>Changer de compte</Button>
      </div>
    </section>
  </main>;
}