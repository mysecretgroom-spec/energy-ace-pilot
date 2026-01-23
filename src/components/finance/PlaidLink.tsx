import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock } from "lucide-react";

interface PlaidLinkProps {
  onTransactionsImported?: () => void;
}

export function PlaidLink({ onTransactionsImported }: PlaidLinkProps) {
  return (
    <Card className="shadow-card border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-500" />
            Comptes bancaires
          </CardTitle>
          <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
            <Clock className="h-3 w-3" />
            Bientôt
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          La connexion bancaire automatique est en cours de validation auprès de Plaid. 
          Cette fonctionnalité sera disponible prochainement.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          En attendant, utilisez l'import manuel CSV pour synchroniser vos transactions.
        </p>
      </CardContent>
    </Card>
  );
}
