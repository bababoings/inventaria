-- Enable RLS on suppliers table if not already enabled
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "suppliers_select_org" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_org" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_org" ON public.suppliers;

-- Allow users to select suppliers from their organization
CREATE POLICY "suppliers_select_org"
ON public.suppliers
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

-- Allow admins to insert suppliers for their organization
CREATE POLICY "suppliers_insert_org"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);

-- Allow admins to update suppliers from their organization
CREATE POLICY "suppliers_update_org"
ON public.suppliers
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

