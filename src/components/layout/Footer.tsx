import { Link } from "react-router-dom";
import { SellerAddress } from "@/components/legal/LegalPage";


export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-4 px-4 border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <Link to="/tarifs" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
          Tarifs
        </Link>
        <Link 
          to="/legal" 
          className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Documents légaux
        </Link>
        <p className="text-center">
          © {currentYear} <SellerAddress />. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
};
