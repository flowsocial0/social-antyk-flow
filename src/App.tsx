import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
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
import ThreadsCallback from "./pages/ThreadsCallback";
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
import PlatformReddit from "./pages/platforms/PlatformReddit";
import PlatformTelegram from "./pages/platforms/PlatformTelegram";
import PlatformThreads from "./pages/platforms/PlatformThreads";
import PlatformBeReal from "./pages/platforms/PlatformBeReal";
import PlatformMeWe from "./pages/platforms/PlatformMeWe";
import PlatformBluesky from "./pages/platforms/PlatformBluesky";
import PlatformMastodon from "./pages/platforms/PlatformMastodon";
import PlatformRumble from "./pages/platforms/PlatformRumble";
import PlatformOnlyFans from "./pages/platforms/PlatformOnlyFans";
import PlatformLocals from "./pages/platforms/PlatformLocals";
import PlatformGab from "./pages/platforms/PlatformGab";
import PlatformParler from "./pages/platforms/PlatformParler";
import ScheduleOverview from "./pages/ScheduleOverview";
import Platforms from "./pages/Platforms";
import ExpressCampaignLaunch from "./pages/ExpressCampaignLaunch";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
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
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignsNew />} />
          <Route path="/express-campaign-launch" element={<ExpressCampaignLaunch />} />
          <Route path="/campaigns/:id" element={<CampaignDetails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings/social-accounts" element={<SocialAccounts />} />
          <Route path="/twitter-callback" element={<TwitterCallback />} />
          <Route path="/oauth/facebook/callback" element={<FacebookCallback />} />
          <Route path="/oauth/tiktok/callback" element={<TikTokCallback />} />
          <Route path="/oauth/youtube/callback" element={<YouTubeCallback />} />
          <Route path="/oauth/linkedin/callback" element={<LinkedInCallback />} />
          <Route path="/oauth/threads/callback" element={<ThreadsCallback />} />
          <Route path="/book/:id" element={<BookPreview />} />
          <Route path="/book/:id/redirect" element={<BookRedirect />} />
          <Route path="/platforms/x" element={<PlatformX />} />
          <Route path="/platforms/facebook" element={<PlatformFacebook />} />
          {/* Accept optional trailing segments to avoid OAuth redirect edge-cases */}
          <Route path="/platforms/facebook/select-page/*" element={<FacebookSelectPage />} />
          <Route path="/platforms/instagram" element={<PlatformInstagram />} />
          <Route path="/platforms/youtube" element={<PlatformYouTube />} />
          <Route path="/platforms/linkedin" element={<PlatformLinkedIn />} />
          <Route path="/platforms/tiktok" element={<PlatformTikTok />} />
          <Route path="/platforms/pinterest" element={<PlatformPinterest />} />
          <Route path="/platforms/reddit" element={<PlatformReddit />} />
          <Route path="/platforms/telegram" element={<PlatformTelegram />} />
          <Route path="/platforms/threads" element={<PlatformThreads />} />
          <Route path="/platforms/bereal" element={<PlatformBeReal />} />
          <Route path="/platforms/mewe" element={<PlatformMeWe />} />
          <Route path="/platforms/bluesky" element={<PlatformBluesky />} />
          <Route path="/platforms/mastodon" element={<PlatformMastodon />} />
          <Route path="/platforms/rumble" element={<PlatformRumble />} />
          <Route path="/platforms/onlyfans" element={<PlatformOnlyFans />} />
          <Route path="/platforms/locals" element={<PlatformLocals />} />
          <Route path="/platforms/gab" element={<PlatformGab />} />
          <Route path="/platforms/parler" element={<PlatformParler />} />
          <Route path="/schedule-overview" element={<ScheduleOverview />} />
          <Route path="/platforms" element={<Platforms />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
