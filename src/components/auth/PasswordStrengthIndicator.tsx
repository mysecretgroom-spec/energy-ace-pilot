import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: "Au moins 8 caractères", test: (p) => p.length >= 8 },
  { label: "Une lettre majuscule", test: (p) => /[A-Z]/.test(p) },
  { label: "Une lettre minuscule", test: (p) => /[a-z]/.test(p) },
  { label: "Un chiffre", test: (p) => /[0-9]/.test(p) },
  { label: "Un caractère spécial (!@#$%...)", test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(p) },
];

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const results = useMemo(() => {
    return requirements.map((req) => ({
      ...req,
      met: req.test(password),
    }));
  }, [password]);

  const strength = useMemo(() => {
    const metCount = results.filter((r) => r.met).length;
    if (metCount === 0) return { label: "", color: "", percent: 0 };
    if (metCount <= 2) return { label: "Faible", color: "bg-destructive", percent: 25 };
    if (metCount <= 3) return { label: "Moyen", color: "bg-yellow-500", percent: 50 };
    if (metCount <= 4) return { label: "Bon", color: "bg-blue-500", percent: 75 };
    return { label: "Excellent", color: "bg-green-500", percent: 100 };
  }, [results]);

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Force du mot de passe</span>
          <span className={cn(
            "font-medium",
            strength.percent <= 25 && "text-destructive",
            strength.percent === 50 && "text-yellow-500",
            strength.percent === 75 && "text-blue-500",
            strength.percent === 100 && "text-green-500"
          )}>
            {strength.label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", strength.color)}
            style={{ width: `${strength.percent}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      <ul className="space-y-1">
        {results.map((req, index) => (
          <li
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.met ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  const metCount = requirements.filter((req) => req.test(password)).length;
  
  if (metCount < requirements.length) {
    return {
      valid: false,
      message: "Le mot de passe ne respecte pas tous les critères de sécurité",
    };
  }
  
  return { valid: true, message: "" };
}
