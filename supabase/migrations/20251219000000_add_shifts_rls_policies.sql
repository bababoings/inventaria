-- Enable RLS on shifts table if not already enabled
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "shifts_select_org" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_org" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_org" ON public.shifts;

-- Allow users to select shifts from their organization
CREATE POLICY "shifts_select_org"
ON public.shifts
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

-- Allow users to insert shifts for their organization
-- Note: Both organization_id and opened_by must match the authenticated user
CREATE POLICY "shifts_insert_org"
ON public.shifts
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND opened_by = auth.uid()
);

-- Allow users to update shifts from their organization
CREATE POLICY "shifts_update_org"
ON public.shifts
FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()))
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

