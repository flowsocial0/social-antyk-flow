import { useState } from "react";
import { CampaignSetup } from "./CampaignSetup";
import { CampaignPlan } from "./CampaignPlan";
import { CampaignReview } from "./CampaignReview";
import { SimpleCampaignSetup } from "./SimpleCampaignSetup";
import { PlatformId } from "@/config/platforms";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Zap } from "lucide-react";

export type CampaignPost = {
  day: number;
  time: string;
  type: "content" | "sales";
  category: string;
  text: string;
  scheduledAt: string;
  bookId?: string | null;
};

export type CampaignConfig = {
  name?: string;
  durationDays: number;
  postsPerDay: number;
  startDate: string;
  startTime: string;
  postingTimes: string[];
  targetPlatforms?: PlatformId[];
  selectedBooks?: string[];
  useAI?: boolean;
  regenerateTexts?: boolean;
  contentRatio?: number; // 0-100, percentage of content posts
  selectedAccounts?: Record<PlatformId, string[]>; // Platform -> Account IDs array (multi-account selection)
  useRandomContent?: boolean; // Generate random content on a specific topic
  randomContentTopic?: string; // Topic for random content generation
};

interface CampaignBuilderProps {
  initialConfig?: Partial<CampaignConfig>;
}

export const CampaignBuilder = ({ initialConfig }: CampaignBuilderProps) => {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [plan, setPlan] = useState<{ structure: any[] } | null>(null);
  const [posts, setPosts] = useState<CampaignPost[]>([]);

  const handleConfigComplete = (newConfig: CampaignConfig) => {
    setConfig(newConfig);
    setStep(2);
  };

  const handlePlanComplete = (generatedPlan: { structure: any[] }, generatedPosts: CampaignPost[]) => {
    setPlan(generatedPlan);
    setPosts(generatedPosts);
    setStep(3);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setPlan(null);
      setPosts([]);
    } else if (step === 3) {
      setStep(2);
    }
  };

  // Simple mode renders its own flow
  if (mode === "simple" && step === 1) {
    return (
      <div className="space-y-6">
        {/* Mode Selector */}
        <div className="flex justify-center mb-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "advanced")}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="simple" className="gap-2">
                <Zap className="h-4 w-4" />
                Prosty
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Zaawansowany
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <SimpleCampaignSetup />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Selector - only on step 1 */}
      {step === 1 && (
        <div className="flex justify-center mb-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "advanced")}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="simple" className="gap-2">
                <Zap className="h-4 w-4" />
                Prosty
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Zaawansowany
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Progress Steps - only in advanced mode */}
      {mode === "advanced" && (
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
              1
            </div>
            <span className="font-medium">Konfiguracja</span>
          </div>
          <div className="w-12 h-0.5 bg-border" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
              2
            </div>
            <span className="font-medium">Generowanie</span>
          </div>
          <div className="w-12 h-0.5 bg-border" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
              3
            </div>
            <span className="font-medium">Podgląd i zatwierdzenie</span>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === 1 && (
        <CampaignSetup onComplete={handleConfigComplete} initialConfig={initialConfig} />
      )}

      {step === 2 && config && (
        <CampaignPlan 
          config={config} 
          onComplete={handlePlanComplete}
          onBack={handleBack}
        />
      )}

      {step === 3 && posts.length > 0 && (
        <CampaignReview 
          posts={posts}
          config={config!}
          onBack={handleBack}
        />
      )}
    </div>
  );
};