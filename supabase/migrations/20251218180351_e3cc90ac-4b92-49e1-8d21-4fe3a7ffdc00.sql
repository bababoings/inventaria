-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "profiles_select_admin_org" ON public.profiles;

-- The profiles_select_self policy is fine since it only checks auth.uid()
-- Let's create a simpler admin policy that doesn't cause recursion
-- Admins should be able to see all profiles in their org, but we need to avoid calling current_role()

-- Create a security definer function to get org profiles for admins
CREATE OR REPLACE FUNCTION public.get_user_org_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = user_id
$$;

-- Now create a non-recursive policy for admins viewing org members
CREATE POLICY "profiles_select_org_admin" 
ON public.profiles 
FOR SELECT 
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
);