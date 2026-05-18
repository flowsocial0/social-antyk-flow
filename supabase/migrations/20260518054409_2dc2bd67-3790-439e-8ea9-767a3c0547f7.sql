DROP FUNCTION IF EXISTS public.get_campaign_post_counts();

CREATE OR REPLACE FUNCTION public.get_campaign_post_counts(_campaign_ids uuid[])
RETURNS TABLE(campaign_id uuid, status text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.campaign_id, cp.status, COUNT(*)::bigint AS cnt
  FROM public.campaign_posts cp
  WHERE cp.campaign_id = ANY(_campaign_ids)
  GROUP BY cp.campaign_id, cp.status;
$$;

CREATE INDEX IF NOT EXISTS idx_campaign_posts_campaign_status
  ON public.campaign_posts(campaign_id, status);