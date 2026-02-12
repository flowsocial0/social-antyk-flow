import { useState, useEffect } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FeatureRequestForm } from "./FeatureRequestForm";

export const FeatureRequestButton = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isLoggedIn) return null;

  return (
    <>
      <Button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 left-6 z-50 shadow-lg gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
        size="sm"
      >
        <Lightbulb className="h-4 w-4" />
        Przydała by się funkcja
      </Button>

      {showForm && (
        <FeatureRequestForm
          open={showForm}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
};
