-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_select_org_admin" ON public.profiles;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'ADMIN'
  )
$$;

-- Create non-recursive policy: admins can see all profiles in their org
CREATE POLICY "profiles_select_org_admin" 
ON public.profiles 
FOR SELECT 
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND is_admin(auth.uid())
);