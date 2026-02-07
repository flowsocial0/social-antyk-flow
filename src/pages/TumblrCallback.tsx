import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const TumblrCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      navigate(`/settings/social-accounts?error=${error}`);
    } else {
      navigate('/settings/social-accounts?connected=true&platform=tumblr');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Łączenie z Tumblr...</p>
      </div>
    </div>
  );
};

export default TumblrCallback;
