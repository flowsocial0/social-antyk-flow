import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Schedule from "./pages/Schedule";
import Campaigns from "./pages/Campaigns";
import CampaignsNew from "./pages/CampaignsNew";
import CampaignDetails from "./pages/CampaignDetails";
import SocialAccounts from "./pages/SocialAccounts";
import TwitterCallback from "./pages/TwitterCallback";
import FacebookCallback from "./pages/FacebookCallback";
import BookPreview from "./pages/BookPreview";
import BookRedirect from "./pages/BookRedirect";
import PlatformX from "./pages/platforms/PlatformX";
import PlatformFacebook from "./pages/platforms/PlatformFacebook";
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
import DataDeletion from "./pages/DataDeletion";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignsNew />} />
          <Route path="/express-campaign-launch" element={<ExpressCampaignLaunch />} />
          <Route path="/campaigns/:id" element={<CampaignDetails />} />
          <Route path="/settings/social-accounts" element={<SocialAccounts />} />
          <Route path="/twitter-callback" element={<TwitterCallback />} />
          <Route path="/oauth/facebook/callback" element={<FacebookCallback />} />
          <Route path="/book/:id" element={<BookPreview />} />
          <Route path="/book/:id/redirect" element={<BookRedirect />} />
          <Route path="/platforms/x" element={<PlatformX />} />
          <Route path="/platforms/facebook" element={<PlatformFacebook />} />
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
          <Route path="/data-deletion" element={<DataDeletion />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
