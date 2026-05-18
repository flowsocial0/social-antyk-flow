CREATE OR REPLACE FUNCTION public.get_campaign_post_counts()
RETURNS TABLE(campaign_id uuid, status text, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT cp.campaign_id, cp.status, COUNT(*)::bigint
  FROM public.campaign_posts cp
  JOIN public.campaigns c ON c.id = cp.campaign_id
  WHERE c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY cp.campaign_id, cp.status;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_post_counts() TO authenticated;