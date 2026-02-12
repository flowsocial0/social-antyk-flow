
-- Add columns for user-submitted ideas
ALTER TABLE public.admin_ideas 
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS submitted_by_email text;

-- Allow authenticated users to insert their own ideas
CREATE POLICY "Users can insert own ideas"
ON public.admin_ideas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow users to view their own submitted ideas
CREATE POLICY "Users can view own ideas"
ON public.admin_ideas
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);
