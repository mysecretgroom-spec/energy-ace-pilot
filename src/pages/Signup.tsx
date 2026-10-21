import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { SuccessAnimation } from "@/components/ui/success-animation";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordStrengthIndicator, validatePassword } from "@/components/auth/PasswordStrengthIndicator";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const Signup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = oauthReturnPath(params.get("next"));
  const loginPath = next === "/" ? "/login" : "/login?next=" + encodeURIComponent(next);
  const { toast } = useToast();

  const checkDuplicates = async (): Promise<boolean> => {
    setDuplicateError(null);
    try {
      const { data, error } = await supabase.rpc("check_signup_duplicate" as any, {
        p_email: email.trim(),
        p_phone: phone.trim() || null,
      });

      if (error) {
        console.error("Duplicate check error:", error);
        return false; // Allow signup if check fails
      }

      const result = data as any;
      if (result?.email_exists) {
        setDuplicateError("Un compte existe déjà avec cette adresse email. Connectez-vous plutôt.");
        return true;
      }
      if (result?.phone_exists) {
        setDuplicateError("Un compte existe déjà avec ce numéro de téléphone. Connectez-vous plutôt.");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez accepter les conditions d'utilisation",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
      });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      toast({
        variant: "destructive",
        title: "Mot de passe trop faible",
        description: passwordValidation.message,
      });
      return;
    }

    setLoading(true);

    // Check duplicates first
    const hasDuplicate = await checkDuplicates();
    if (hasDuplicate) {
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, firstName, lastName, next);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message,
      });
    } else {
      // Save phone to profile after signup
      if (phone.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ phone: phone.trim() })
            .eq("user_id", user.id);
        }
      }

      setShowSuccess(true);
      setTimeout(() => {
        navigate(next);
      }, 1500);
    }

    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(next);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur Google",
        description: error.message,
      });
      setGoogleLoading(false);
    }
  };

  if (showSuccess) {
    return <SuccessAnimation message="Compte créé !" subMessage="10 jours d'essai gratuit activés !" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-hero flex items-center justify-center">
            <Sun className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Créer un compte</CardTitle>
            <CardDescription>Rejoignez DébalePro — 10 jours d'essai gratuit</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {duplicateError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <span>{duplicateError}</span>
                <Link to={loginPath} className="text-sm font-medium underline">
                  → Se connecter
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Google sign-up désactivé */}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Durand"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setDuplicateError(null); }}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="06 12 34 56 78"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setDuplicateError(null); }}
                required
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Créez un mot de passe sécurisé"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-tight cursor-pointer">
                J'accepte les{" "}
                <Link to="/conditions" className="text-primary hover:underline" target="_blank">
                  conditions d'utilisation
                </Link>{" "}
                et la{" "}
                <Link to="/confidentialite" className="text-primary hover:underline" target="_blank">
                  politique de confidentialité
                </Link>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-hero"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Création...
                </>
              ) : (
                "Démarrer mon essai gratuit"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              10 jours d'essai gratuit • Sans engagement • Sans carte bancaire
            </p>
          </form>
        </CardContent>

        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            Déjà un compte ?{" "}
            <Link to={loginPath} className="text-primary font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Signup;
