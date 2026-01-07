-- Fix inventory_items update policy to use security definer function
DROP POLICY IF EXISTS "inv_items_admin_update" ON public.inventory_items;

CREATE POLICY "inv_items_admin_staff_update" 
ON public.inventory_items 
FOR UPDATE 
USING (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);

-- Also fix the insert policy to use security definer function
DROP POLICY IF EXISTS "inv_items_admin_staff_write" ON public.inventory_items;

CREATE POLICY "inv_items_admin_staff_insert" 
ON public.inventory_items 
FOR INSERT 
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);