-- Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'ADMIN';

-- Update existing users to have ADMIN role
UPDATE public.profiles SET role = 'ADMIN' WHERE role IS NULL OR role = '';