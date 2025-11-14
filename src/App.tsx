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
import TwitterCallback from "./pages/TwitterCallback";
import BookPreview from "./pages/BookPreview";
import BookRedirect from "./pages/BookRedirect";
import NotFound from "./pages/NotFound";

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
          <Route path="/campaigns/:id" element={<CampaignDetails />} />
          <Route path="/twitter-callback" element={<TwitterCallback />} />
          <Route path="/book/:id" element={<BookPreview />} />
          <Route path="/book/:id/redirect" element={<BookRedirect />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
