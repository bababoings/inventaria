-- Insert admin role for existing users who don't have roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_roles.user_id = profiles.id
)
ON CONFLICT DO NOTHING;