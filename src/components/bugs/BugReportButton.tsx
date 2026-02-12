import { useState, useEffect } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BugReportForm } from "./BugReportForm";
import html2canvas from "html2canvas";

export const BugReportButton = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleClick = async () => {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 0.5,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        height: window.innerHeight,
        y: window.scrollY,
      });
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png", 0.8);
      });

      if (blob) {
        setScreenshot(blob);
        setScreenshotUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error("Screenshot failed:", err);
    } finally {
      setCapturing(false);
      setShowForm(true);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
    }
    setScreenshot(null);
    setScreenshotUrl(null);
  };

  if (!isLoggedIn) return null;

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={capturing}
        className="fixed bottom-6 right-6 z-50 shadow-lg gap-2"
        variant="destructive"
        size="sm"
      >
        <Bug className="h-4 w-4" />
        {capturing ? "Robię zrzut..." : "Zgłoś błąd"}
      </Button>

      {showForm && (
        <BugReportForm
          open={showForm}
          onClose={handleClose}
          screenshot={screenshot}
          screenshotUrl={screenshotUrl}
        />
      )}
    </>
  );
};
