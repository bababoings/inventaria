-- Fix inventory_items UPDATE policy to allow STAFF users (needed for sales completion)
-- The current policy only allows ADMIN, but STAFF should be able to update inventory when completing sales

DROP POLICY IF EXISTS "inv_items_admin_staff_update" ON public.inventory_items;
DROP POLICY IF EXISTS "inv_items_admin_update" ON public.inventory_items;

CREATE POLICY "inv_items_admin_staff_update"
ON public.inventory_items
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'STAFF'
  ))
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'STAFF'
  ))
);

