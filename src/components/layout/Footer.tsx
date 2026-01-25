import { Link } from "react-router-dom";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-4 px-4 border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Link 
            to="/legal" 
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Documents légaux
          </Link>
          <span className="text-border">•</span>
          <Link 
            to="/support" 
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Support
          </Link>
        </div>
        <p className="text-center">
          © {currentYear} DébalePro. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
};
