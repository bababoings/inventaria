-- Remove references to user_roles table that doesn't exist
-- The system uses profiles.role instead

-- Note: We can't drop policies on user_roles table since it doesn't exist
-- The old policies that might reference user_roles should have been replaced by later migrations
-- But we'll drop any old policies that use current_role() which might have issues
DROP POLICY IF EXISTS "products_admin_staff_write" ON public.products;
DROP POLICY IF EXISTS "products_admin_staff_update" ON public.products;
DROP POLICY IF EXISTS "inv_items_admin_staff_write" ON public.inventory_items;

-- Replace current_role() function to use profiles.role instead of user_roles
-- This ensures any remaining references work correctly
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

