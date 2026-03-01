import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
// ... keep existing code (all other imports)
import Login from "./pages/Login";

import Schedule from "./pages/Schedule";
import Campaigns from "./pages/Campaigns";
import CampaignsNew from "./pages/CampaignsNew";
import CampaignDetails from "./pages/CampaignDetails";
import SocialAccounts from "./pages/SocialAccounts";
import TwitterCallback from "./pages/TwitterCallback";
import FacebookCallback from "./pages/FacebookCallback";
import TikTokCallback from "./pages/TikTokCallback";
import YouTubeCallback from "./pages/YouTubeCallback";
import LinkedInCallback from "./pages/LinkedInCallback";
import MastodonCallback from "./pages/MastodonCallback";

import PinterestCallback from "./pages/PinterestCallback";

import TumblrCallback from "./pages/TumblrCallback";

import GoogleBusinessCallback from "./pages/GoogleBusinessCallback";
import BookPreview from "./pages/BookPreview";
import BookRedirect from "./pages/BookRedirect";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import PlatformX from "./pages/platforms/PlatformX";
import PlatformFacebook from "./pages/platforms/PlatformFacebook";
import FacebookSelectPage from "./pages/platforms/FacebookSelectPage";
import PlatformInstagram from "./pages/platforms/PlatformInstagram";
import PlatformYouTube from "./pages/platforms/PlatformYouTube";
import PlatformLinkedIn from "./pages/platforms/PlatformLinkedIn";
import PlatformTikTok from "./pages/platforms/PlatformTikTok";
import PlatformPinterest from "./pages/platforms/PlatformPinterest";

import PlatformTelegram from "./pages/platforms/PlatformTelegram";
import PlatformBluesky from "./pages/platforms/PlatformBluesky";
import PlatformMastodon from "./pages/platforms/PlatformMastodon";

import PlatformDiscord from "./pages/platforms/PlatformDiscord";
import PlatformTumblr from "./pages/platforms/PlatformTumblr";

import PlatformGoogleBusiness from "./pages/platforms/PlatformGoogleBusiness";
import ScheduleOverview from "./pages/ScheduleOverview";
import Platforms from "./pages/Platforms";
import ExpressCampaignLaunch from "./pages/ExpressCampaignLaunch";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { BugReportButton } from "./components/bugs/BugReportButton";
import { FeatureRequestButton } from "./components/ideas/FeatureRequestButton";
import TermsOfService from "./pages/TermsOfService";
import DataDeletion from "./pages/DataDeletion";

const queryClient = new QueryClient();

// Component to handle auth state changes and clear cache
const AuthStateHandler = () => {
  useEffect(() => {
    // Track the initial session user ID to detect actual user changes
    let initialUserId: string | null = null;
    let isInitialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUserId = session?.user?.id || null;
      
      console.log('Auth state changed:', event, 'userId:', currentUserId, 'isInitialized:', isInitialized);
      
      // On first event, just record the initial user - don't clear cache
      if (!isInitialized) {
        initialUserId = currentUserId;
        isInitialized = true;
        console.log('Auth initialized with userId:', initialUserId);
        return;
      }
      
      // Clear cache only on actual user changes (different user or explicit logout)
      if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing query cache');
        queryClient.clear();
        initialUserId = null;
      } else if (event === 'SIGNED_IN' && currentUserId !== initialUserId) {
        console.log('Different user signed in, clearing query cache');
        queryClient.clear();
        initialUserId = currentUserId;
      }
      // USER_UPDATED typically means token refresh, not user change - don't clear
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthStateHandler />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* <BugReportButton /> */}
        {/* <FeatureRequestButton /> */}
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
