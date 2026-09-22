-- Create edge function to delete auth users
-- We need to create an edge function because we can't delete auth.users directly from the client
-- This function will be called by admins to completely delete users including from auth

-- First, let's add a trigger to automatically delete auth users when profiles are deleted
-- Create function to delete auth user
CREATE OR REPLACE FUNCTION public.delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be handled by the edge function instead
  -- Just return the old record for now
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- We'll create an edge function to handle the actual user deletion from auth
-- For now, let's just update the user management to show a proper message