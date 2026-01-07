-- Fix inventory_items select policy to avoid recursion through current_org_id
DROP POLICY IF EXISTS "inv_items_select" ON public.inventory_items;

CREATE POLICY "inv_items_select" 
ON public.inventory_items 
FOR SELECT 
USING (organization_id = get_user_org_id(auth.uid()));