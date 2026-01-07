-- Enable RLS on sales table if not already enabled
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "sales_select_org" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_org" ON public.sales;
DROP POLICY IF EXISTS "sales_update_org" ON public.sales;

-- Allow users to select sales from their organization
CREATE POLICY "sales_select_org"
ON public.sales
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

-- Allow users to insert sales for their organization
CREATE POLICY "sales_insert_org"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND created_by = auth.uid()
);

-- Allow users to update sales from their organization
CREATE POLICY "sales_update_org"
ON public.sales
FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()))
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

-- Enable RLS on sale_line_items table if not already enabled
ALTER TABLE public.sale_line_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "sale_line_items_select_org" ON public.sale_line_items;
DROP POLICY IF EXISTS "sale_line_items_insert_org" ON public.sale_line_items;
DROP POLICY IF EXISTS "sale_line_items_update_org" ON public.sale_line_items;

-- Allow users to select sale_line_items from sales in their organization
CREATE POLICY "sale_line_items_select_org"
ON public.sale_line_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_line_items.sale_id
    AND sales.organization_id = get_user_org_id(auth.uid())
  )
);

-- Allow users to insert sale_line_items for sales in their organization
CREATE POLICY "sale_line_items_insert_org"
ON public.sale_line_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_line_items.sale_id
    AND sales.organization_id = get_user_org_id(auth.uid())
  )
);

-- Allow users to update sale_line_items from sales in their organization
CREATE POLICY "sale_line_items_update_org"
ON public.sale_line_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_line_items.sale_id
    AND sales.organization_id = get_user_org_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_line_items.sale_id
    AND sales.organization_id = get_user_org_id(auth.uid())
  )
);

-- Enable RLS on inventory_movements table if not already enabled
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "inventory_movements_select_org" ON public.inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_insert_org" ON public.inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_update_org" ON public.inventory_movements;

-- Allow users to select inventory_movements from their organization
CREATE POLICY "inventory_movements_select_org"
ON public.inventory_movements
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

-- Allow users to insert inventory_movements for their organization
CREATE POLICY "inventory_movements_insert_org"
ON public.inventory_movements
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND created_by = auth.uid()
);

-- Allow users to update inventory_movements from their organization
CREATE POLICY "inventory_movements_update_org"
ON public.inventory_movements
FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()))
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

