-- Allow STAFF to create/update products (catalog management)
DROP POLICY IF EXISTS products_admin_write ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;

CREATE POLICY products_admin_staff_write
ON public.products
FOR INSERT
WITH CHECK (
  organization_id = current_org_id()
  AND "current_role"() = ANY (ARRAY['ADMIN'::text,'STAFF'::text])
);

CREATE POLICY products_admin_staff_update
ON public.products
FOR UPDATE
USING (
  organization_id = current_org_id()
  AND "current_role"() = ANY (ARRAY['ADMIN'::text,'STAFF'::text])
)
WITH CHECK (
  organization_id = current_org_id()
  AND "current_role"() = ANY (ARRAY['ADMIN'::text,'STAFF'::text])
);

-- Allow STAFF to create inventory_items for new products
DROP POLICY IF EXISTS inv_items_admin_write ON public.inventory_items;
CREATE POLICY inv_items_admin_staff_write
ON public.inventory_items
FOR INSERT
WITH CHECK (
  organization_id = current_org_id()
  AND "current_role"() = ANY (ARRAY['ADMIN'::text,'STAFF'::text])
);