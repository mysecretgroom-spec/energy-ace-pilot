import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Loader2, Eye, EyeOff, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { PasswordStrengthIndicator, validatePassword } from "@/components/auth/PasswordStrengthIndicator";
import { Footer } from "@/components/layout/Footer";
import { toast } from "sonner";

type Step = "request" | "reset";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Detect recovery token in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setStep("reset");
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("reset");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      toast.error("Erreur", {
        description: error.message,
      });
    } else {
      setEmailSent(true);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      toast.error("Erreur", {
        description: error.message,
      });
    } else {
      toast.success("Mot de passe modifié avec succès");
      navigate("/login");
    }
  };

  // Email sent confirmation
  if (emailSent) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-card">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-display">Email envoyé !</CardTitle>
                <CardDescription className="mt-2">
                  Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
                  Vérifiez votre boîte de réception et vos spams.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => { setEmailSent(false); setEmail(""); }}
              >
                <Mail className="h-4 w-4" />
                Renvoyer à une autre adresse
              </Button>
            </CardContent>
            <CardFooter>
              <Link to="/login" className="text-sm text-primary font-medium hover:underline w-full text-center">
                ← Retour à la connexion
              </Link>
            </CardFooter>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-hero flex items-center justify-center">
              <Sun className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl font-display">
                {step === "request" ? "Mot de passe oublié" : "Nouveau mot de passe"}
              </CardTitle>
              <CardDescription>
                {step === "request"
                  ? "Entrez votre email pour recevoir un lien de réinitialisation"
                  : "Choisissez votre nouveau mot de passe"}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {step === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <Button type="submit" className="w-full bg-gradient-hero" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi en cours...
                    </>
                  ) : (
                    "Envoyer le lien"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <PasswordStrengthIndicator password={newPassword} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                <Button type="submit" className="w-full bg-gradient-hero" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Modification...
                    </>
                  ) : (
                    "Réinitialiser le mot de passe"
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter>
            <Link
              to="/login"
              className="flex items-center gap-1 text-sm text-primary font-medium hover:underline w-full justify-center"
            >
              <ArrowLeft className="h-3 w-3" />
              Retour à la connexion
            </Link>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;
