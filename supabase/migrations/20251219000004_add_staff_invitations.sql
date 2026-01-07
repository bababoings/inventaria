-- Remove staff user creation function (rolled back)
DROP FUNCTION IF EXISTS public.create_staff_user(text, text, text, uuid);

-- Remove team members function (rolled back)
DROP FUNCTION IF EXISTS public.get_team_members(uuid);

-- Ensure users can view their own profile (required for login)
-- This policy allows any authenticated user to view their own profile
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Ensure get_user_org_id function exists and is safe
-- This function is used by many RLS policies and must handle NULL gracefully
-- Returns NULL if user_id is NULL, profile doesn't exist, or organization_id is NULL
-- RLS policies should handle NULL organization_id by denying access (which is correct for users without orgs)
CREATE OR REPLACE FUNCTION public.get_user_org_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = user_id
$$;

-- Make organization_id nullable in profiles to allow delayed organization creation
ALTER TABLE public.profiles 
  ALTER COLUMN organization_id DROP NOT NULL;

-- Update handle_new_user to create profile WITHOUT organization (delayed org creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_profile_id uuid;
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

  -- This is a new admin sign-up (regular sign-up flow via registration)
  -- Create the user's profile with ADMIN role but WITHOUT organization_id
  -- Organization will be created when user completes the setup form
  INSERT INTO public.profiles (id, organization_id, role, full_name)
  VALUES (
    NEW.id,
    NULL, -- Organization will be created later via setup form
    'ADMIN',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly set up (only runs on INSERT, not UPDATE)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a helper function to check if user can create an organization
CREATE OR REPLACE FUNCTION public.can_create_organization(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the user's organization_id from their profile
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE id = user_id;
  
  -- Return true if profile exists and organization_id is NULL
  -- Return false if profile doesn't exist (v_org_id will be NULL but we check FOUND) or organization_id is not NULL
  IF NOT FOUND THEN
    -- Profile doesn't exist, can't create organization
    RETURN false;
  END IF;
  
  -- Return true only if organization_id is NULL
  RETURN (v_org_id IS NULL);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_create_organization(uuid) TO authenticated;

-- Enable RLS on organizations table if not already enabled
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Allow users to create an organization if they don't have one yet
-- This policy allows users with NULL organization_id to insert a new organization
-- We use a SECURITY DEFINER function to safely check the user's profile
DROP POLICY IF EXISTS "organizations_insert_new" ON public.organizations;
CREATE POLICY "organizations_insert_new"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user's profile has NULL organization_id (new user setting up org)
  -- Use the helper function which runs as SECURITY DEFINER to bypass RLS on profiles
  can_create_organization(auth.uid()) = true
);

-- Allow users to select their own organization
DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
CREATE POLICY "organizations_select_own"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to update their own organization
DROP POLICY IF EXISTS "organizations_update_own" ON public.organizations;
CREATE POLICY "organizations_update_own"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Function to create organization for a user (bypasses RLS)
-- This function creates the organization and links it to the user's profile
CREATE OR REPLACE FUNCTION public.create_user_organization(
  p_name text,
  p_currency text DEFAULT 'USD',
  p_timezone text DEFAULT 'America/New_York'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_profile_org_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user's profile exists and get current organization_id
  SELECT organization_id INTO v_profile_org_id
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- If profile doesn't exist, that's an error
  IF v_profile_org_id IS NULL AND NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- If user already has an organization, don't allow creating another one
  IF v_profile_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has an organization';
  END IF;
  
  -- Create the organization (bypasses RLS because function is SECURITY DEFINER)
  INSERT INTO public.organizations (name, currency, timezone)
  VALUES (p_name, p_currency, p_timezone)
  RETURNING id INTO v_org_id;
  
  -- Update the user's profile to link it to the new organization
  UPDATE public.profiles
  SET organization_id = v_org_id
  WHERE id = v_user_id;
  
  -- Return success with organization details
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'name', p_name,
    'currency', p_currency,
    'timezone', p_timezone
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_organization(text, text, text) TO authenticated;

-- Fix products table RLS policies to use get_user_org_id instead of current_org_id
-- This ensures consistency with other tables and works correctly with new organizations

-- Ensure products SELECT policy exists (allows users to view products in their org)
DROP POLICY IF EXISTS products_select_org ON public.products;
CREATE POLICY products_select_org
ON public.products
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

-- Fix products INSERT policy
DROP POLICY IF EXISTS products_admin_staff_write ON public.products;
DROP POLICY IF EXISTS products_admin_write ON public.products;

CREATE POLICY products_admin_staff_write
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'STAFF'
  ))
);

DROP POLICY IF EXISTS products_admin_staff_update ON public.products;
CREATE POLICY products_admin_staff_update
ON public.products
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

-- Fix inventory_items insert policy to use get_user_org_id
DROP POLICY IF EXISTS inv_items_admin_staff_write ON public.inventory_items;
DROP POLICY IF EXISTS inv_items_admin_staff_insert ON public.inventory_items;
CREATE POLICY inv_items_admin_staff_insert
ON public.inventory_items
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'STAFF'
  ))
);

-- Add a function to ensure existing users without profiles get them
-- This can be called manually if needed to fix any missing profiles
CREATE OR REPLACE FUNCTION public.ensure_user_profile(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_exists boolean;
  v_org_id uuid;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = user_id) INTO v_profile_exists;
  
  IF NOT v_profile_exists THEN
    -- Create organization and profile for user
    INSERT INTO public.organizations (name)
    VALUES ('User Organization')
    RETURNING id INTO v_org_id;
    
    INSERT INTO public.profiles (id, organization_id, role, full_name)
    VALUES (
      user_id,
      v_org_id,
      'ADMIN',
      'User'
    );
  END IF;
END;
$$;

