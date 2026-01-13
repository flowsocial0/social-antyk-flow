import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-muted/50 py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Social Auto Flow. Wszelkie prawa zastrzeżone.
          </p>
          <nav className="flex items-center gap-4 text-sm flex-wrap justify-center">
            <Link 
              to="/terms" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Regulamin Social Auto Flow
            </Link>
            <span className="text-muted-foreground hidden md:inline">•</span>
            <Link 
              to="/privacy" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Polityka Prywatności Social Auto Flow
            </Link>
            <span className="text-muted-foreground hidden md:inline">•</span>
            <Link 
              to="/data-deletion" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Usuwanie danych
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
