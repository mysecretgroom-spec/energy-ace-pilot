import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBiometricLogin, BiometricAccount } from "@/hooks/useBiometricLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sun, Loader2, Eye, EyeOff, User, Shield, Fingerprint, X } from "lucide-react";
import { SuccessAnimation } from "@/components/ui/success-animation";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/layout/Footer";

const REMEMBER_EMAIL_KEY = "debalepro_remember_email";
const STAY_CONNECTED_KEY = "debalepro_stay_connected";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [stayConnected, setStayConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", subtitle: "" });
  const { signIn, signInWithGoogle } = useAuth();
  const { isSupported: biometricSupported, savedAccounts, authenticateAccount, removeAccount, updateStoredToken } = useBiometricLogin();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    const savedStayConnected = localStorage.getItem(STAY_CONNECTED_KEY);
    
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedStayConnected !== null) {
      setStayConnected(savedStayConnected === "true");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save or clear remembered email
    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
    
    // Save stay connected preference
    localStorage.setItem(STAY_CONNECTED_KEY, stayConnected.toString());

    const { error } = await signIn(email, password, stayConnected);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message === "Invalid login credentials" 
          ? "Email ou mot de passe incorrect" 
          : error.message,
      });
      setLoading(false);
    } else {
      // Update stored token for biometric login if user has it enabled
      await updateStoredToken();
      setSuccessMessage({ title: "Connexion réussie", subtitle: "Bienvenue sur RGE app !" });
      setShowSuccess(true);
      setLoading(false);
      
      // Navigate after animation
      setTimeout(() => {
        navigate("/");
      }, 1500);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur Google",
        description: error.message,
      });
      setGoogleLoading(false);
    }
    // Note: no need to setGoogleLoading(false) on success as page will redirect
  };

  // Handle biometric login for a saved account
  const handleBiometricLogin = async (account: BiometricAccount) => {
    setBiometricLoading(true);
    
    try {
      const { success, error, sessionRestored } = await authenticateAccount(account);
      
      if (!success) {
        toast({
          variant: "destructive",
          title: "Échec biométrique",
          description: error || "L'authentification a échoué",
        });
        setBiometricLoading(false);
        return;
      }

      if (sessionRestored) {
        // Session was fully restored - show success animation then navigate
        setSuccessMessage({ 
          title: "Connexion réussie", 
          subtitle: `Bienvenue ${account.firstName || account.email} !` 
        });
        setShowSuccess(true);
        
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } else {
        // Biometric verified but session couldn't be restored
        // Pre-fill email and ask for password
        setEmail(account.email);
        toast({
          title: "Session expirée",
          description: error || "Veuillez entrer votre mot de passe",
        });
      }
    } catch (error) {
      console.error("Biometric login error:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue",
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  // Get initials for avatar
  const getInitials = (account: BiometricAccount) => {
    if (account.firstName) {
      return `${account.firstName[0]}${account.lastName?.[0] || ""}`.toUpperCase();
    }
    return account.email[0].toUpperCase();
  };

  // Show success animation overlay
  if (showSuccess) {
    return <SuccessAnimation message={successMessage.title} subMessage={successMessage.subtitle} />;
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
              <CardTitle className="text-2xl font-display">RGE app</CardTitle>
              <CardDescription>Connectez-vous à votre espace commercial</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Biometric (Face ID / Touch ID) and Google sign-in désactivés */}

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
                <div className="flex justify-end">
                  <Link to="/reset-password" className="text-xs text-primary hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label
                  htmlFor="rememberMe"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 cursor-pointer transition-all hover:bg-muted/50 hover:border-primary/30"
                >
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Se souvenir de moi</p>
                    <p className="text-xs text-muted-foreground">Mémoriser mon email</p>
                  </div>
                </label>
                
                <label
                  htmlFor="stayConnected"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 cursor-pointer transition-all hover:bg-muted/50 hover:border-primary/30"
                >
                  <Checkbox
                    id="stayConnected"
                    checked={stayConnected}
                    onCheckedChange={(checked) => setStayConnected(checked === true)}
                  />
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Rester connecté</p>
                    <p className="text-xs text-muted-foreground">Ne pas me déconnecter</p>
                  </div>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-hero"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter>
            <p className="text-sm text-muted-foreground text-center w-full">
              Pas encore de compte ?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Créer un compte
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
