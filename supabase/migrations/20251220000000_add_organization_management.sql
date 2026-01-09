-- Create staff_invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(organization_id, email)
);

-- Enable RLS on staff_invitations
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations for their organization
DROP POLICY IF EXISTS "staff_invitations_select_org_admin" ON public.staff_invitations;
CREATE POLICY "staff_invitations_select_org_admin"
ON public.staff_invitations
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);

-- Admins can create invitations for their organization
DROP POLICY IF EXISTS "staff_invitations_insert_org_admin" ON public.staff_invitations;
CREATE POLICY "staff_invitations_insert_org_admin"
ON public.staff_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND is_admin(auth.uid())
);

-- Admins can update invitations for their organization
DROP POLICY IF EXISTS "staff_invitations_update_org_admin" ON public.staff_invitations;
CREATE POLICY "staff_invitations_update_org_admin"
ON public.staff_invitations
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

-- Function to get current user's email (security definer to access auth.users)
CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN v_email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;

-- Users can view their own pending invitations (by email)
DROP POLICY IF EXISTS "staff_invitations_select_own" ON public.staff_invitations;
CREATE POLICY "staff_invitations_select_own"
ON public.staff_invitations
FOR SELECT
TO authenticated
USING (
  email = get_user_email(auth.uid())
  AND status = 'pending'
);

-- Update handle_new_user to support staff signup with organization_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_profile_id uuid;
  v_organization_id uuid;
  v_is_staff boolean;
  v_role text;
BEGIN
  -- Safety check: Only process if this is actually a new user insert
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check if a profile already exists (safety check)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE id = NEW.id;

  -- If profile already exists, skip
  IF existing_profile_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user is signing up as staff (organization_id in metadata)
  v_organization_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
  v_is_staff := v_organization_id IS NOT NULL;

  IF v_is_staff THEN
    -- Staff signup: assign to existing organization with STAFF role
    -- Verify the organization exists
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_organization_id) THEN
      RAISE EXCEPTION 'Invalid organization ID';
    END IF;
    
    v_role := 'STAFF';
  ELSE
    -- Admin signup: create profile without organization (will be created via setup form)
    v_organization_id := NULL;
    v_role := 'ADMIN';
  END IF;

  -- Create the user's profile
  INSERT INTO public.profiles (id, organization_id, role, full_name)
  VALUES (
    NEW.id,
    v_organization_id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  -- If staff signup, mark any pending invitations as accepted
  IF v_is_staff THEN
    UPDATE public.staff_invitations
    SET status = 'accepted'
    WHERE organization_id = v_organization_id
      AND email = NEW.email
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

-- Function to get organization members (for admins)
CREATE OR REPLACE FUNCTION public.get_organization_members(org_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user is an admin of this organization
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = org_id
        AND p.role = 'ADMIN'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Only organization admins can view members';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    p.full_name,
    p.role::text,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.organization_id = org_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_organization_members(uuid) TO authenticated;

-- Function to invite a staff member
CREATE OR REPLACE FUNCTION public.invite_staff_member(
  p_email text,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invitation_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Verify the user is an admin of this organization
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.organization_id = p_organization_id
      AND p.role = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only organization admins can invite members';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.organization_id = p_organization_id
      AND p.id IN (SELECT u.id FROM auth.users u WHERE u.email = p_email)
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Check if there's already a pending invitation
  IF EXISTS (
    SELECT 1 FROM public.staff_invitations
    WHERE organization_id = p_organization_id
      AND email = p_email
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'An invitation is already pending for this email';
  END IF;

  -- Create the invitation
  INSERT INTO public.staff_invitations (organization_id, email, invited_by)
  VALUES (p_organization_id, p_email, v_user_id)
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'email', p_email
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.invite_staff_member(text, uuid) TO authenticated;

