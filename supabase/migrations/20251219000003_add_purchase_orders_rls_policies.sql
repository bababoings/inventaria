-- Enable RLS on purchase_orders table if not already enabled
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "purchase_orders_select_org" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert_org" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_org" ON public.purchase_orders;

-- Allow users to select purchase orders from their organization
CREATE POLICY "purchase_orders_select_org"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

-- Allow admins to insert purchase orders for their organization
CREATE POLICY "purchase_orders_insert_org"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);

-- Allow admins to update purchase orders from their organization
CREATE POLICY "purchase_orders_update_org"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);

-- Enable RLS on purchase_order_line_items table if not already enabled
ALTER TABLE public.purchase_order_line_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "purchase_order_line_items_select_org" ON public.purchase_order_line_items;
DROP POLICY IF EXISTS "purchase_order_line_items_insert_org" ON public.purchase_order_line_items;
DROP POLICY IF EXISTS "purchase_order_line_items_update_org" ON public.purchase_order_line_items;

-- Allow users to select purchase_order_line_items from purchase orders in their organization
CREATE POLICY "purchase_order_line_items_select_org"
ON public.purchase_order_line_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_line_items.purchase_order_id
    AND purchase_orders.organization_id = get_user_org_id(auth.uid())
  )
);

-- Allow admins to insert purchase_order_line_items for purchase orders in their organization
CREATE POLICY "purchase_order_line_items_insert_org"
ON public.purchase_order_line_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_line_items.purchase_order_id
    AND purchase_orders.organization_id = get_user_org_id(auth.uid())
    AND is_admin(auth.uid())
  )
);

-- Allow admins to update purchase_order_line_items from purchase orders in their organization
CREATE POLICY "purchase_order_line_items_update_org"
ON public.purchase_order_line_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_line_items.purchase_order_id
    AND purchase_orders.organization_id = get_user_org_id(auth.uid())
    AND is_admin(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_line_items.purchase_order_id
    AND purchase_orders.organization_id = get_user_org_id(auth.uid())
    AND is_admin(auth.uid())
  )
);

