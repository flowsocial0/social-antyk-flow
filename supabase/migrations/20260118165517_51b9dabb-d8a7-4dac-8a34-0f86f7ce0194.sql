-- Dodanie pierwszego admina (bootstrap - przed działaniem RLS)
INSERT INTO public.user_roles (user_id, role)
VALUES ('9e6bd872-870f-4e47-8283-1a1aa0bad8d4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;