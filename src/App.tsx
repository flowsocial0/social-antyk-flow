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
import MastodonCallback from "./pages/MastodonCallback";
import GabCallback from "./pages/GabCallback";
import PinterestCallback from "./pages/PinterestCallback";
import RedditCallback from "./pages/RedditCallback";
import TumblrCallback from "./pages/TumblrCallback";
import SnapchatCallback from "./pages/SnapchatCallback";
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
import PlatformDiscord from "./pages/platforms/PlatformDiscord";
import PlatformTumblr from "./pages/platforms/PlatformTumblr";
import PlatformSnapchat from "./pages/platforms/PlatformSnapchat";
import PlatformGoogleBusiness from "./pages/platforms/PlatformGoogleBusiness";
import PlatformParler from "./pages/platforms/PlatformParler";
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
        <BugReportButton />
        <FeatureRequestButton />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />

          {/* OAuth callbacks (need to work during auth flow) */}
          <Route path="/twitter-callback" element={<TwitterCallback />} />
          <Route path="/oauth/facebook/callback" element={<FacebookCallback />} />
          <Route path="/oauth/tiktok/callback" element={<TikTokCallback />} />
          <Route path="/oauth/youtube/callback" element={<YouTubeCallback />} />
          <Route path="/oauth/linkedin/callback" element={<LinkedInCallback />} />
          <Route path="/oauth/threads/callback" element={<ThreadsCallback />} />
          <Route path="/oauth/mastodon/callback" element={<MastodonCallback />} />
          <Route path="/oauth/gab/callback" element={<GabCallback />} />
          <Route path="/oauth/pinterest/callback" element={<PinterestCallback />} />
          <Route path="/oauth/reddit/callback" element={<RedditCallback />} />
          <Route path="/oauth/tumblr/callback" element={<TumblrCallback />} />
          <Route path="/oauth/snapchat/callback" element={<SnapchatCallback />} />
          <Route path="/oauth/google-business/callback" element={<GoogleBusinessCallback />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
          <Route path="/campaigns/new" element={<ProtectedRoute><CampaignsNew /></ProtectedRoute>} />
          <Route path="/express-campaign-launch" element={<ProtectedRoute><ExpressCampaignLaunch /></ProtectedRoute>} />
          <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetails /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/settings/social-accounts" element={<ProtectedRoute><SocialAccounts /></ProtectedRoute>} />
          <Route path="/book/:id" element={<ProtectedRoute><BookPreview /></ProtectedRoute>} />
          <Route path="/book/:id/redirect" element={<ProtectedRoute><BookRedirect /></ProtectedRoute>} />
          <Route path="/platforms" element={<ProtectedRoute><Platforms /></ProtectedRoute>} />
          <Route path="/platforms/x" element={<ProtectedRoute><PlatformX /></ProtectedRoute>} />
          <Route path="/platforms/facebook" element={<ProtectedRoute><PlatformFacebook /></ProtectedRoute>} />
          <Route path="/platforms/facebook/select-page/*" element={<ProtectedRoute><FacebookSelectPage /></ProtectedRoute>} />
          <Route path="/platforms/instagram" element={<ProtectedRoute><PlatformInstagram /></ProtectedRoute>} />
          <Route path="/platforms/youtube" element={<ProtectedRoute><PlatformYouTube /></ProtectedRoute>} />
          <Route path="/platforms/linkedin" element={<ProtectedRoute><PlatformLinkedIn /></ProtectedRoute>} />
          <Route path="/platforms/tiktok" element={<ProtectedRoute><PlatformTikTok /></ProtectedRoute>} />
          <Route path="/platforms/pinterest" element={<ProtectedRoute><PlatformPinterest /></ProtectedRoute>} />
          <Route path="/platforms/reddit" element={<ProtectedRoute><PlatformReddit /></ProtectedRoute>} />
          <Route path="/platforms/telegram" element={<ProtectedRoute><PlatformTelegram /></ProtectedRoute>} />
          <Route path="/platforms/threads" element={<ProtectedRoute><PlatformThreads /></ProtectedRoute>} />
          <Route path="/platforms/bereal" element={<ProtectedRoute><PlatformBeReal /></ProtectedRoute>} />
          <Route path="/platforms/mewe" element={<ProtectedRoute><PlatformMeWe /></ProtectedRoute>} />
          <Route path="/platforms/bluesky" element={<ProtectedRoute><PlatformBluesky /></ProtectedRoute>} />
          <Route path="/platforms/mastodon" element={<ProtectedRoute><PlatformMastodon /></ProtectedRoute>} />
          <Route path="/platforms/rumble" element={<ProtectedRoute><PlatformRumble /></ProtectedRoute>} />
          <Route path="/platforms/onlyfans" element={<ProtectedRoute><PlatformOnlyFans /></ProtectedRoute>} />
          <Route path="/platforms/locals" element={<ProtectedRoute><PlatformLocals /></ProtectedRoute>} />
          <Route path="/platforms/gab" element={<ProtectedRoute><PlatformGab /></ProtectedRoute>} />
          <Route path="/platforms/discord" element={<ProtectedRoute><PlatformDiscord /></ProtectedRoute>} />
          <Route path="/platforms/tumblr" element={<ProtectedRoute><PlatformTumblr /></ProtectedRoute>} />
          <Route path="/platforms/snapchat" element={<ProtectedRoute><PlatformSnapchat /></ProtectedRoute>} />
          <Route path="/platforms/google-business" element={<ProtectedRoute><PlatformGoogleBusiness /></ProtectedRoute>} />
          <Route path="/platforms/parler" element={<ProtectedRoute><PlatformParler /></ProtectedRoute>} />
          <Route path="/schedule-overview" element={<ProtectedRoute><ScheduleOverview /></ProtectedRoute>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
