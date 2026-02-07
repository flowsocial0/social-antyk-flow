import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const PinterestCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Pinterest OAuth callback is handled server-side by the edge function
    // which redirects back to /settings/social-accounts
    // This page is a fallback in case the user lands here directly
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      navigate(`/settings/social-accounts?error=${error}`);
    } else {
      navigate('/settings/social-accounts?connected=true&platform=pinterest');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Łączenie z Pinterest...</p>
      </div>
    </div>
  );
};

export default PinterestCallback;
