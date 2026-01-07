-- Drop the restrictive policy and create a permissive one
DROP POLICY IF EXISTS "user_roles_select_self" ON public.user_roles;

CREATE POLICY "user_roles_select_self"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);