import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const SnapchatCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      navigate(`/settings/social-accounts?error=${error}`);
    } else {
      navigate('/settings/social-accounts#snapchat');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Łączenie ze Snapchat...</p>
      </div>
    </div>
  );
};

export default SnapchatCallback;
