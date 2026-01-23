-- Tabela na pomysły do wdrożenia (tylko dla adminów)
CREATE TABLE public.admin_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new, in_progress, done, rejected
  priority TEXT DEFAULT 'medium', -- low, medium, high
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_ideas ENABLE ROW LEVEL SECURITY;

-- Tylko admini mogą zarządzać pomysłami
CREATE POLICY "Admins can view all ideas" 
ON public.admin_ideas 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert ideas" 
ON public.admin_ideas 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ideas" 
ON public.admin_ideas 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete ideas" 
ON public.admin_ideas 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger na updated_at
CREATE TRIGGER update_admin_ideas_updated_at
BEFORE UPDATE ON public.admin_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Dodanie pola na custom obrazek do campaign_posts
ALTER TABLE public.campaign_posts 
ADD COLUMN custom_image_url TEXT;