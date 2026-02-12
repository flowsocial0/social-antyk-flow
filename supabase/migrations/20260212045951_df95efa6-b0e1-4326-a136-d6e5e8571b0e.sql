
-- Tabela bug_reports
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nowy',
  page_url TEXT,
  user_agent TEXT,
  screen_size TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela bug_report_attachments
CREATE TABLE public.bug_report_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL
);

-- Tabela bug_report_comments
CREATE TABLE public.bug_report_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger na updated_at
CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS bug_reports
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own bug reports"
  ON public.bug_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bug reports"
  ON public.bug_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bug reports"
  ON public.bug_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bug reports"
  ON public.bug_reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bug reports"
  ON public.bug_reports FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS bug_report_attachments
ALTER TABLE public.bug_report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attachments"
  ON public.bug_report_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can view attachments of own reports"
  ON public.bug_report_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bug_reports
      WHERE bug_reports.id = bug_report_attachments.bug_report_id
        AND bug_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all attachments"
  ON public.bug_report_attachments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert attachments"
  ON public.bug_report_attachments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete attachments"
  ON public.bug_report_attachments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS bug_report_comments
ALTER TABLE public.bug_report_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on own reports"
  ON public.bug_report_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bug_reports
      WHERE bug_reports.id = bug_report_comments.bug_report_id
        AND bug_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all comments"
  ON public.bug_report_comments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert comments"
  ON public.bug_report_comments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete comments"
  ON public.bug_report_comments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('bug-reports', 'bug-reports', true);

-- Storage RLS
CREATE POLICY "Authenticated users can upload bug report files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bug-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view bug report files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bug-reports');

CREATE POLICY "Admins can delete bug report files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bug-reports' AND public.has_role(auth.uid(), 'admin'));
