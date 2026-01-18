-- Allow admins to view all social token records for admin panel statistics

-- Facebook OAuth tokens - admin can SELECT all
CREATE POLICY "Admins can view all facebook tokens"
ON public.facebook_oauth_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Instagram OAuth tokens - admin can SELECT all
CREATE POLICY "Admins can view all instagram tokens"
ON public.instagram_oauth_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- YouTube OAuth tokens - admin can SELECT all
CREATE POLICY "Admins can view all youtube tokens"
ON public.youtube_oauth_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- TikTok OAuth tokens - admin can SELECT all
CREATE POLICY "Admins can view all tiktok tokens"
ON public.tiktok_oauth_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Twitter OAuth1 tokens - admin can SELECT all
CREATE POLICY "Admins can view all twitter oauth1 tokens"
ON public.twitter_oauth1_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));